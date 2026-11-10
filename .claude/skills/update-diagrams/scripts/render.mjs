// Renders the Mermaid diagrams in docs/ to JPG.
// Usage (from the repo root): node .claude/skills/update-diagrams/scripts/render.mjs [file.mmd ...]
// Without arguments it renders every diagram listed in DIAGRAMS.
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIAGRAMS = ["docs/der/der.mmd", "docs/classes/classes.mmd"];
const MERMAID_CLI = "@mermaid-js/mermaid-cli@11";
const SHARP_CLI = "sharp-cli@5";

const files = process.argv.length > 2 ? process.argv.slice(2) : DIAGRAMS;
const tmp = mkdtempSync(join(tmpdir(), "diagrams-"));

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

try {
  for (const input of files) {
    if (!existsSync(input)) throw new Error(`Diagram not found: ${input}`);
    const png = join(tmp, "diagram.png");
    const jpg = input.replace(/\.mmd$/, ".jpg");

    // mermaid-cli only exports svg/png/pdf, so render a high-res PNG first.
    run(`npx -y ${MERMAID_CLI} -i "${input}" -o "${png}" -b white -s 2 -q`);
    run(`npx -y ${SHARP_CLI} -i "${png}" -o "${jpg}" -f jpeg -q 92 flatten --background "#ffffff"`);
    console.log(`Rendered ${jpg}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
