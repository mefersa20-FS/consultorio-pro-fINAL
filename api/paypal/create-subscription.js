import { requireUser, database, fail } from '../../lib/neon-server.js';

const PAYPAL_BASE = 'https://api-m.paypal.com';
async function getToken() {
  const id=process.env.PAYPAL_CLIENT_ID, secret=process.env.PAYPAL_CLIENT_SECRET;
  if(!id || !secret) throw Object.assign(new Error('Falta configurar PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en el entorno Preview.'),{status:503});
  const r=await fetch(PAYPAL_BASE+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  if(!r.ok) throw Object.assign(new Error('PayPal no pudo autenticar las credenciales configuradas.'),{status:502});
  return (await r.json()).access_token;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Método no permitido'});
  try {
    const user=await requireUser(req);
    const planId=process.env.PAYPAL_PLAN_ID;
    if(!planId) throw Object.assign(new Error('Falta configurar PAYPAL_PLAN_ID en el entorno Preview.'),{status:503});
    const sql=database(), token=await getToken();
    const origin='https://'+String(req.headers.host||'').replace(/[^a-zA-Z0-9.:-]/g,'');
    const r=await fetch(PAYPAL_BASE+'/v1/billing/subscriptions',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','PayPal-Request-Id':'psicovida-'+user.id+'-'+Date.now()},body:JSON.stringify({plan_id:planId,custom_id:user.id,application_context:{brand_name:'PsicoVida',locale:'es-PE',user_action:'SUBSCRIBE_NOW',return_url:origin+'/?paypal=success',cancel_url:origin+'/?paypal=cancel'}})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) return res.status(502).json({error:data.message||'PayPal rechazó la solicitud de suscripción',details:data.details||undefined});
    const approve=data.links?.find(x=>x.rel==='approve')?.href;
    if(!data.id||!approve) return res.status(502).json({error:'PayPal no devolvió el enlace de aprobación'});
    await sql.query("INSERT INTO billing_subscriptions(environment,id,plan_id,user_id,status,amount,currency,started_at,merchant_key) VALUES($1,$2,$3,$4,$5,$6,$7,now(),$8) ON CONFLICT(environment,id) DO UPDATE SET user_id=EXCLUDED.user_id,plan_id=EXCLUDED.plan_id,status=EXCLUDED.status,synced_at=now()",[process.env.PAYPAL_ENVIRONMENT||'live',data.id,planId,user.id,'APPROVAL_PENDING',null,'USD','paypal']);
    return res.status(200).json({id:data.id,approve});
  } catch(e) { return fail(res,e); }
}