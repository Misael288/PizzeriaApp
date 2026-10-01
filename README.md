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

## Comandos de desarrollo

```powershell
npm run dev
npm run lint
npm run build
```
