export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Server Actions can only return plain objects to Client Components — TypeORM entities
 * are class instances (with a prototype), which Next.js rejects at the RPC boundary.
 * Strips prototypes recursively (including on relations) while preserving Date instances.
 */
export function toPlain<T>(value: T): T {
  if (value === null || value === undefined || value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toPlain(item)) as unknown as T;
  }

  if (typeof value === "object") {
    const plain: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      plain[key] = toPlain((value as Record<string, unknown>)[key]);
    }
    return plain as T;
  }

  return value;
}
