import { fail } from '../../lib/neon-server.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Never silently send users to a hard-coded or possibly unrelated payment link.
    // Configure this with the exact Izipay link for the plan and environment.
    const raw = process.env.IZIPAY_PAYMENT_LINK;
    if (!raw) {
      return res.status(503).json({
        error: 'El enlace de pago aún no está configurado. Contacta al administrador de PsicoVida.'
      });
    }

    let url;
    try {
      url = new URL(raw);
    } catch {
      return res.status(503).json({ error: 'El enlace de pago Izipay configurado no es válido.' });
    }

    const allowedHost = url.hostname === 'izipay.pe' || url.hostname.endsWith('.izipay.pe');
    if (url.protocol !== 'https:' || !allowedHost || url.username || url.password) {
      return res.status(503).json({ error: 'El enlace configurado debe ser HTTPS y pertenecer a un dominio oficial de Izipay.' });
    }

    return res.status(200).json({ url: url.toString() });
  } catch (error) {
    return fail(res, error);
  }
}
