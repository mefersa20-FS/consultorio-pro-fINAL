import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/data.js';
import { validateRequest } from '../lib/data-request.js';
const response=()=>({headers:{},code:0,setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('all data operations deny an unauthenticated caller before connecting',async()=>{
 const res=response(); await createHandler({connect:()=>{throw Error('must not connect');}})({method:'POST',headers:{},body:{resource:'patients',action:'select'}},res);assert.equal(res.code,401);
});
for(const action of ['select','update','delete']) test(`${action} always binds verified owner, even without a browser owner filter`,async()=>{
 let query;const res=response();
 await createHandler({authenticate:async()=>({id:'owner-a'}),connect:()=>({query:async(...args)=>{query=args;return [];}})})({method:'POST',headers:{},body:{resource:'patients',action,filters:action==='select'?[]:[{key:'id',value:'patient-of-b'}],values:{name:'x'}}},res);
 assert.equal(res.code,200);assert.match(query[0],/WHERE owner_id = \$1 AND resource = \$2/);assert.equal(query[1][0],'owner-a');assert.ok(!query[0].includes('patient-of-b'));
});
test('insert overrides ownership with the verified subject',async()=>{
 let query;const res=response();await createHandler({authenticate:async()=>({id:'owner-a'}),connect:()=>({query:async(...args)=>{query=args;return [];}})})({method:'POST',headers:{},body:{resource:'patients',action:'insert',values:{name:'Fictional'}}},res);
 assert.equal(query[1][0],'owner-a');assert.match(query[1][2],/^[0-9a-f-]{36}$/);
});
test('rejects ownership spoofing, privilege escalation, SQL injection and mass mutation',()=>{
 const base={resource:'patients',action:'select'};
 for(const body of [
 {...base,filters:[{key:'user_id',value:'b'}]},
 {...base,filters:[{key:"name') OR true --",value:'x'}]},
 {...base,orders:[{key:'id; DROP TABLE x'}]},
 {...base,action:'delete'},
 {...base,action:'insert',values:{name:'x',user_id:'b'}},
 {resource:'profiles',action:'upsert',values:{role:'admin'}},
 {resource:'user_integrations',action:'select'},
 {resource:'clinical_records',action:'insert',values:{form_type:'x'}},
 {...base,filters:[null]}
 ]) assert.throws(()=>validateRequest(body,'a'),{status:400});
});
test('wrong methods never authenticate or connect',async()=>{
 const res=response();await createHandler({authenticate:()=>{throw Error('unexpected');}})({method:'GET'},res);assert.equal(res.code,405);
});
