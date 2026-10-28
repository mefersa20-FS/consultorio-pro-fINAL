# Activación de suscripción con Izipay

La creación de cuentas está protegida en dos niveles: el cliente verifica el pago antes de mostrar el formulario y un trigger de Neon Auth rechaza altas nuevas o cambios de correo si no existe una suscripción pagada y vigente para ese correo. El trigger está aplicado a la rama Neon `migracion-sin-supabase`.

## Variables de entorno en Vercel

Configurar en Preview para probar y en Production cuando esté validado:

- `IZIPAY_PAYMENT_LINK`: enlace HTTPS de checkout de Izipay.
- `IZIPAY_HASH_KEY`: clave Hash del comercio, solo servidor; nunca usar una variable `VITE_*`.
- `IZIPAY_MERCHANT_CODE`: código del comercio que debe coincidir con la notificación firmada.
- `IZIPAY_EXPECTED_AMOUNT`: importe exacto cobrado por el enlace, expresado como número decimal en la moneda del comercio.
- `IZIPAY_CURRENCY`: moneda exacta del enlace, por ejemplo `PEN`.
- `IZIPAY_ENVIRONMENT`: `sandbox` o `live`.

Si falta una variable obligatoria o el importe/moneda no coincide, el webhook no activa la suscripción.

## Notificaciones de Izipay

Configurar en el producto de Izipay una URL de notificación (IPN) que apunte al despliegue correspondiente:

- Producción: `https://consultorio-psicovida.vercel.app/api/izipay/webhook`
- Vista previa: usar el dominio de preview activo para la rama, solo si el comercio permite configurar notificaciones de prueba.

El endpoint valida la firma HMAC-SHA256 de `payloadHttp` con `IZIPAY_HASH_KEY`, compara comercio, importe, moneda y correo, y registra el pago en `billing_transactions` y `billing_subscriptions`. El endpoint de verificación solo acepta una suscripción activa cuyo período no haya vencido.

**Importante:** confirma con Izipay que el producto Link de Pago contratado permite configurar la notificación IPN y que envía los campos descritos por su documentación. Si el enlace del Panel de Comercio no ofrece IPN, la activación automática no funcionará con ese enlace; se debe usar el checkout/API de Izipay que admita `urlIPN`. No se debe activar a partir de la URL de retorno ni de una captura de pago.

## Alcance de la suscripción

El código trata cada pago exitoso como un mes de acceso desde la fecha de confirmación. Un enlace de pago único no implica cobro recurrente automático. Las renovaciones requieren otro pago confirmado, salvo que se implemente y habilite un producto recurrente de Izipay.
