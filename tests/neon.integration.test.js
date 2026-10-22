import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database } from '../lib/neon-server.js';
test('Neon FK rejects a clinical record for another professional and rolls back fixtures', {skip:!process.env.DATABASE_URL}, async()=>{
 const sql=database();const ownerA='test-'+randomUUID(),ownerB='test-'+randomUUID(),patient=randomUUID();
 await assert.rejects(sql.transaction([
 sql.query('INSERT INTO clinical_documents(owner_id,resource,id,data) VALUES($1,$2,$3,$4::jsonb)',[ownerA,'patients',patient,JSON.stringify({name:'Synthetic test'})]),
 sql.query('INSERT INTO clinical_documents(owner_id,resource,id,data) VALUES($1,$2,$3,$4::jsonb)',[ownerB,'clinical_records',randomUUID(),JSON.stringify({patient_id:patient,form_type:'test',content:{}})])
 ]),e=>e.code==='23503');
 const rows=await sql.query('SELECT id FROM clinical_documents WHERE owner_id = $1',[ownerA]);assert.equal(rows.length,0);
});
