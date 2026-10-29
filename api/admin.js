import { requireUser, database, fail } from '../lib/neon-server.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido'});
 try{
  const user=await requireUser(req), sql=database();
  const owner=await sql.query('SELECT email FROM neon_auth."user" WHERE id::text=$1 LIMIT 1',[user.id]);
  const email=owner[0]?.email?.toLowerCase(), adminEmail=(process.env.ADMIN_EMAIL||'mefersa20@gmail.com').trim().toLowerCase();
  if(!email||email!==adminEmail)return res.status(403).json({error:'Acceso exclusivo de administración'});
  if(req.method==='POST'){
   const target=String(req.body?.email||'').trim().toLowerCase(), action=req.body?.action;
   if(!target||!['approve','reject'].includes(action))return res.status(400).json({error:'Solicitud inválida'});
   const status=action==='approve'?'APPROVED':'REJECTED';
   const rows=await sql.query("UPDATE subscription_access_requests SET status=$2, reviewed_at=now(), reviewed_by=$3 WHERE lower(email)=$1 RETURNING email,status",[target,status,email]);
   if(!rows.length)return res.status(404).json({error:'No se encontró la solicitud de acceso'});
   return res.status(200).json({success:true,request:rows[0]});
  }
  const [professionals,subscriptions,transactions,accessRequests]=await Promise.all([
   sql.query('SELECT id::text AS id,name,email,"createdAt" AS created_at FROM neon_auth."user" ORDER BY "createdAt" DESC LIMIT 100'),
   sql.query('SELECT id,user_id,payer_email,status,amount,currency,started_at,next_billing_at,last_payment_at,environment FROM billing_subscriptions ORDER BY started_at DESC NULLS LAST LIMIT 100'),
   sql.query('SELECT id,subscription_id,status,amount,currency,paid_at,environment FROM billing_transactions ORDER BY paid_at DESC LIMIT 100'),
   sql.query('SELECT id,email,subscription_id,status,requested_at,reviewed_at,reviewed_by FROM subscription_access_requests ORDER BY requested_at DESC LIMIT 100')
  ]);
  return res.status(200).json({professionals,subscriptions,transactions,accessRequests,summary:{users:professionals.length,active:subscriptions.filter(s=>['ACTIVE','APPROVED'].includes(s.status?.toUpperCase())).length,transactions:transactions.length}});
 }catch(e){return fail(res,e)}
}
