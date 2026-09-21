<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Quento Padel Club

Sistema de gestión de turnos para el complejo de pádel Quento (City Bell, La Plata): plataforma web + chatbot de WhatsApp Business sobre una base de datos centralizada. Proyecto Final de Ingeniería en Sistemas (UTN FRLP).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- TypeORM sobre PostgreSQL 16
- NextAuth para autenticación (con control de acceso por roles, ver `proxy.ts`)
- Tailwind CSS 4 + lucide-react
- Vitest (tests unitarios e integración)
- pnpm como package manager

## Dónde buscar información

- [README.md](README.md): setup, variables de entorno, migraciones, seed, comandos y CI.
- [docs/](docs/): diagramas del proyecto.
  - `docs/classes/`: diagrama de clases (imagen + fuente `.EAP`).
  - `docs/der/`: Diagrama Entidad-Relación (imagen + fuente draw.io).
- `node_modules/next/dist/docs/`: documentación de la versión de Next.js instalada.

## Estructura

- `app/`: rutas y páginas (App Router) y componentes de UI compartidos.
- `src/entities/`: entidades de TypeORM. `src/domain/`: enums y tipos de dominio.
- `src/actions/`: Server Actions (CRUD y lógica de negocio por entidad).
- `src/lib/`: infraestructura (DB, auth, validaciones). `src/migrations/`: migraciones.
- `test/unit/` (sin DB) y `test/integration/` (requieren Postgres de test).

## Reglas

### Idioma

- **Todo el código va en inglés**: nombres de variables, funciones, clases, entidades, enums, archivos, comentarios, mensajes de commit y nombres de tests.
- **Todo texto de cara al usuario final va en español**: labels, botones, mensajes de error/validación mostrados en la UI, títulos, etc.

### Server Actions (`src/actions/`)

En Next.js App Router las Server Actions no pueden devolver instancias de clases de TypeORM a Client Components (falla por serialización en el boundary RPC). Por eso:

- Toda Server Action debe retornar `Promise<ActionResult<T>>`: `{ success: true, data }` o `{ success: false, error: string }`.
- Usar siempre `toPlain(...)` de `@/src/lib/action-result` al retornar entidades o arrays de TypeORM.
- Los mensajes de error mostrados al usuario van en español; el código y los identificadores, en inglés.

### Tests

- **Si se modifica lógica** (actions, validaciones, auth, entidades, reglas de dominio), correr **todos los tests** (`pnpm test:all`, con la DB de test levantada vía `pnpm test:integration:db:up`) para verificar que nada se rompió. No alcanza con correr solo los tests del archivo tocado.
- **Prerrequisito de los tests de integración**: crear `.env.test` (`cp .env.test.example .env.test`) para apuntar al Postgres de test en el puerto 5433. Sin él, `global-setup.ts` ejecuta `dropSchema: true` sobre la base de datos de desarrollo.
- **Al crear una nueva feature**, crear también tests nuevos que validen sus funciones: unitarios en `test/unit/` y, si toca la base de datos, de integración en `test/integration/` (`*.integration.test.ts`).
- **Siempre que se pida una feature o un fix**, crear o modificar primero los tests necesarios; esos tests deben pasar al terminar. Seguir el flujo de la skill `test-first-workflow` (`.claude/skills/test-first-workflow/SKILL.md`).
- **El código escrito para pasar los tests debe ser el mínimo posible**: sin funcionalidad especulativa, abstracciones ni refactors que los tests no requieran. Si se quiere más comportamiento, primero va su test.
- Nunca borrar ni debilitar un test existente solo para que pase; modificarlo únicamente si cambió el requisito, y avisarlo.
- Un bugfix debe incluir un test que reproduzca el bug.
- No dar una tarea por terminada si hay tests fallando; reportar el resultado real de la ejecución.

### Base de datos

- Los nombres de tablas y columnas siguen el DER (snake_case); las propiedades de las entidades TypeORM siguen en camelCase, mapeadas con `name` en `@Column`/`@JoinColumn`.
- Al modificar una entidad, generar la migración correspondiente (`pnpm migration:generate src/migrations/NombreDelCambio`). No editar migraciones ya aplicadas.
- **Checklist al crear una entidad nueva**:
  1. Exportarla en `src/entities/index.ts` (lo usan `db.ts` y `data-source.ts`).
  2. Registrarla en el array `entities` de `test/integration/global-setup.ts` (de lo contrario la DB de test no crea la tabla y fallan los tests de integración).
  3. Generar la migración (`pnpm migration:generate src/migrations/Nombre`).
  4. Actualizar los diagramas de `docs/`.
- Si cambia el modelo de datos o de clases, actualizar los diagramas de `docs/` y el README cuando corresponda.

### Código

- Seguir el estilo, nombres y densidad de comentarios del código circundante.
- Antes de escribir código de Next.js, consultar `node_modules/next/dist/docs/` (esta versión tiene breaking changes).
- Correr `pnpm lint` tras cambios significativos.
- Mantener el README actualizado cuando cambien comandos, estructura o configuración.

### Git

- Trabajar en ramas (`feature/*`, `docs/*`, `hotfix/*`), nunca commitear directo a `main`; los cambios entran por pull request.
- Commits con prefijo convencional (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`), en inglés.
