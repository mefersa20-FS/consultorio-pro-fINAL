import { createAuthClient } from '@neondatabase/auth';
const url = import.meta.env.VITE_NEON_AUTH_URL;
const auth = url ? createAuthClient(url) : null;
const listeners = new Set();
const unavailable = () => ({ error:{message:'Acceso Neon pendiente de configurar en esta vista previa'} });
async function session() {
  if (!auth) return {data:{session:null}, ...unavailable()};
  try {
    const r = await auth.getSession();
    if (r.error) return {data:{session:null},error:r.error};
    if (!r.data?.user) return {data:{session:null}};
    const t = await auth.token();
    if (t.error || !t.data?.token) return {data:{session:null},error:t.error || {message:'No se pudo verificar la sesión'}};
    return {data:{session:{user:r.data.user,access_token:t.data.token}}};
  } catch { return {data:{session:null},error:{message:'No se pudo conectar con Neon Auth'}}; }
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
      try{const r=await auth.signUp.email({email,password,name:options.data.full_name});
      if(!r.error){sessionStorage.setItem('psicovida_pending_profile',JSON.stringify({email,values:options.data}));await notify();}return r;}catch{return unavailable();}
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
