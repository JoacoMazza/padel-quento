---
name: update-diagrams
description: Use whenever an entity, enum, relation, column or domain method in this project is added, changed or removed (src/entities/, src/domain/enums.ts, migrations), or when asked to update/regenerate the DER or class diagram. Keeps the Mermaid sources in docs/ in sync and re-renders their JPGs.
---

# Update diagrams (Quento Padel Club)

The diagrams are kept as Mermaid, which is the source of truth:

| Diagram | Source | Render |
|---|---|---|
| Entity-Relationship (DER) | `docs/der/der.mmd` (`erDiagram`) | `docs/der/der.jpg` |
| Class diagram | `docs/classes/classes.mmd` (`classDiagram`) | `docs/classes/classes.jpg` |

Never edit the JPGs by hand; always change the `.mmd` and re-render. Both diagrams must be updated in the same change as the entity/migration.

## Steps

1. **Find what changed.** Read the modified entities (`src/entities/*.ts`), enums (`src/domain/enums.ts`) and the generated migration. List the added/removed/renamed tables, columns, keys, relations, enum values and methods.
2. **Update `docs/der/der.mmd`** (database view, snake_case, as in the migration):
   - One block per table, named like the table (`bookings`, `match_players`).
   - Attribute line: `<type> <column> [keys] ["comment"]`. Types: `int`, `string`, `text`, `boolean`, `float`, `decimal`, `date`, `time`, `datetime`, `enum`.
   - Keys: `PK`, `FK`, `UK` (combine as `FK, UK`). Put `"nullable"` in the comment for nullable columns and the precision for decimals (`"decimal(10,2)"`).
   - Composite unique constraints and indexes: comment on the first column (`"UQ (match_id, player_id)"`) and list them in the `%%` header.
   - Relationship: `parent ||--o{ child : "fk_column"`. Derive cardinality from the FK: unique FK → `o|`/`||`; nullable FK → the parent side is `|o`; otherwise `o{`.
3. **Update `docs/classes/classes.mmd`** (domain view, camelCase):
   - Attributes `-name: type`, methods `+name() returnType`. Enums as classes with `<<enumeration>>` and their values.
   - Inheritance `Parent <|-- Child`, composition `Whole *-- "mult" Part`, association `A "mult" -- "mult" B : +role`.
   - Convention: an association end **without** multiplicity means exactly 1; only write it when it differs from 1.
4. **Render** from the repo root (needs Node; downloads `@mermaid-js/mermaid-cli` and `sharp-cli` via `npx` the first time):

   ```bash
   node .claude/skills/update-diagrams/scripts/render.mjs
   # or only one: node .claude/skills/update-diagrams/scripts/render.mjs docs/der/der.mmd
   ```

   If Mermaid reports a parse error, fix the `.mmd` and run again.
5. **Check the result.** Open each JPG and verify every table/class, column and relation is visible and readable (labels not hidden, no missing entities). Keep `layout: elk` in the front matter; it gives the cleanest layout.
6. **Cross-check** that the DER matches the migrations and the class diagram matches the entities (same names, enums, multiplicities). Mention any inconsistency you find instead of silently "fixing" the model.
7. Update the README if the diagram files or their description changed, and commit the `.mmd` together with its `.jpg` (`docs:` prefix if it's a separate commit).
