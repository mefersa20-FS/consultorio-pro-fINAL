# PsicoVida · migración a Neon

Estado al 22 de octubre de 2026: implementación inicial probada; NO es un corte de producción.

## Destino creado
- Proyecto Neon: `psicovida-migracion` (`old-frost-86974512`).
- Rama Neon: `migracion-sin-supabase` (`br-floral-base-b70dcd6u`).
- Neon Auth: Managed Better Auth, habilitado.
- Esquema aplicado desde `db/001_neon.sql`: documentos JSONB por recurso, propietario y paciente; claves compuestas impiden referencias entre profesionales; formularios únicos por paciente y tipo.
- La base destino no contiene pacientes reales. No se recuperaron datos del origen.

## Implementado
- React/Vite conserva CSS y logo. Cliente propio para pacientes, expedientes, sesiones y agenda mediante `/api/data`.
- Acceso por correo/contraseña y Google con SDK Neon; manejo de sesión y JWT renovado antes de cada petición de datos.
- API verifica firma EdDSA, issuer, expiración y subject contra JWKS de Neon; asigna propietario desde JWT y restringe cada consulta por ese propietario.
- No se exponen credenciales PostgreSQL al navegador. RLS sin políticas/grants públicos bloquea acceso directo; el servidor usa conexión privilegiada y aplica autorización explícita en cada sentencia.
- Validación de recursos, filtros y operaciones. Los perfiles editables no pueden asignar roles, suscripciones ni privilegios.
- Registro profesional se guarda al obtener sesión autenticada; pendiente temporal en sessionStorage, vinculado al correo.
- Notas locales y biblioteca de texto separadas por usuario. Los antiguos datos locales sin propietario no se reasignan automáticamente.
- IA usa identidad Neon. Pagos, OAuth de calendario y archivos privados devuelven indisponibilidad explícita hasta completar su migración. Google Calendar permanece como acceso externo.
- Dependencia directa y llamadas de red Supabase eliminadas. El SDK Neon puede incluir paquetes de compatibilidad transitivos; no se usan para contactar Supabase.

## Validación realizada
- Build Vite con URL Neon configurada: correcto.
- Pruebas unitarias: autenticación obligatoria, firma/issuer/expiración JWT, propietario en lecturas y mutaciones, bloqueo de suplantación, campos de rol y filtros maliciosos.
- Prueba contra Neon real: clave foránea rechaza expediente de otro profesional; transacción revierte los datos sintéticos.
- Pendiente: pruebas de navegador de registro, correo de verificación, Google, recarga, cierre de sesión y CRUD completo sobre un despliegue protegido.

## Configuración de vista previa
Variables del ejemplo `.env.example`; configurar SOLO para preview y rama Git `migracion-sin-supabase`:
- `DATABASE_URL`: secreto del servidor, nunca `VITE_*`.
- `NEON_AUTH_BASE_URL` y `NEON_AUTH_JWKS_URL`: URLs de la rama.
- `VITE_NEON_AUTH_URL`: URL pública de Auth de la misma rama.

La conexión Vercel devuelve 404 para el proyecto listado `consultorio-psicovida`. CLI sin credenciales. No se modificaron variables ni se creó despliegue. Resolver acceso a Vercel antes de conectar esta rama a una vista previa.

Registrar el origen exacto de esa vista previa en trusted domains de Neon Auth. Configurar OAuth Google propio y SMTP/flujo de verificación antes de producción. No hay claves en este documento.

## Pendiente antes del corte
1. Recuperar exportación legible de pacientes, expedientes, sesiones, citas y archivos del origen. Confirmar si contiene información real.
2. Preparar importador con mapeo explícito entre antiguos IDs de profesional y nuevas identidades Neon. No asociar historias por coincidencia de correo sin verificación. Mantener IDs de pacientes/expedientes y verificar recuentos/integridad.
3. Los accesos/contraseñas/sesiones antiguos no se trasladaron. Validar recuperación o registro y vinculación de cuentas. Asignar rol administrativo por un mecanismo de servidor verificado.
4. Migrar archivos privados, audio/fotos, pagos/webhooks e integración automática de calendario. No presentar estas funciones como operativas.
5. Completar pruebas end-to-end, respaldo y revisión del entorno protegido; después evaluar publicación.

No borrar origen, no modificar main, no promover producción ni garantizar gratuidad indefinida. Revisar consumo del proyecto Neon en su consola.
