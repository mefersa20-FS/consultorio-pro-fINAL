import { randomUUID } from 'node:crypto';
import { requireUser, database, fail } from '../lib/neon-server.js';
import { validateRequest } from '../lib/data-request.js';

export function createHandler({authenticate=requireUser, connect=database}={}) { return async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const user = await authenticate(req);
    const b = validateRequest(req.body, user.id);
    const sql = connect(), args = [user.id, b.resource];
    let where = 'owner_id = $1 AND resource = $2';
    for (const f of b.filters) {
      if (f.key === 'user_id') continue;
      args.push(String(f.value));
      where += ` AND ${f.key === 'id' ? 'id' : f.key === 'created_at' ? 'created_at::text' : `data->>'${f.key}'`} = $${args.length}`;
    }
    let rows;
    if (b.action === 'select') {
      const order = b.orders.map(o => `${o.key === 'created_at' ? 'created_at' : `data->>'${o.key}'`} ${o.ascending === false ? 'DESC' : 'ASC'}`).join(', ');
      rows = await sql.query(`SELECT * FROM clinical_documents WHERE ${where}${order ? ' ORDER BY ' + order : ''} LIMIT 10000`, args);
    } else if (b.action === 'delete') {
      rows = await sql.query(`DELETE FROM clinical_documents WHERE ${where} RETURNING *`, args);
    } else if (b.action === 'update') {
      args.push(JSON.stringify(b.values));
      rows = await sql.query(`UPDATE clinical_documents SET data = data || $${args.length}::jsonb, updated_at = now() WHERE ${where} RETURNING *`, args);
    } else {
      const id = b.resource === 'profiles' ? user.id : randomUUID();
      const patientId = ['clinical_records','appointments','therapy_sessions'].includes(b.resource) ? String(b.values.patient_id) : null;
      if (patientId) {
        const owned = await sql.query("SELECT id FROM clinical_documents WHERE owner_id = $1 AND resource = 'patients' AND id = $2 LIMIT 1", [user.id, patientId]);
        if (!owned.length) return res.status(400).json({error:'El paciente no existe en tu cuenta'});
      }
      let conflict = '';
      if (b.action === 'upsert') conflict = b.resource === 'profiles'
        ? 'ON CONFLICT (owner_id, resource, id) DO UPDATE SET data = clinical_documents.data || EXCLUDED.data, updated_at = now()'
        : "ON CONFLICT (owner_id, patient_id, (data->>'form_type')) WHERE resource = 'clinical_records' DO UPDATE SET data = EXCLUDED.data, updated_at = now()";
      rows = await sql.query(`INSERT INTO clinical_documents(owner_id,resource,id,data) VALUES($1,$2,$3,$4::jsonb) ${conflict} RETURNING *`, [user.id,b.resource,id,JSON.stringify(b.values)]);
    }
    const result = rows.map(r => ({ ...r.data, id:r.id, user_id:r.owner_id, created_at:r.created_at, updated_at:r.updated_at }));
    if (b.single && result.length !== 1) return res.status(404).json({ error:'Registro no encontrado' });
    return res.status(200).json({ data:b.single ? result[0] : result });
  } catch (e) { return fail(res,e); }
};
}
export default createHandler();
