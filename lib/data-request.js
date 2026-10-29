const resources = new Set(['patients', 'clinical_records', 'appointments', 'therapy_sessions', 'profiles', 'patient_payments']);
const bad = message => { throw Object.assign(new Error(message), { status: 400 }); };
export function validateRequest(body, owner) {
  if (!body || !resources.has(body.resource)) bad('Recurso no permitido');
  if (!['select','insert','update','upsert','delete'].includes(body.action)) bad('Operación no permitida');
  if (body.resource === 'profiles' && !['select','upsert'].includes(body.action)) bad('Operación de perfil no permitida');
  const filters = body.filters || [];
  if (!Array.isArray(filters) || filters.length > 10) bad('Filtros inválidos');
  for (const f of filters) {
    if (!f || !/^[a-z_]{1,40}$/.test(f.key) || !['string','number'].includes(typeof f.value)) bad('Filtro inválido');
    if (f.key === 'user_id' && f.value !== owner) bad('Propietario inválido');
  }
  if (['update','delete'].includes(body.action) && !filters.some(f => f.key === 'id')) bad('Falta el identificador');
  const orders = body.orders || [];
  if (!Array.isArray(orders) || orders.some(o => !o || !/^[a-z_]{1,40}$/.test(o.key))) bad('Orden inválido');
  const data = body.values;
  if (body.action !== 'select' && body.action !== 'delete') {
    if (!data || Array.isArray(data) || typeof data !== 'object' || JSON.stringify(data).length > 500000) bad('Datos inválidos');
    if (data.user_id && data.user_id !== owner) bad('Propietario inválido');
    if ('id' in data) bad('El identificador lo asigna el servidor');
    if (body.resource === 'profiles' && Object.keys(data).some(k => !['user_id','full_name','age','profession','department','country','phone'].includes(k))) bad('Campo de perfil no permitido');
    if (['insert','upsert'].includes(body.action) && body.resource === 'patients' && !String(data.name || '').trim()) bad('Falta el nombre');
    if (['insert','upsert'].includes(body.action) && ['clinical_records','appointments','therapy_sessions','patient_payments'].includes(body.resource) && !data.patient_id) bad('Falta el paciente');
    if (body.resource === 'clinical_records' && ['insert','upsert'].includes(body.action) && !data.form_type) bad('Falta el formulario');
    if (body.action === 'update' && ('patient_id' in data || 'form_type' in data)) bad('Referencia inmutable');
  }
  if (body.action === 'upsert' && !['clinical_records','profiles'].includes(body.resource)) bad('Reemplazo no permitido');
  return { ...body, filters, orders };
}
