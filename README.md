# Quento Padel Club

Sistema de gestión de turnos para el complejo de pádel Quento (City Bell, La Plata). Plataforma web + chatbot de WhatsApp Business sobre base de datos centralizada. Proyecto Final — Ingeniería en Sistemas, UTN FRLP.

## Stack

- [Next.js](https://nextjs.org/) 16 (App Router) + React 19 + TypeScript
- [TypeORM](https://typeorm.io/) sobre PostgreSQL 16
- [NextAuth](https://next-auth.js.org/) para autenticación
- Tailwind CSS 4
- [Vitest](https://vitest.dev/) para tests unitarios e de integración
- pnpm como package manager

## Diagrama de clases

![Diagrama de clases](docs/class_model.png)

El diagrama fuente (editable) se encuentra en [docs/class_diagram.EAP](docs/class_diagram.EAP).

## Estructura del proyecto

```
app/                  Rutas y páginas (App Router de Next.js)
  api/auth/           Endpoints de NextAuth
  login/, register/   Páginas de autenticación
  components/         Componentes de UI compartidos
src/
  entities/           Entidades de TypeORM (User, Player, ...)
  domain/             Enums y tipos de dominio
  actions/            Server Actions (ej. registro de jugadores)
  lib/                Infraestructura (conexión a DB, auth, validaciones)
test/
  unit/               Tests unitarios (no requieren base de datos)
  integration/        Tests de integración (requieren Postgres levantado)
docs/                 Documentación y diagrama de clases
```

## Configuración del proyecto

### Requisitos previos

- Node.js 20+
- [pnpm](https://pnpm.io/) 10+ (`corepack enable` es suficiente si ya tenés Node instalado)
- Docker (para levantar Postgres local y de tests)

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Variables de entorno

Copiar el archivo de ejemplo y completar los valores:

```bash
cp .env.example .env
```

Variables relevantes en `.env`:

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión a Postgres (`postgres://usuario:password@localhost:5432/db`) |
| `NEXTAUTH_SECRET` | Secreto usado por NextAuth para firmar sesiones |
| `NEXTAUTH_URL` | URL base de la app (`http://localhost:3000` en desarrollo) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Credenciales usadas por `docker-compose.yml` para levantar Postgres |

Para los tests de integración, copiar también:

```bash
cp .env.test.example .env.test
```

### 3. Levantar la base de datos

Con Docker Compose se levanta un Postgres local usando las credenciales definidas en `.env`:

```bash
docker compose up -d
```

El esquema se sincroniza automáticamente contra las entidades de TypeORM al iniciar la app (`synchronize` está habilitado fuera de producción), por lo que no hace falta correr migraciones manuales en desarrollo.

## Comandos importantes

### Desarrollo

```bash
pnpm dev        # Levanta la app en http://localhost:3000
pnpm build      # Build de producción
pnpm start      # Sirve el build de producción
pnpm lint       # Linter (ESLint)
```

### Tests unitarios

No requieren base de datos:

```bash
pnpm test           # Corre los tests unitarios una vez
pnpm test:watch     # Modo watch
```

### Tests de integración

Requieren una base de datos Postgres de test corriendo (separada de la de desarrollo, en el puerto `5433`):

```bash
pnpm test:integration:db:up     # Levanta Postgres de test (Docker)
pnpm test:integration            # Corre los tests de integración
pnpm test:integration:watch      # Modo watch
pnpm test:integration:db:down   # Apaga y limpia el contenedor de test
```

### Correr toda la suite

```bash
pnpm test:all       # Tests unitarios + de integración
```

> Nota: `pnpm test:all` no levanta la base de datos de test automáticamente — correr `pnpm test:integration:db:up` antes.

## CI

El workflow de GitHub Actions ([.github/workflows/tests.yml](.github/workflows/tests.yml)) corre `pnpm test` y `pnpm test:integration` en cada push a `main`/`hotfix/*`/`release/*` y en cada pull request, levantando Postgres como servicio.
