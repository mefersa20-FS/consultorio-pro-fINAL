import { requireUser, fail } from '../../lib/neon-server.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Método no permitido'});
  try{
    await requireUser(req);
    const provider=String(req.body?.provider||'').toLowerCase();
    const apiKey=String(req.body?.apiKey||'').trim();
    const prompt=String(req.body?.prompt||'').trim();
    if(!['gemini','perplexity'].includes(provider)) return res.status(400).json({error:'Proveedor no válido'});
    if(!apiKey||apiKey.length>500) return res.status(400).json({error:'Introduce una clave API válida'});
    if(!prompt||prompt.length>12000) return res.status(400).json({error:'Escribe una consulta de hasta 12 000 caracteres'});
    let response, payload, answer='';
    if(provider==='gemini'){
      response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+encodeURIComponent(apiKey),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({systemInstruction:{parts:[{text:'Eres un asistente de apoyo profesional para psicólogos. Responde en español, con claridad y prudencia. No inventes diagnósticos ni datos clínicos; distingue evidencia, hipótesis y sugerencias. No sustituyas el juicio profesional.'}]},contents:[{role:'user',parts:[{text:prompt}]}]})
      });
      payload=await response.json().catch(()=>({}));
      answer=payload.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n')||'';
    }else{
      response=await fetch('https://api.perplexity.ai/chat/completions',{
        method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({model:'sonar',messages:[{role:'system',content:'Eres un asistente de investigación y apoyo profesional para psicólogos. Responde en español, distingue fuentes y afirmaciones, no inventes datos ni diagnósticos y no sustituyas el juicio profesional.'},{role:'user',content:prompt}]})
      });
      payload=await response.json().catch(()=>({}));
      answer=payload.choices?.[0]?.message?.content||'';
    }
    if(!response.ok) return res.status(response.status===401?401:502).json({error:payload.error?.message||payload.message||'El proveedor rechazó la solicitud. Comprueba tu clave API y los permisos.'});
    if(!answer) return res.status(502).json({error:'El proveedor no devolvió una respuesta.'});
    return res.status(200).json({answer,provider});
  }catch(e){return fail(res,e)}
}
