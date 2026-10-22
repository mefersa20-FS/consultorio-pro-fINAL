# Migración PsicoVida sin Supabase — rama de trabajo

Estado: preparación. NO desplegar a producción hasta completar y verificar los pasos.

## Decisión de arquitectura
- Frontend: conservar React/Vite y el diseño/logotipo actuales.
- Hosting: conservar Vercel, sujeto a límites y condiciones del plan.
- Datos: PostgreSQL administrado independiente de Supabase (por ejemplo Neon); crear proyecto sólo con autorización de la titular y comprobación de costos.
- Autenticación: proveedor independiente compatible con Google OAuth y email/contraseña o enlaces de acceso, configurado del lado servidor. No usar datos de perfil editables para autorizar acceso.
- Backend: endpoints de servidor con sesiones seguras, validación y autorización por propietario/organización.
- Archivos: almacenamiento privado externo con URLs firmadas, o descarga local cifrada cuando corresponda. Nunca guardar expedientes sensibles en localStorage como fuente principal.
- Pagos: mantener desactivados hasta verificar proveedor, importes y webhook.

## Inventario confirmado
- src.jsx: múltiples llamadas a supabase.auth, supabase.from y supabase.storage.
- api/ai/redact.js: verifica el token con Supabase Auth.
- package.json: dependencia @supabase/supabase-js.
- Datos potencialmente existentes en Supabase: perfiles, pacientes, expedientes, sesiones, citas, suscripciones y archivos.

## Fases obligatorias
1. Exportar/copiar datos y archivos del proyecto Supabase pausado antes de cualquier corte; comprobar que el export es legible. Sin acceso a esos datos NO se puede prometer conservación histórica.
2. Crear destino de base de datos y autenticación, configurar credenciales sólo en variables secretas de Vercel. No subir claves a GitHub.
3. Definir esquema con IDs estables y claves de pertenencia; migrar usuarios mediante flujo de restablecimiento/revinculación (no exportar contraseñas).
4. Implementar APIs y permisos multiusuario con pruebas de aislamiento; reemplazar todas las llamadas de Supabase en frontend y backend.
5. Migrar registros/archivos, validar recuentos, integridad y accesos. Confirmar políticas de privacidad y retención.
6. Probar registro Google, registro email, acceso, pacientes, expedientes, agenda, exportación y errores.
7. Desplegar en vista previa; aprobar publicación de producción sólo tras pruebas y respaldo.

## Restricciones
No borrar el proyecto Supabase ni su información; no modificar main ni promover despliegues antes de validación; no afirmar que un proveedor es gratis indefinidamente.
