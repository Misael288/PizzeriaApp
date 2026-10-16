# Sistema de gestión de pizzería

Aplicación Next.js con TypeScript, Prisma y PostgreSQL.

## Requisitos

- Node.js 20.19 o posterior.
- PostgreSQL accesible desde la máquina de desarrollo.
- Una variable `DATABASE_URL` en `.env.local`. Prisma CLI debe recibir la variable en el entorno al ejecutar comandos, ya que no carga `.env.local` automáticamente.

## Configurar la base

`DATABASE_URL` utiliza el formato:

```text
postgresql://USUARIO:CONTRASEÑA@HOST:PUERTO/BASE?schema=public
```

Codifica como URL los caracteres reservados de la contraseña (`@` se escribe `%40`, por ejemplo). No compartas credenciales ni agregues `.env.local` a Git.

En PowerShell, carga la URL de `.env.local` para los comandos Prisma:

```powershell
$entry = Get-Content ".env.local" | Where-Object { $_ -match "^DATABASE_URL=" }
$env:DATABASE_URL = ($entry -replace "^DATABASE_URL=", "").Trim('"')
```

Valida el esquema y añade las tablas de autenticación:

```powershell
npm run prisma:validate
npm run prisma:push
npm run prisma:generate
```

`prisma:push` sincroniza las tablas declaradas en `prisma/schema.prisma`. Revisa cualquier advertencia de Prisma antes de confirmar cambios. No uses `db push --accept-data-loss`.

## Crear las cuentas iniciales

Define en `.env.local` las siguientes variables de bootstrap, con contraseñas fuertes distintas de al menos 14 caracteres y un token aleatorio largo:

```env
BOOTSTRAP_TOKEN=
INITIAL_ADMIN_NAME=
INITIAL_ADMIN_EMAIL=
INITIAL_ADMIN_PASSWORD=
INITIAL_CASHIER_NAME=
INITIAL_CASHIER_EMAIL=
INITIAL_CASHIER_PASSWORD=
```

Reinicia `npm run dev` para cargar estas variables. Desde otra terminal, carga el token en una variable de entorno local sin imprimirlo:

```powershell
$env:BOOTSTRAP_TOKEN = Read-Host "Token de bootstrap"
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/auth/bootstrap" `
  -Headers @{ "x-bootstrap-token" = $env:BOOTSTRAP_TOKEN }
Remove-Item Env:BOOTSTRAP_TOKEN
```

El endpoint crea los roles `ADMIN` y `CASHIER`, así como la cuenta inicial de cada rol. Solo funciona con el token configurado y devuelve conflicto si ya existe un administrador. Tras crear las cuentas, elimina del `.env.local` las variables `BOOTSTRAP_TOKEN` e `INITIAL_*` y reinicia la aplicación.

## Autenticación

- Visita `/login` para iniciar sesión.
- La sesión usa un token aleatorio opaco almacenado como cookie `HttpOnly`, `SameSite=Strict`, con duración de ocho horas.
- La base almacena únicamente el hash del token y permite invalidar sesiones al cerrar sesión.
- `/dashboard` requiere una sesión válida y redirige a `/login` si no existe.
- `/api/auth/me` devuelve la identidad de la sesión; `/api/auth/logout` la invalida.
- Solo `ADMIN` y `CASHIER` pueden iniciar sesión. El menú público y los clientes no requieren cuenta.
- En `/login`, cualquier persona puede solicitar una cuenta con correo y contraseña fuerte. La solicitud queda desactivada con rol `PENDING`; no inicia sesión ni accede a rutas de operación hasta que ADMIN le asigne un rol. La revisión se realiza en `/users`.
- `ADMIN` administra cuentas en `/users`: crea usuarios, cambia su rol, desactiva/reanuda accesos y restablece contraseñas. Las cuentas de cocina no se crean; Caja imprime la comanda. El sistema no permite desactivar al último administrador activo, y los cambios de rol, contraseña o desactivación revocan las sesiones del usuario.

## Categorías y productos

- Visita `/catalog` con una sesión administrativa.
- `ADMIN` puede mantener categorías, productos, disponibilidad y tamaños/presentaciones.
- `CASHIER` consulta el catálogo y puede marcar disponibilidad manual cuando la receta y el stock lo permiten; todas las demás mutaciones del catálogo se limitan a `ADMIN` también desde la API.
- Cada bebida se registra como producto independiente y sus presentaciones/precios como tamaños. Los tamaños se agregan manualmente en el catálogo.
- `ADMIN` importa imagen PNG, JPEG o WebP de hasta 5 MB desde el formulario. El servidor valida la firma del archivo y genera un nombre aleatorio; solo se guarda la ruta en `productos.imagen`. Los archivos locales subidos están excluidos de Git.
- Los productos sin presentaciones usan un precio único. Para un producto con presentaciones, `productos.precio` conserva el menor precio variante como precio base compatible con el esquema actual; los precios que se muestran y utilizan por presentación vienen de `producto_tamanos.precio`.
- Desactivar una categoría o marcar un producto no disponible conserva sus relaciones históricas. No se borran físicamente registros del catálogo.
- El backend valida límites de campos, importes de hasta dos decimales, categoría activa y referencias de tamaño.
- API: `GET/POST /api/catalog/categories`, `PUT /api/catalog/categories/:id`, `GET/POST /api/catalog/products`, `PUT /api/catalog/products/:id`, `GET/POST /api/catalog/sizes` y `POST /api/catalog/images` (ADMIN).
- El diseño carga Bootstrap 5 solo bajo `/catalog`; Tailwind se conserva en las páginas actuales hasta una futura migración global.
- El almacenamiento bajo `public/uploads/products` es adecuado para desarrollo/local. En producción desplegada en instancias efímeras deberá cambiarse por almacenamiento persistente de objetos, por ejemplo un servicio compatible con S3 o Blob Storage.

## Menú y pedidos

- La página `/` muestra el menú público y permite armar un carrito sin iniciar sesión. El servidor vuelve a validar disponibilidad, presentaciones y precios antes de crear el pedido; nunca usa el total enviado por el navegador.
- En checkout, el cliente elige el método de pago previsto. Esa selección no representa pago recibido. Al elegir Transferencia se cargan y muestran los datos configurados por ADMIN en `/payment-settings`; no se incluyen en la carga inicial del menú. El registro del pedido conserva la selección por separado del método confirmado.
- El cliente puede adjuntar o reemplazar un comprobante opcional desde su enlace privado de seguimiento. Se aceptan JPG/PNG/PDF de hasta 5 MB, se valida la firma del archivo y el contenido se guarda fuera de `public/`. Solo ADMIN/Caja puede leerlo. Enviar un comprobante no marca el pedido pagado; Caja registra el pago después de verificar el ingreso bancario o el comprobante.
- El ticket de pago se imprime manualmente desde Caja y desde el seguimiento privado del cliente después de registrar el pago; incluye fecha, método, artículos y total. El cliente también ve un QR de seguimiento al enviar el pedido y en su ticket. El seguimiento del cliente no expone datos personales ni el identificador interno del pedido. La impresión usa el navegador (incluida la opción de guardar como PDF) y no se abre automáticamente.
- El checkout solicita nombre, teléfono y modalidad de entrega; la dirección solo se solicita para entrega a domicilio. No se crea una cuenta de cliente.
- Para conservar la restricción CHECK del esquema PostgreSQL existente, el backend guarda `DOMICILIO` como `Domicilio` y `RECOGER` como `Llevar`; la interfaz vuelve a normalizar esos valores. Los pedidos históricos `Local` se siguen mostrando como consumo local.
- Después de enviar el pedido se entrega una URL privada de seguimiento en `/pedido/seguimiento/<token>` y un QR que codifica esa misma URL. El token es una credencial secreta: compártelo únicamente con el cliente. La base de datos conserva su hash; no se ofrece búsqueda por número de pedido o código predecible.
- Un pedido nuevo queda pendiente de aceptación de Caja. No inicia su ETA ni consume ingredientes hasta confirmarlo. La página pública de seguimiento explica esa espera; después muestra el ETA aproximado y consulta cambios cada 10 segundos y al recuperar el foco/la visibilidad de la pestaña. Cuando Caja registra el pago, esa página muestra el pago y habilita el ticket imprimible.
- `/orders` requiere una sesión ADMIN o CASHIER. Caja confirma o rechaza pedidos, imprime la comanda, registra el pago y avanza estados; la entrega se bloquea hasta registrar el pago. Las alertas y actualizaciones de cola se muestran mientras la pantalla está abierta y consulta cada 20 segundos. La prioridad puede ajustarse mientras el pedido está pendiente o en preparación; prioridad (URGENTE, ALTA, NORMAL) y antigüedad determinan el orden de atención. Solo ADMIN puede ajustar el tiempo global de preparación (1–240 minutos; 15 por defecto).
- `/orders/history` muestra hasta los 100 pedidos más recientes y sus transiciones. `/reports` está restringido a ADMIN y agrega ventas efectivamente cobradas por periodo, método de pago y hasta los 100 cobros más recientes; los pedidos no pagados no cuentan como ventas. Permite seleccionar pedidos visibles y exportarlos a CSV UTF-8 compatible con Excel.
- API: `GET /api/menu`, `POST /api/orders`, `GET /api/orders/track/:token`, `GET /api/orders`, `PATCH /api/orders/:id`, `POST /api/orders/:id/confirm`, `POST /api/orders/:id/payment`, `GET /api/orders/payment-methods`, `GET /api/orders/history`, y `GET/PATCH /api/orders/settings`. La cola y sus cambios requieren sesión; el menú y seguimiento solo exponen datos públicos mínimos.

## Inventario y recetas

- `/inventory` es exclusivo de ADMIN. Registra ingredientes con unidad, stock mínimo y existencia; permite ajustar existencias, consultar los últimos 100 movimientos y asignar cantidades de receta por presentación.
- La disponibilidad efectiva requiere que el producto esté habilitado y cuente con receta aplicable e ingredientes no bloqueados, sobre el stock mínimo y con cantidad suficiente. Al confirmar el pedido, Caja descuenta los ingredientes dentro de la misma transacción y registra movimientos; una cancelación antes de empezar preparación repone ese stock automáticamente. Después de empezar preparación no se repone automáticamente.
- En instalaciones con productos existentes, el inventario inicia sin recetas y no debe asumirse disponibilidad hasta cargar existencias y recetas correctas. Configura `/inventory` antes de aceptar pedidos reales. Una receta general se usa como respaldo cuando una presentación no tiene receta específica.
- Los clientes pueden ver la etiqueta “Agotada” o no ver esos productos según la opción de `/inventory`. El estado manual del producto no puede anular la falta de receta o de stock.

## Comprobantes y despliegue

- Los comprobantes se almacenan en `private/payment-proofs`, excluido de Git y no servido como contenido estático. Las rutas de descarga requieren sesión ADMIN/CASHIER; la carga requiere el token privado de seguimiento y solo funciona en pedidos con Transferencia pendiente. Al reemplazar, se elimina el archivo previo después de confirmar la actualización.
- El almacenamiento local requiere un disco persistente y respaldos protegidos. En despliegues serverless/efímeros se debe configurar almacenamiento privado duradero antes de habilitar comprobantes; no se deben copiar a `public/` ni a un bucket público.

## Actualizar la base de datos

- Los cambios de inventario y operación requieren columnas y tablas nuevas en Prisma. Antes de aplicar en una base existente, ejecuta `npm run prisma:validate` y `npm run prisma:generate`, revisa el SQL de migración contra una copia de la base y respalda los datos. No ejecutes `prisma db push` en producción sin revisión explícita, y nunca uses `--accept-data-loss`.
- La aplicación no crea automáticamente ingredientes ni recetas de ejemplo; deben configurarse con datos reales del negocio. Los métodos de pago se inicializan como Efectivo y Tarjeta cuando aún no existe ninguno.
- Al actualizar el esquema, ejecuta `npm run prisma:validate` y revisa cuidadosamente cualquier cambio antes de `npm run prisma:push`. Las columnas nuevas para pedidos son compatibles con los registros existentes; no uses opciones de pérdida de datos.
- Si aparece `No fue posible completar la operación del pedido.`, revisa la consola del servidor Next.js para el error técnico asociado; el mensaje público no expone detalles de base de datos. Para un rechazo conocido de `tipo_entrega`, el API informa una discrepancia de esquema de forma explícita en lugar del error genérico.

## Comandos de desarrollo

```powershell
npm run dev
npm run lint
npm run build
```

Para instalar Bootstrap después de recibir estos cambios, ejecuta:

```powershell
npm install bootstrap@5.3.8
```
