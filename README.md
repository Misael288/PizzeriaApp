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

## Categorías y productos

- Visita `/catalog` con una sesión administrativa.
- `ADMIN` puede mantener categorías, productos, disponibilidad y tamaños/presentaciones.
- `CASHIER` solo recibe categorías activas y productos disponibles; todas las mutaciones se limitan a `ADMIN` también desde la API.
- Cada bebida se registra como producto independiente y sus presentaciones/precios como tamaños. Los tamaños se agregan manualmente en el catálogo.
- `ADMIN` importa imagen PNG, JPEG o WebP de hasta 5 MB desde el formulario. El servidor valida la firma del archivo y genera un nombre aleatorio; solo se guarda la ruta en `productos.imagen`. Los archivos locales subidos están excluidos de Git.
- Los productos sin presentaciones usan un precio único. Para un producto con presentaciones, `productos.precio` conserva el menor precio variante como precio base compatible con el esquema actual; los precios que se muestran y utilizan por presentación vienen de `producto_tamanos.precio`.
- Desactivar una categoría o marcar un producto no disponible conserva sus relaciones históricas. No se borran físicamente registros del catálogo.
- El backend valida límites de campos, importes de hasta dos decimales, categoría activa y referencias de tamaño.
- API: `GET/POST /api/catalog/categories`, `PUT /api/catalog/categories/:id`, `GET/POST /api/catalog/products`, `PUT /api/catalog/products/:id`, `GET/POST /api/catalog/sizes` y `POST /api/catalog/images` (ADMIN).
- El diseño carga Bootstrap 5 solo bajo `/catalog`; Tailwind se conserva en las páginas actuales hasta una futura migración global.
- El almacenamiento bajo `public/uploads/products` es adecuado para desarrollo/local. En producción desplegada en instancias efímeras deberá cambiarse por almacenamiento persistente de objetos, por ejemplo un servicio compatible con S3 o Blob Storage.

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
