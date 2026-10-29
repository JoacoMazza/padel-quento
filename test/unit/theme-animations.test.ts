import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

describe("Animaciones del tema", () => {
  it("define animate-slide-down, que despliega un menú de arriba hacia abajo", () => {
    expect(css).toMatch(/--animate-slide-down:\s*slide-down\b/);

    const keyframes = css.match(/@keyframes slide-down\s*\{([\s\S]*?)\n {2}\}/)?.[1] ?? "";
    // Se revela desde el borde de arriba: el recorte de abajo va del 100% al 0%.
    expect(keyframes).toMatch(/from\s*\{[^}]*clip-path:\s*inset\(0 0 100% 0\)/);
    expect(keyframes).toMatch(/to\s*\{[^}]*clip-path:\s*inset\(0\)/);
  });
});
