import { requireUser, fail } from '../../lib/neon-server.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Método no permitido'});
  try{
    await requireUser(req);
    const raw=process.env.IZIPAY_PAYMENT_LINK;
    if(!raw) return res.status(503).json({error:'Falta configurar IZIPAY_PAYMENT_LINK en Vercel. Crea tu enlace de pago Izipay con Yape/Plin habilitados y guárdalo en el entorno Preview.'});
    let url;
    try{url=new URL(raw)}catch{return res.status(503).json({error:'El enlace de pago Izipay configurado no es válido.'})}
    if(url.protocol!=='https:'||!(url.hostname==='izipay.pe'||url.hostname.endsWith('.izipay.pe'))) return res.status(503).json({error:'El enlace configurado no pertenece a un dominio HTTPS de Izipay.'});
    return res.status(200).json({url:url.toString()});
  }catch(e){return fail(res,e)}
}