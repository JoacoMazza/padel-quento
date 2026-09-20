@AGENTS.md

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
- `node_modules/next/dist/docs/`: documentación de la versión de Next.js instalada (ver AGENTS.md).

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

### Tests

- **Si se modifica lógica** (actions, validaciones, auth, entidades, reglas de dominio), correr **todos los tests** (`pnpm test:all`, con la DB de test levantada vía `pnpm test:integration:db:up`) para verificar que nada se rompió. No alcanza con correr solo los tests del archivo tocado.
- **Al crear una nueva feature**, crear también tests nuevos que validen sus funciones: unitarios en `test/unit/` y, si toca la base de datos, de integración en `test/integration/` (`*.integration.test.ts`).
- **Siempre que se pida una feature o un fix**, crear o modificar primero los tests necesarios; esos tests deben pasar al terminar. Seguir el flujo de la skill `test-first-workflow` (`.claude/skills/test-first-workflow/SKILL.md`).
- **El código escrito para pasar los tests debe ser el mínimo posible**: sin funcionalidad especulativa, abstracciones ni refactors que los tests no requieran. Si se quiere más comportamiento, primero va su test.
- Nunca borrar ni debilitar un test existente solo para que pase; modificarlo únicamente si cambió el requisito, y avisarlo.
- Un bugfix debe incluir un test que reproduzca el bug.
- No dar una tarea por terminada si hay tests fallando; reportar el resultado real de la ejecución.

### Base de datos

- Los nombres de tablas y columnas siguen el DER (snake_case); las propiedades de las entidades TypeORM siguen en camelCase, mapeadas con `name` en `@Column`/`@JoinColumn`.
- Al modificar una entidad, generar la migración correspondiente (`pnpm migration:generate src/migrations/NombreDelCambio`). No editar migraciones ya aplicadas.
- Si cambia el modelo de datos o de clases, actualizar los diagramas de `docs/` y el README cuando corresponda.

### Código

- Seguir el estilo, nombres y densidad de comentarios del código circundante.
- Antes de escribir código de Next.js, consultar `node_modules/next/dist/docs/` (esta versión tiene breaking changes).
- Correr `pnpm lint` tras cambios significativos.
- Mantener el README actualizado cuando cambien comandos, estructura o configuración.

### Git

- Trabajar en ramas (`feature/*`, `docs/*`, `hotfix/*`), nunca commitear directo a `main`; los cambios entran por pull request.
- Commits con prefijo convencional (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`), en inglés.
