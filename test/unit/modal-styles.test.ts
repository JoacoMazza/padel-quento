import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_DIR = path.resolve(__dirname, "../../app");

function cssRule(selector: string): string {
  const css = readFileSync(path.join(APP_DIR, "globals.css"), "utf8");
  const match = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`No se encontró la regla ${selector}`);
  return match[1];
}

describe("Estilos de los modales", () => {
  it("el panel de un modal no pasa del alto visible de la pantalla y scrollea por dentro", () => {
    const rule = cssRule(".modal-panel");

    expect(rule).toContain("max-h-[90dvh]");
    expect(rule).toContain("overflow-y-auto");
  });

  // The backdrops render inside space-y-* containers, whose margin-bottom shrank the
  // fixed inset-0 overlay and left an undimmed strip at the bottom of the screen.
  it("el fondo .modal-backdrop anula el margen que le agregan los contenedores space-y", () => {
    // ! because space-y-* lives in the utilities layer, which beats the components layer.
    expect(cssRule(".modal-backdrop")).toContain("m-0!");
  });

  it("todo fondo de modal fixed inset-0 escrito a mano anula el margen de los contenedores space-y", () => {
    const files = readdirSync(APP_DIR, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".tsx"));

    const withMargin = files.flatMap((file) =>
      [...readFileSync(path.join(APP_DIR, file), "utf8").matchAll(/className="([^"]*\bfixed inset-0\b[^"]*)"/g)]
        .filter(([, classes]) => !classes.split(" ").includes("m-0"))
        .map(() => file),
    );
    expect(withMargin).toEqual([]);
  });

  it("ningún modal limita su alto con vh, que en el celular incluye la barra del navegador", () => {
    const files = readdirSync(APP_DIR, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".tsx"));

    const withVh = files.filter((file) => readFileSync(path.join(APP_DIR, file), "utf8").includes("max-h-[90vh]"));
    expect(withVh).toEqual([]);
  });
});
