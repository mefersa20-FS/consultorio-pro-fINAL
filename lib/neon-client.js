import { createAuthClient } from '@neondatabase/auth';
const url = import.meta.env.VITE_NEON_AUTH_URL;
const auth = url ? createAuthClient(url) : null;
const listeners = new Set();
const unavailable = (detail='') => ({ error:{message: detail || 'No se pudo conectar con Neon Auth. Comprueba la conexión e inténtalo nuevamente.'} });
async function session() {
  if (!auth) return {data:{session:null}, ...unavailable()};
  try {
    const r = await auth.getSession();
    if (r.error) return {data:{session:null},error:r.error};
    if (!r.data?.user) return {data:{session:null}};
    // Neon Auth browser SDK exposes getJWTToken(); auth.token() is not reliable in
    // some SDK versions and must not be used as the only session source.
    let token = r.data.session?.access_token || null;
    if (!token && typeof auth.getJWTToken === 'function') {
      try { token = await auth.getJWTToken(); } catch {}
    }
    if (!token) {
      try {
        const response = await fetch(url.replace(/\\/$/, '') + '/token', {credentials:'include'});
        if (response.ok) {
          const payload = await response.json();
          token = payload.token || payload.data?.token || null;
        }
      } catch {}
    }
    if (!token) return {data:{session:null},error:{message:'La cuenta se autenticó, pero no se pudo recuperar el token de acceso. Actualiza la página.'}};
    return {data:{session:{user:r.data.user,access_token:token}}};
  } catch(e) { return {data:{session:null},error:{message:'No se pudo recuperar la sesión de Neon Auth: '+(e?.message || 'Error de conexión')}}; }
}
async function notify() { const r=await session(); listeners.forEach(fn=>fn('SESSION',r.data.session)); return r; }
async function request(body) {
  try {
    const s=await session(); if (!s.data.session) return {data:null,error:s.error || {message:'Inicia sesión para continuar'}};
    const r=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.data.session.access_token},body:JSON.stringify(body)});
    const x=await r.json(); return r.ok ? x : {data:null,error:{message:x.error || 'Error al guardar'}};
  } catch { return {data:null,error:{message:'No se pudo conectar. Reintenta antes de cerrar.'}}; }
}
class Query {
  constructor(resource){this.body={resource,action:'select',filters:[],orders:[]};}
  select(){return this;}
  eq(key,value){this.body.filters.push({key,value});return this;}
  order(key,options={}){this.body.orders.push({key,ascending:options.ascending!==false});return this;}
  insert(values){this.body.action='insert';this.body.values=values;return this;}
  update(values){this.body.action='update';this.body.values=values;return this;}
  upsert(values){this.body.action='upsert';this.body.values=values;return this;}
  delete(){this.body.action='delete';return this;}
  single(){this.body.single=true;return this;}
  then(resolve,reject){return request(this.body).then(resolve,reject);}
}
const storageError = async()=>({data:null,error:{message:'Archivos privados pendientes de migrar. La carga no está disponible en esta vista previa.'}});
export const clinicalClient={
  from:resource=>new Query(resource),
  storage:{from:()=>({upload:storageError,list:storageError,createSignedUrl:storageError})},
  auth:{
    getSession:session,
    onAuthStateChange(fn){listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};},
    async signInWithPassword(values){if(!auth)return unavailable();try{const r=await auth.signIn.email(values);if(!r.error)await notify();return r;}catch{return unavailable();}},
    async signUp({email,password,options}){
      if(!auth)return unavailable();
      try{const r=await auth.signUp.email({email:email.trim().toLowerCase(),password,name:options?.data?.full_name?.trim() || email.split('@')[0]});
      if(r.error) return {error:{...r.error,message:r.error.message || 'No se pudo crear la cuenta. Comprueba el correo y la contraseña.'}};
      try { sessionStorage.setItem('psicovida_pending_profile',JSON.stringify({email,values:options.data})); } catch {}
      // Registration must not be reported as failed when fetching the optional session fails.
      try { await notify(); } catch {}
      return {data:r.data,error:null};
      }catch(e){return unavailable(e instanceof Error ? `Error de conexión al registrar: ${e.message}` : 'Error de conexión al registrar.');}
    },
    async signInWithOAuth({provider,options}){if(!auth)return unavailable();try{return await auth.signIn.social({provider,callbackURL:options.redirectTo});}catch{return unavailable();}},
    async signOut(){if(!auth)return unavailable();const r=await auth.signOut();if(!r.error)listeners.forEach(fn=>fn('SIGNED_OUT',null));return r;}
  }
};
export async function savePendingProfile(userId,email){
  const pending=sessionStorage.getItem('psicovida_pending_profile');
  if(!pending)return;
  const profile=JSON.parse(pending);if(profile.email.toLowerCase()!==email.toLowerCase())return;
  const r=await clinicalClient.from('profiles').upsert({...profile.values,user_id:userId});
  if(!r.error)sessionStorage.removeItem('psicovida_pending_profile');
  return r;
}
