import { database, fail } from '../../lib/neon-server.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Ingresa el correo usado durante el pago.' });
    }

    // Fail closed: only a subscription already written to Neon by a trusted payment
    // confirmation process can unlock the registration flow. A return from checkout
    // or a button click is not proof of payment.
    const sql = database();
    const rows = await sql.query(
      "SELECT id FROM billing_subscriptions WHERE lower(payer_email) = $1 AND upper(status) IN ('ACTIVE','APPROVED','PAID','COMPLETED') LIMIT 1",
      [email]
    );
    if (!rows.length) {
      return res.status(402).json({
        error: 'Aún no encontramos una suscripción pagada y confirmada para ese correo. Espera la confirmación de Izipay o verifica que usaste el mismo correo.'
      });
    }
    return res.status(200).json({ verified: true });
  } catch (error) {
    return fail(res, error);
  }
}
