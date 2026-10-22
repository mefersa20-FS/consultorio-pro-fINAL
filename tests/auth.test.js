import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { requireUser } from '../lib/neon-server.js';
test('JWT verifier checks signature, expiry and issuer',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('EdDSA');const key=await exportJWK(publicKey);key.kid='test';
 const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({keys:[key]}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const previous=[process.env.NEON_AUTH_BASE_URL,process.env.NEON_AUTH_JWKS_URL];
 process.env.NEON_AUTH_BASE_URL='https://auth.test';process.env.NEON_AUTH_JWKS_URL=`http://127.0.0.1:${server.address().port}/jwks`;
 try{
 const token=async(issuer,exp)=>new SignJWT({}).setProtectedHeader({alg:'EdDSA',kid:'test'}).setSubject('professional-a').setIssuer(issuer).setExpirationTime(exp).sign(privateKey);
 const req=t=>({headers:{authorization:'Bearer '+t}});
 assert.deepEqual(await requireUser(req(await token('https://auth.test','5m'))),{id:'professional-a'});
 await assert.rejects(requireUser(req(await token('https://wrong.test','5m'))),{status:401});
 await assert.rejects(requireUser(req(await token('https://auth.test',0))),{status:401});
 await assert.rejects(requireUser(req('forged.token.value')),{status:401});
 }finally{
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 for(const [i,k] of ['NEON_AUTH_BASE_URL','NEON_AUTH_JWKS_URL'].entries())previous[i]===undefined?delete process.env[k]:process.env[k]=previous[i];
 }
});
