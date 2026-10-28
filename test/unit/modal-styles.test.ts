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

  it("ningún modal limita su alto con vh, que en el celular incluye la barra del navegador", () => {
    const files = readdirSync(APP_DIR, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".tsx"));

    const withVh = files.filter((file) => readFileSync(path.join(APP_DIR, file), "utf8").includes("max-h-[90vh]"));
    expect(withVh).toEqual([]);
  });
});
