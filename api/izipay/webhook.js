import { createHmac, timingSafeEqual } from 'node:crypto';
import { database, fail } from '../../lib/neon-server.js';

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const hashKey = process.env.IZIPAY_HASH_KEY;
    const expectedMerchant = process.env.IZIPAY_MERCHANT_CODE;
    const expectedAmount = process.env.IZIPAY_EXPECTED_AMOUNT;
    const expectedCurrency = (process.env.IZIPAY_CURRENCY || 'PEN').toUpperCase();
    const environment = (process.env.IZIPAY_ENVIRONMENT || '').toLowerCase();
    if (!hashKey || !expectedMerchant || !expectedAmount || !['live', 'sandbox'].includes(environment)) {
      return res.status(503).json({ error: 'La confirmación de pagos Izipay aún no está configurada por completo.' });
    }

    const body = req.body || {};
    const payloadHttp = body.payloadHttp;
    const signature = body.signature;
    const headerTransactionId = req.headers.transactionid || req.headers.transactionId;
    if (typeof payloadHttp !== 'string' || typeof signature !== 'string' || !headerTransactionId) {
      return res.status(400).json({ error: 'Notificación Izipay incompleta.' });
    }

    const expectedSignature = createHmac('sha256', hashKey).update(payloadHttp, 'utf8').digest('base64');
    if (!safeEqual(signature, expectedSignature)) {
      return res.status(401).json({ error: 'Firma de notificación no válida.' });
    }

    let payload;
    try { payload = JSON.parse(payloadHttp); } catch {
      return res.status(400).json({ error: 'El contenido firmado no es JSON válido.' });
    }
    const transactionId = String(payload.transactionId || body.transactionId || headerTransactionId);
    if (transactionId !== String(headerTransactionId) || transactionId.length < 5 || transactionId.length > 40) {
      return res.status(400).json({ error: 'Identificador de transacción no válido.' });
    }

    // Only successful, signed transactions from the expected merchant and exact plan
    // amount/currency can activate a subscription.
    if (String(payload.code) !== '00') return res.status(200).json({ received: true, activated: false });
    const response = payload.response || {};
    const order = Array.isArray(response.order) ? response.order[0] : null;
    const email = String(response.billing?.email || '').trim().toLowerCase();
    const merchantCode = String(response.merchant?.merchantCode || '');
    const amount = Number(order?.amount);
    const currency = String(order?.currency || '').toUpperCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'La notificación no contiene un correo de pagador válido.' });
    }
    if (merchantCode !== expectedMerchant) return res.status(401).json({ error: 'El comercio de la transacción no coincide.' });
    if (!Number.isFinite(amount) || Math.abs(amount - Number(expectedAmount)) > 0.001 || currency !== expectedCurrency) {
      return res.status(400).json({ error: 'El importe o la moneda no coincide con el plan configurado.' });
    }

    const sql = database();
    const transactionRecordId = 'izipay:' + transactionId;
    const duplicate = await sql.query(
      'SELECT id FROM billing_transactions WHERE environment = $1 AND id = $2 LIMIT 1',
      [environment, transactionRecordId]
    );
    if (duplicate.length) return res.status(200).json({ received: true, activated: true, duplicate: true });
    const users = await sql.query('SELECT id::text AS id FROM neon_auth."user" WHERE lower(email) = $1 LIMIT 1', [email]);
    const userId = users[0]?.id || null;
    const subscriptionId = 'izipay:' + email;
    const merchantKey = merchantCode;
    const paidAt = new Date().toISOString();
    await sql.query(
      "INSERT INTO billing_subscriptions (environment,id,plan_id,user_id,payer_email,payer_name,status,amount,currency,started_at,next_billing_at,last_payment_at,failed_payments,provider_updated_at,synced_at,merchant_key) VALUES ($1,$2,'professional-monthly',$3,$4,$5,'ACTIVE',$6,$7,$8::timestamptz,$8::timestamptz + interval '1 month',$8::timestamptz,0,$8::timestamptz,$8::timestamptz,$9) ON CONFLICT (environment,id) DO UPDATE SET user_id=COALESCE(EXCLUDED.user_id,billing_subscriptions.user_id),payer_email=EXCLUDED.payer_email,payer_name=EXCLUDED.payer_name,status='ACTIVE',amount=EXCLUDED.amount,currency=EXCLUDED.currency,started_at=EXCLUDED.started_at,next_billing_at=EXCLUDED.next_billing_at,last_payment_at=EXCLUDED.last_payment_at,failed_payments=0,provider_updated_at=EXCLUDED.provider_updated_at,synced_at=EXCLUDED.synced_at,merchant_key=EXCLUDED.merchant_key",
      [environment, subscriptionId, userId, email, String(response.billing?.firstName || '' ) + ' ' + String(response.billing?.lastName || ''), amount, currency, paidAt, merchantKey]
    );
    await sql.query(
      "INSERT INTO billing_transactions (environment,id,subscription_id,status,amount,currency,paid_at,merchant_key) VALUES ($1,$2,$3,'PAID',$4,$5,$6::timestamptz,$7) ON CONFLICT (environment,id) DO NOTHING",
      [environment, transactionRecordId, subscriptionId, amount, currency, paidAt, merchantKey]
    );
    return res.status(200).json({ received: true, activated: true });
  } catch (error) {
    return fail(res, error);
  }
}
