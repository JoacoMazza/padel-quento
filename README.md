# Quento Padel Club

Sistema de gestión de turnos para el complejo de pádel Quento (City Bell, La Plata). Plataforma web + chatbot de WhatsApp Business sobre base de datos centralizada. Proyecto Final — Ingeniería en Sistemas, UTN FRLP.

## Stack

- [Next.js](https://nextjs.org/) 16 (App Router) + React 19 + TypeScript
- [TypeORM](https://typeorm.io/) sobre PostgreSQL 16
- [NextAuth](https://next-auth.js.org/) para autenticación
- Tailwind CSS 4
- [lucide-react](https://lucide.dev/) para íconos
- [Vitest](https://vitest.dev/) para tests unitarios e de integración
- pnpm como package manager

## Diagramas

### Diagrama de clases

![Diagrama de clases](docs/classes/class_model.png)

El diagrama fuente (editable) se encuentra en [docs/classes/class_diagram.EAP](docs/classes/class_diagram.EAP).

### Diagrama Entidad-Relación (DER)

![DER](docs/der/DER%20Padel%20Quento.png)

El diagrama fuente (editable, draw.io) se encuentra en [docs/der/DER Padel Quento.drawio](docs/der/DER%20Padel%20Quento.drawio).

Los nombres de tablas y columnas en la base de datos siguen este DER (snake_case, ej. `last_names`, `booking_state`, `court_id`). Esto es una convención **solo de la capa de persistencia**: las entidades de TypeORM exponen las mismas propiedades en camelCase de siempre (`lastnames`, `bookingState`, `court`) — el mapeo se declara explícitamente con `name` en cada `@Column`/`@JoinColumn` (ver por ejemplo [src/entities/Booking.ts](src/entities/Booking.ts)). El resto del código (actions, componentes, tests) sigue usando las propiedades TypeScript sin cambios.

## Estructura del proyecto

```
app/                  Rutas y páginas (App Router de Next.js)
  api/auth/           Endpoints de NextAuth
  login/, register/   Páginas de autenticación
  bookings/           Turnos disponibles: grilla de canchas/horarios y reserva
  my-bookings/        Mis turnos: próximos/anteriores, filtros y cancelación
  components/         Componentes de UI compartidos (header, menú de usuario, logo)
src/
  entities/           Entidades de TypeORM (User, Player, Court, Booking, Schedule, OutOfService)
  domain/             Enums y tipos de dominio
  actions/            Server Actions con CRUD básico por entidad (incluye validación de solapamiento en reservas)
  lib/                Infraestructura (conexión a DB en runtime, DataSource de CLI, auth, validaciones)
  migrations/         Migraciones de TypeORM
scripts/              Scripts de mantenimiento (seed de datos)
test/
  unit/               Tests unitarios (no requieren base de datos)
  integration/        Tests de integración (requieren Postgres levantado)
docs/
  classes/            Diagrama de clases (imagen + fuente editable)
  der/                Diagrama Entidad-Relación (imagen + fuente editable)
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

En desarrollo y en los tests, el esquema se sincroniza automáticamente contra las entidades de TypeORM al iniciar la app (`synchronize` está habilitado fuera de producción), por lo que no hace falta correr migraciones para trabajar localmente.

En producción (o en cualquier entorno donde `synchronize` esté deshabilitado) el esquema se provee con migraciones — ver la sección siguiente.

### 4. Migraciones

Las migraciones usan la CLI de TypeORM contra una `DataSource` dedicada ([src/lib/data-source.ts](src/lib/data-source.ts)), separada de la conexión que usa la app en runtime ([src/lib/db.ts](src/lib/db.ts)). Esta `DataSource` de CLI tiene `synchronize: false` siempre, así las migraciones reflejan cambios reales de esquema y no una sincronización automática.

```bash
pnpm migration:run                                    # aplica las migraciones pendientes
pnpm migration:revert                                 # revierte la última migración aplicada
pnpm migration:show                                   # lista migraciones aplicadas/pendientes
pnpm migration:generate src/migrations/NombreDelCambio # genera una migración a partir del diff entidades vs. base de datos
pnpm migration:create src/migrations/NombreDelCambio   # crea una migración vacía para escribir a mano
```

> **En tu base de datos de desarrollo local no hace falta correr `pnpm migration:run`.** Como el esquema ya se creó por `synchronize`, aplicar la migración inicial fallaría porque las tablas ya existen. Las migraciones están pensadas para bases de datos nuevas (producción, CI, la máquina de un compañero que recién clona el repo).

Al modificar una entidad, generar la migración correspondiente para que quede versionada:

```bash
pnpm migration:generate src/migrations/AgregarCampoX
```

### 5. Datos de ejemplo (seed)

```bash
pnpm db:seed
```

Crea, si no existen, 8 canchas numeradas del 1 al 8, cada una con un horario de 09:00 a 23:00 los 7 días de la semana. El script es idempotente: correrlo de nuevo no duplica canchas ni horarios ya creados, y no modifica canchas u horarios que ya existan (por ejemplo, si una cancha está en mantenimiento, el seed no le toca el estado).

## Comandos importantes

### Desarrollo

```bash
pnpm dev        # Levanta la app en http://localhost:3000
pnpm build      # Build de producción
pnpm start      # Sirve el build de producción
pnpm lint       # Linter (ESLint)
```

### Migraciones y seed

```bash
pnpm migration:generate src/migrations/NombreDelCambio  # genera una migración a partir del diff entidades vs. BD
pnpm migration:create src/migrations/NombreDelCambio    # crea una migración vacía
pnpm migration:run                                      # aplica las migraciones pendientes
pnpm migration:revert                                   # revierte la última migración aplicada
pnpm migration:show                                     # lista migraciones aplicadas/pendientes
pnpm db:seed                                             # crea 8 canchas con horario 09-23hs todos los días (idempotente)
```

Ver [Migraciones](#4-migraciones) y [Datos de ejemplo (seed)](#5-datos-de-ejemplo-seed) para más detalle.

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
