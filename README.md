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
- Una reseña negativa le descuenta puntos de fidelidad al reseñado: `NEGATIVE_REVIEW_POINTS` (5, en `src/domain/constants.ts`) por cada aspecto negativo (mala actitud, llegar tarde, nivel más bajo o más alto que la categoría declarada), con el motivo "Reseña negativa en partido abierto" en su historial. El saldo nunca baja de 0 (RN-04). La tabla es `player_reviews` (una fila por reseña, una por compañero y partido).

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

## Administradores: dueño y trabajador

Cada administrador tiene un nivel (`admins.access_level`): **dueño** (`owner`) o **trabajador** (`staff`).

- Solo el dueño puede gestionar el equipo (sección **Equipo** del panel: alta, edición y baja de administradores), cambiar precios, dar de alta canchas o darlas de baja, y ver Métricas del Complejo y Reportes de Asistencia. El trabajador maneja la turnera, los turnos y turnos fijos, los bloqueos de canchas y los jugadores.
- El servidor lo exige con `requireOwner()` ([src/lib/rbac.ts](src/lib/rbac.ts)), que lee el nivel de la base en cada acción: un cambio de nivel aplica en el momento. La sesión trae `isOwner` solo para mostrar u ocultar secciones.
- El dueño no puede darse de baja ni cambiarse el nivel a sí mismo. Los administradores creados antes de este cambio quedaron como dueños; los nuevos arrancan como trabajadores.

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
| `DATABASE_SSL_CA` | Certificado de la CA de Supabase, para conectarse por SSL (solo producción, ver [Deploy](#deploy-supabase); vacío en local) |
| `NEXTAUTH_SECRET` | Secreto usado por NextAuth para firmar sesiones |
| `NEXTAUTH_URL` | URL base de la app (`http://localhost:3000` en desarrollo) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Credenciales usadas por `docker-compose.yml` para levantar Postgres |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Servidor SMTP para los avisos por correo (opcional) |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_TEMPLATE_LANGUAGE` | Credenciales de WhatsApp Cloud API (Meta) para los avisos por WhatsApp (opcional) |
| `CRON_SECRET` | Secreto con el que el programador llama a `/api/cron/*` para correr los procesos en segundo plano (solo en Vercel, ver [Deploy en Vercel](#deploy-en-vercel); vacío en local) |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` / `SEED_OWNER_NAMES` / `SEED_OWNER_LASTNAMES` / `SEED_OWNER_DNI` | Dueño que crea `pnpm db:seed:prod` en producción (opcional, ver [Deploy](#deploy-supabase)) |

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

La app **no** crea ni modifica el esquema al levantarse (`synchronize` está deshabilitado siempre): el esquema se crea y se actualiza solo con migraciones, corridas a mano. Con la base recién levantada:

```bash
pnpm migration:run
```

Después de cada `git pull` que traiga migraciones nuevas, volver a correr `pnpm migration:run`.

> Si tu base local se creó antes de este cambio (con `synchronize`), `migration:run` falla porque las tablas ya existen. Recreala: `docker compose down -v && docker compose up -d`, luego `pnpm migration:run` y `pnpm db:seed`.

Los tests de integración no usan migraciones: `test/integration/global-setup.ts` recrea la base de test desde las entidades en cada corrida.

### 4. Migraciones

Las migraciones usan la CLI de TypeORM contra una `DataSource` dedicada ([src/lib/data-source.ts](src/lib/data-source.ts)), separada de la conexión que usa la app en runtime ([src/lib/db.ts](src/lib/db.ts)). Esta `DataSource` de CLI tiene `synchronize: false` siempre, así las migraciones reflejan cambios reales de esquema y no una sincronización automática.

```bash
pnpm migration:run                                    # aplica las migraciones pendientes
pnpm migration:revert                                 # revierte la última migración aplicada
pnpm migration:show                                   # lista migraciones aplicadas/pendientes
pnpm migration:generate src/migrations/NombreDelCambio # genera una migración a partir del diff entidades vs. base de datos
pnpm migration:create src/migrations/NombreDelCambio   # crea una migración vacía para escribir a mano
```

Al modificar una entidad, generar la migración correspondiente (contra tu base local, con todas las migraciones anteriores aplicadas) y aplicarla:

```bash
pnpm migration:generate src/migrations/AgregarCampoX
pnpm migration:run
```

Como la app ya no sincroniza el esquema, un cambio en una entidad sin su migración rompe la app en la base de cualquiera que no la tenga. Por eso [test/integration/migrations.integration.test.ts](test/integration/migrations.integration.test.ts) aplica todas las migraciones sobre una base vacía y falla si el esquema que dejan no es exactamente el que declaran las entidades (incluidos los nombres de foreign keys, índices y uniques: si una relación nueva no declara `foreignKeyConstraintName`, la migración generada usa el nombre que elige TypeORM, y está bien).

### 5. Datos de ejemplo (seed)

```bash
pnpm db:seed
```

Es el seed de desarrollo (para producción ver [Deploy](#deploy-supabase)). Crea, si no existen, 8 canchas numeradas del 1 al 8, cada una con un horario de 09:00 a 23:00 los 7 días de la semana. El script es idempotente: correrlo de nuevo no duplica canchas ni horarios ya creados, y no modifica canchas u horarios que ya existan (por ejemplo, si una cancha está en mantenimiento, el seed no le toca el estado).

También crea, si no existen, una cuenta de administrador dueño (`admin@quento.com` / `admin123`, DNI `30111222`: el DNI de los administradores es obligatorio y no se repite), una de administrador trabajador (`trabajador@quento.com` / `trabajador123`, DNI `35123456`) y una de jugador (`jugador@quento.com` / `jugador123`).

Para tener datos con los que revisar las métricas de ocupación del panel admin, hay un seed aparte de turnos (requiere haber corrido antes `pnpm db:seed`):

```bash
pnpm db:seed:bookings
```

Genera turnos de 90 minutos desde 90 días antes hasta 30 días después de la fecha en que se ejecuta, con más demanda a la tarde-noche y los fines de semana. Los pasados quedan pagos (con algunas inasistencias) o cancelados, y con los puntos de asistencia ya procesados; los futuros, reservados. Los turnos se reparten entre los jugadores de la base, y además crea, si no existen, 6 jugadores de ejemplo (`seed.jugador1@quento.com` a `seed.jugador6@quento.com` / `jugador123`). Solo completa los días que no tienen turnos cargados: correrlo de nuevo no agrega turnos, salvo en los días nuevos si cambió la fecha.

> Los seeds no crean el esquema: sobre una base sin migraciones fallan con `no existe la relación «courts»`. Correr antes `pnpm migration:run`.

## Deploy (Supabase)

La base de producción está en Supabase, en una cuenta compartida por el equipo. Para no romperla:

- **Nadie desarrolla contra la base de producción.** Cada uno trabaja con su Postgres local (Docker). La app local, apuntada a Supabase, también correría contra producción los procesos en segundo plano (vencimiento de partidos, puntos de asistencia, turnos fijos).
- **Las migraciones se corren a mano y solo desde `main`**, después de mergear el PR que las trae. Nunca desde una rama.
- **Nunca correr `pnpm db:seed` ni `pnpm db:seed:bookings` contra producción**: crean cuentas con contraseñas que están en este repo.

El build de producción no minifica el código del servidor (`experimental.turbopackMinify` en [next.config.ts](next.config.ts)): al minificarlo se renombran las clases de las entidades, y TypeORM, que busca las entidades por nombre de clase (relaciones como `@OneToOne("Admin", ...)` y `getRepository("Account")`), deja de encontrarlas y fallan el login y todas las páginas con datos (issue #85). El código del navegador se sigue minificando. `test/unit/next-config.test.ts` falla si se vuelve a activar.

### Configuración en el panel de Supabase

1. **Cadena de conexión:** botón **Connect** → **Session pooler** (puerto 5432). Sirve para todo: la app, las migraciones y los seeds. La conexión directa (`db.<ref>.supabase.co`) solo funciona por IPv6, y el *transaction pooler* (6543) no sirve para migraciones. Si la contraseña tiene caracteres especiales (`@`, `#`, `/`, ...), van codificados (`encodeURIComponent`).
2. **Certificado SSL:** **Database Settings** → **SSL Configuration** → **Download certificate**. Guardarlo como `supabase-ca.crt` en la raíz del repo (no se commitea, ver `.gitignore`). Supabase firma sus certificados con una CA propia, así que sin él la conexión SSL falla (`self-signed certificate in certificate chain`). Con la variable `DATABASE_SSL_CA` la app y la CLI verifican el servidor contra esa CA ([src/lib/db-ssl.ts](src/lib/db-ssl.ts)). No agregar `sslmode` a la URL: pisa esa configuración.
3. **Enforce SSL:** en la misma sección, activar **Enforce SSL on incoming connections**, para que una conexión sin SSL falle en vez de viajar sin cifrar.
4. **Data API:** Supabase expone las tablas de `public` por una API REST a cualquiera con la clave pública del proyecto. La app no la usa, y la migración `RevokeDataApiAccess` les quita los permisos a sus roles (`anon` y `authenticated`) sobre las tablas actuales y futuras. Además se puede apagar desde **Project Settings** → **Data API**.

### Correr comandos contra Supabase

Crear `.env.supabase` en la raíz (no se commitea: `.gitignore` ignora `.env*`):

```bash
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
DATABASE_SSL_CA="$(cat supabase-ca.crt)"

# Solo para el primer deploy (pnpm db:seed:prod); borrarlas después.
SEED_OWNER_EMAIL=
SEED_OWNER_PASSWORD=
SEED_OWNER_NAMES=
SEED_OWNER_LASTNAMES=
SEED_OWNER_DNI=
```

Y correr los comandos dentro de un subshell que la cargue (en Git Bash, en Windows), así las variables no quedan en la terminal y el próximo `pnpm dev` sigue usando la base local:

```bash
(set -a; source .env.supabase; pnpm migration:show)   # ver qué migraciones faltan aplicar
(set -a; source .env.supabase; pnpm migration:run)
```

Las variables de la terminal tienen prioridad sobre las de `.env`.

### Primer deploy

1. Hacer la [configuración en el panel](#configuración-en-el-panel-de-supabase) y crear `.env.supabase`.
2. Aplicar las migraciones: `(set -a; source .env.supabase; pnpm migration:run)`.
3. Cargar los datos iniciales: `(set -a; source .env.supabase; pnpm db:seed:prod)`.

   Crea, si no existen, las 8 canchas con su horario de 09:00 a 23:00 los 7 días (igual que el seed de desarrollo) y la cuenta del dueño con los datos de las variables `SEED_OWNER_*` (sin puntos en el DNI). Sin esas variables, crea solo las canchas. No crea cuentas de prueba. Es idempotente: no duplica canchas ni horarios, y si ya hay una cuenta con ese email no crea el dueño. El resto del equipo (trabajadores) lo da de alta el dueño desde el panel.
4. Deployar la app con estas variables de entorno:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | La del session pooler (paso 1 del panel) |
   | `DATABASE_SSL_CA` | El contenido de `supabase-ca.crt` (ver abajo si el hosting no acepta varias líneas) |
   | `NEXTAUTH_SECRET` | Un secreto nuevo, distinto del de desarrollo (`openssl rand -base64 32`) |
   | `NEXTAUTH_URL` | La URL pública de la app |
   | `SMTP_*` / `WHATSAPP_*` | Las de producción, si se usan los avisos |

   Si el panel del hosting no acepta valores de varias líneas, `DATABASE_SSL_CA` se puede cargar en una sola, con `\n` en lugar de cada salto. Este comando la imprime así:

   ```bash
   awk '{printf "%s%cn", $0, 92}' supabase-ca.crt   # 92 es la barra invertida
   ```

   Los procesos en segundo plano ([instrumentation.ts](instrumentation.ts)) corren mientras el servidor está levantado: en un hosting con `pnpm start` como proceso permanente andan solos. En un hosting serverless como Vercel no, y los corre un programador externo (ver [Deploy en Vercel](#deploy-en-vercel)).

## Deploy en Vercel

Vercel es serverless: levanta la app solo cuando llega un pedido y la apaga después, así que no hay un servidor prendido para los `setInterval` de los procesos en segundo plano (vencimiento de partidos abiertos, puntos por asistencia y extensión de turnos fijos). Por eso:

- En Vercel (variable `VERCEL`, la define la plataforma) `instrumentation.ts` no los arranca.
- Cada proceso tiene un endpoint, `POST /api/cron/<proceso>` (`open-match-expiration`, `attendance-points`, `fixed-booking-extension`), que solo responde con el encabezado `Authorization: Bearer <CRON_SECRET>` ([src/lib/cron.ts](src/lib/cron.ts)).
- Los llama el workflow [.github/workflows/cron.yml](.github/workflows/cron.yml): cada 10 minutos el vencimiento de partidos y los puntos, y cada 6 horas los turnos fijos. GitHub puede atrasar unos minutos los workflows programados. También se puede correr a mano desde la pestaña **Actions** → **Background jobs** → **Run workflow**.
- Cada instancia usa como mucho 2 conexiones a la base ([src/lib/db.ts](src/lib/db.ts)), para no agotar las del session pooler de Supabase.

Pasos:

1. En Vercel, **Add New → Project** e importar el repo de GitHub. Vercel detecta Next.js y pnpm solo (build `pnpm build`).
2. En **Settings → Environment Variables** (entorno *Production*) cargar las variables de la tabla del [primer deploy](#primer-deploy) y además `CRON_SECRET` (un valor nuevo, por ejemplo `openssl rand -base64 32`). `NEXTAUTH_URL` es la URL pública que asigna Vercel (por ejemplo `https://padel-quento.vercel.app`).
3. Deployar. Las migraciones no corren solas: se aplican a mano antes de cada deploy que las necesite (ver [Correr comandos contra Supabase](#correr-comandos-contra-supabase)).
4. En GitHub, **Settings → Secrets and variables → Actions → New repository secret**: `APP_URL` (la misma URL pública) y `CRON_SECRET` (el mismo valor que en Vercel). Sin esos secrets el workflow avisa y no corre nada.

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
pnpm db:seed                                             # desarrollo: 8 canchas con horario 09-23hs y cuentas de prueba (idempotente)
pnpm db:seed:prod                                        # producción: 8 canchas con horario 09-23hs y el dueño de SEED_OWNER_* (idempotente)
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
