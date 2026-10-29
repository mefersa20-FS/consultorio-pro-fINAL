import { database, fail } from '../../lib/neon-server.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return res.status(400).json({ error: 'Ingresa el correo usado durante el pago.' });
    const sql = database();
    const rows = await sql.query("SELECT id FROM billing_subscriptions WHERE lower(payer_email) = $1 AND upper(status) = 'ACTIVE' AND next_billing_at > now() LIMIT 1", [email]);
    if (!rows.length) return res.status(402).json({ error: 'Aún no encontramos un pago confirmado para ese correo. Verifica que utilizaste el mismo correo del pago.' });
    await sql.query("INSERT INTO subscription_access_requests(email,subscription_id,status) VALUES($1,$2,'PENDING') ON CONFLICT(email) DO UPDATE SET subscription_id=EXCLUDED.subscription_id, status=CASE WHEN subscription_access_requests.status='APPROVED' THEN 'APPROVED' ELSE 'PENDING' END, requested_at=now()", [email, String(rows[0].id)]);
    const requests = await sql.query("SELECT status FROM subscription_access_requests WHERE lower(email)=$1 LIMIT 1", [email]);
    const approved = requests[0]?.status === 'APPROVED';
    return res.status(200).json({ verified: true, pending: !approved, approved, message: approved ? 'Acceso autorizado.' : 'Pago confirmado. Solicitud enviada a la administradora.' });
  } catch (error) { return fail(res, error); }
}
