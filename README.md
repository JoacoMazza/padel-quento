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

Las personas se modelan en tres tablas: `accounts` guarda las credenciales de acceso (email, hash de la contraseña, bloqueo), y cada cuenta pertenece a un administrador (`admins`) o a un jugador; el rol de la sesión se deduce de cuál de los dos tiene asociado. Los turnos se registran sobre `bookers` (quien reserva, identificado por su teléfono: `bookings.booker_phone_number` → `bookers.phone_number`). `Player` hereda de `Booker`; como TypeORM solo soporta herencia en una única tabla, los jugadores se guardan en `bookers` (columna `type = 'Player'`) junto con su `account_id`, `category` y `scoring`. Para reservar turnos hace falta ser jugador con cuenta: un booker sin cuenta no puede reservar ni sumarse a partidos.

## Estructura del proyecto

```
app/                  Rutas y páginas (App Router de Next.js)
  api/auth/           Endpoints de NextAuth
  landing/            Página de inicio pública: info del complejo y funcionalidades
  login/, register/   Páginas de autenticación
  bookings/           Turnos disponibles: grilla de canchas/horarios y reserva
  my-bookings/        Mis turnos: próximos/anteriores, filtros y cancelación
  open-matches/       Partidos abiertos: listado y detalle para sumarse ([bookingId])
  components/         Componentes de UI compartidos (header, footer, shell de página, menú de usuario, logo)
    ui/               Piezas visuales reutilizables (encabezado de página, avatar, tag de cancha, KPIs, campo de contraseña)
  globals.css         Tokens de color y clases de componentes (`card`, `btn-*`, `chip`, `badge-*`, `field`, ...)
src/
  entities/           Entidades de TypeORM (Account, Admin, Player, Booker, Court, Booking, Schedule, OutOfService, FixedBooking, ...)
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

## Reseñas y reputación de los jugadores

Después de un partido abierto, cada jugador que asistió puede calificar a sus compañeros que también asistieron (HU-36), hasta 48 horas después de terminado: si su nivel coincide con la categoría que declaró (más bajo / acorde / más alto), si tuvo buena actitud y si llegó a horario, más un comentario opcional. Al terminar el partido se los invita con un aviso, y la calificación se hace desde "Mis turnos".

- La reputación se muestra en porcentajes (puntualidad, buena actitud, nivel acorde) desde las 3 reseñas, en el detalle de los partidos abiertos y en el perfil del propio jugador. Es anónima: los jugadores no ven quién dijo qué.
- El admin ve en la ficha del jugador la reputación, alertas cuando algo baja del 70% y cada reseña con su comentario y quién la dejó. Desde ahí puede cambiarle la categoría o descontarle puntos con un motivo.
- Las reseñas no tocan los puntos de fidelidad. La tabla es `player_reviews` (una fila por reseña, una por compañero y partido).

## Acceso sin sesión

La landing (`/`), los turnos (`/bookings`) y los partidos abiertos (`/open-matches`) se pueden ver sin iniciar sesión (ver `proxy.ts`). El login se pide recién al reservar o sumarse a un partido: el visitante va a `/login` y, al volver, encuentra elegido el turno que había seleccionado. Las rutas personales (`/my-bookings`, `/profile`, `/chats/*`) y las de admin siguen protegidas, y el admin con sesión sigue encerrado en su panel.

- `createBooking` y `joinOpenMatch` toman el jugador de la sesión, nunca del id que manda el cliente; la lógica que recibe el id vive en [src/lib/bookings.ts](src/lib/bookings.ts) y solo se usa desde el servidor.
- La grilla pública usa `getPublicBookings` ([src/lib/public-bookings.ts](src/lib/public-bookings.ts)), sin datos de quién reservó ni de quiénes juegan, y los partidos abiertos se muestran a los visitantes sin nombres ni chat.
- El WhatsApp de contacto de la landing está en [app/components/club-info.ts](app/components/club-info.ts) (`CLUB_WHATSAPP_NUMBER`).

## Turnos fijos

Los turnos fijos (HU-41) los gestiona solo el administrador, desde la **Turnera Global** del panel (botón **Registrar turno fijo**, con el listado de turnos fijos debajo de la grilla, donde se ven en azul): una cancha reservada para el mismo titular todas las semanas o cada dos semanas, a la misma hora, con fecha de fin opcional. El titular puede ser un jugador registrado o alguien sin cuenta (nombre, apellido y teléfono).

- Cada fecha se reserva como un turno común en `bookings`, así que la web y el bot de WhatsApp la ven ocupada sin cambios. Los jugadores solo ven el horario como reservado; el titular, si tiene cuenta, la ve en "Mis turnos" como turno fijo, sin poder cancelarla.
- Se reservan las fechas de los próximos 6 meses y un proceso en segundo plano ([src/jobs/fixed-booking-extension.ts](src/jobs/fixed-booking-extension.ts)) va generando las siguientes. Si una fecha ya estaba ocupada (otro turno o un bloqueo de la cancha), se saltea y el admin la ve.
- El admin puede liberar una sola fecha (desde el listado de turnos fijos o tocando el turno en la grilla), restaurarla si el horario sigue libre, o dar de baja el turno fijo completo, que cancela todas sus fechas futuras. No se penaliza a nadie y se le avisa al titular.
- Las tablas son `fixed_bookings` y `fixed_booking_dates` (una fila por fecha generada, con su estado y su turno).

## Configuración del proyecto

### Requisitos previos

- Node.js 24+ (Vitest 5 y jsdom, usado en los tests de componentes, no soportan Node 20)
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
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Servidor SMTP para los avisos por correo (opcional) |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_TEMPLATE_LANGUAGE` | Credenciales de WhatsApp Cloud API (Meta) para los avisos por WhatsApp (opcional) |

### Avisos a los jugadores (correo y WhatsApp)

Se avisa a los jugadores (ver [src/lib/match-notifications.ts](src/lib/match-notifications.ts)) cuando:

- se cancela su turno porque la cancha queda fuera de servicio (bloqueo) o se da de baja (en ese caso se cancelan sus turnos futuros);
- alguien se suma o se baja de un partido abierto del que forman parte (si se baja a menos de 3 horas, sin ofrecer su lugar);
- el partido se completa: en ese caso se avisa a todos, incluido quien se sumó último (HU-17);
- quien armó el partido lo cancela (HU-19) o lo cierra para no sumar más jugadores;
- el partido se cancela solo por no completar el cupo a tiempo.

Salvo cuando el partido se completa, no se le avisa a quien provocó el cambio. Cada canal se activa solo si están cargadas sus variables; sin ninguna, en desarrollo los avisos se muestran por consola y en tests no se envía nada. Un aviso que falla nunca hace fallar la operación que lo originó.

WhatsApp no permite mandar texto libre en mensajes que inicia el club, así que usa estas plantillas, que hay que crear (categoría *Utility*, idioma `es_AR`) y tener aprobadas en el WhatsApp Manager de Meta:

| Plantilla | Texto |
| --- | --- |
| `quento_turno_cancelado` | Hola {{1}}, tu turno del {{2}} a las {{3}} en la cancha {{4}} fue cancelado porque la cancha no va a estar disponible. No se aplicó ninguna penalización. |
| `quento_jugador_se_sumo` | Hola {{1}}, {{2}} se sumó al partido del {{3}} a las {{4}} en la cancha {{5}}. Lugares libres: {{6}}. |
| `quento_jugador_se_bajo` | Hola {{1}}, {{2}} se bajó del partido del {{3}} a las {{4}} en la cancha {{5}}. Lugares libres: {{6}}. |
| `quento_jugador_se_bajo_tarde` | Hola {{1}}, {{2}} se bajó a último momento del partido del {{3}} a las {{4}} en la cancha {{5}}. |
| `quento_partido_cancelado` | Hola {{1}}, {{2}} canceló el partido del {{3}} a las {{4}} en la cancha {{5}}. No se aplicó ninguna penalización para vos. |
| `quento_partido_sin_cupo` | Hola {{1}}, el partido del {{2}} a las {{3}} en la cancha {{4}} se canceló porque no se completó el cupo de jugadores. No se aplicó ninguna penalización. |
| `quento_partido_completo` | Hola {{1}}, ¡el partido del {{2}} a las {{3}} en la cancha {{4}} está completo! {{5}} se sumó y ya son 4 jugadores. |
| `quento_partido_cerrado` | Hola {{1}}, el partido del {{2}} a las {{3}} en la cancha {{4}} ya no busca más jugadores. Se juega con los que están anotados. |
| `quento_calificar_companeros` | Hola {{1}}, ¡gracias por venir a jugar con nosotros! Ya podés calificar a tus compañeros del partido del {{2}} en la cancha {{3}} desde Mis turnos. Tenés 48 horas. |
| `quento_turno_fijo_liberado` | Hola {{1}}, liberamos tu turno fijo del {{2}} a las {{3}} en la cancha {{4}}. Tus próximos turnos fijos siguen reservados. |
| `quento_turno_fijo_cancelado` | Hola {{1}}, se dio de baja tu turno fijo de los {{2}} a las {{3}} en la cancha {{4}}. Se cancelaron todas sus próximas fechas. |

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

También crea, si no existen, una cuenta de administrador (`admin@quento.com` / `admin123`, DNI `30111222`: el DNI de los administradores es obligatorio y no se repite) y una de jugador (`jugador@quento.com` / `jugador123`).

Para tener datos con los que revisar las métricas de ocupación del panel admin, hay un seed aparte de turnos (requiere haber corrido antes `pnpm db:seed`):

```bash
pnpm db:seed:bookings
```

Genera turnos de 90 minutos desde 90 días antes hasta 30 días después de la fecha en que se ejecuta, con más demanda a la tarde-noche y los fines de semana. Los pasados quedan pagos (con algunas inasistencias) o cancelados, y con los puntos de asistencia ya procesados; los futuros, reservados. Los turnos se reparten entre los jugadores de la base, y además crea, si no existen, 6 jugadores de ejemplo (`seed.jugador1@quento.com` a `seed.jugador6@quento.com` / `jugador123`). Solo completa los días que no tienen turnos cargados: correrlo de nuevo no agrega turnos, salvo en los días nuevos si cambió la fecha.

> Si tu base de desarrollo es anterior a la división de `users` en `accounts`/`admins`/`bookers`, `synchronize` no migra los datos (crea las tablas nuevas vacías y deja `users` huérfana). Lo más simple es recrearla (`docker compose down -v && docker compose up -d`), levantar la app una vez (`pnpm dev`) para que `synchronize` cree las tablas y recién ahí correr el seed: el seed usa la `DataSource` de CLI, que no sincroniza el esquema, así que sobre una base vacía falla con `no existe la relación «courts»`. Las bases gestionadas con migraciones conservan sus datos: `SplitUsersIntoAccounts` los copia de `users` a las tablas nuevas.

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
pnpm db:seed:bookings                                    # crea turnos de ejemplo alrededor de la fecha actual, para las métricas
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
