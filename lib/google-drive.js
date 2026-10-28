import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { database } from './neon-server.js';

export function driveConfig(){
  const clientId=process.env.GOOGLE_CLIENT_ID, clientSecret=process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri=process.env.GOOGLE_DRIVE_REDIRECT_URI;
  if(!clientId||!clientSecret||!redirectUri||!process.env.GOOGLE_TOKEN_ENCRYPTION_KEY)
    throw Object.assign(new Error('Falta configurar Google Drive en Vercel: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DRIVE_REDIRECT_URI y GOOGLE_TOKEN_ENCRYPTION_KEY.'),{status:503});
  return {clientId,clientSecret,redirectUri};
}
function key(){const raw=process.env.GOOGLE_TOKEN_ENCRYPTION_KEY||'';try{const b=Buffer.from(raw,'base64');if(b.length===32)return b}catch{}return createHash('sha256').update(raw).digest();}
export function encrypt(value){const iv=Buffer.from(cryptoRandom(12));const c=createCipheriv('aes-256-gcm',key(),iv);const body=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]).toString('base64');}
export function decrypt(value){const b=Buffer.from(value,'base64'),iv=b.subarray(0,12),tag=b.subarray(12,28),body=b.subarray(28);const d=createDecipheriv('aes-256-gcm',key(),iv);d.setAuthTag(tag);return Buffer.concat([d.update(body),d.final()]).toString('utf8');}
function cryptoRandom(n){return globalThis.crypto.getRandomValues(new Uint8Array(n));}
export async function ensureDriveTable(sql=database()){await sql.query(`CREATE TABLE IF NOT EXISTS user_google_drive (user_id text PRIMARY KEY, refresh_token text NOT NULL, email text, connected_at timestamptz NOT NULL DEFAULT now())`);}
export async function getDriveToken(userId){const sql=database();await ensureDriveTable(sql);const rows=await sql.query('SELECT refresh_token FROM user_google_drive WHERE user_id=$1 LIMIT 1',[userId]);if(!rows.length)return null;const {clientId,clientSecret}=driveConfig();const refreshToken=decrypt(rows[0].refresh_token);const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'})});const data=await response.json();if(!response.ok||!data.access_token)throw Object.assign(new Error('Google Drive no pudo renovar el acceso. Vuelve a conectar tu cuenta.'),{status:401});return data.access_token;}
export async function driveApi(userId,path,options={}){const token=await getDriveToken(userId);if(!token)throw Object.assign(new Error('Conecta primero tu Google Drive personal.'),{status:409});const response=await fetch('https://www.googleapis.com/drive/v3/'+path,{...options,headers:{Authorization:'Bearer '+token,...options.headers}});const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(data.error?.message||'Google Drive devolvió un error.'),{status:response.status===401?401:502});return data;}
