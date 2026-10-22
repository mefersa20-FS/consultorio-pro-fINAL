# PsicoVida

Aplicación React/Vite. Esta rama implementa la migración inicial a Neon y mantiene la versión de producción separada.

Consulta `MIGRACION_SIN_SUPABASE.md` para el estado real, recursos creados, limitaciones y pasos de validación pendientes.

## Desarrollo

Node 24. `npm ci`, copiar `.env.example` a `.env.local` y completar las variables de la rama de prueba. No subir secretos. Ejecutar `npm run dev` para frontend; `/api/data` requiere el runtime de funciones Vercel, no el servidor Vite por sí solo.

- `npm run build`: frontend.
- `npm test`: pruebas sin credenciales; integración se omite.
- `npm run test:integration`: pruebas con Neon desde `.env.local`; utiliza datos sintéticos y rollback.

El esquema versionado está en `db/001_neon.sql` y ya está aplicado al destino de migración. No ejecutar contra otra base sin revisar el destino.
