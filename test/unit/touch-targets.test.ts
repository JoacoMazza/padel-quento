import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function cssRule(selector: string): string {
  const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
  const match = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`No se encontró la regla ${selector}`);
  return match[1];
}

// En pantallas táctiles (pointer: coarse) los controles chicos miden al menos 44 px, para tocarlos sin errar.
describe("Áreas táctiles", () => {
  it("los botones chicos llegan a 44 px de alto en pantallas táctiles", () => {
    expect(cssRule(".btn-sm")).toContain("pointer-coarse:h-11");
  });

  it("los botones de ícono llegan a 44 × 44 px en pantallas táctiles", () => {
    expect(cssRule(".icon-btn")).toContain("pointer-coarse:size-11");
  });

  it("los chips llegan a 44 px de alto en pantallas táctiles", () => {
    expect(cssRule(".chip")).toContain("pointer-coarse:h-11");
  });

  it("los campos de formulario llegan a 44 px de alto en pantallas táctiles", () => {
    expect(cssRule(".field")).toContain("pointer-coarse:min-h-11");
  });
});
