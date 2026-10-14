"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";

/**
 * Copia al portapapeles el link absoluto de `path` para compartirlo (HU-40). El
 * portapapeles puede estar bloqueado por permisos o no existir (sitio servido
 * sin https): en ese caso se muestra el link para copiarlo a mano.
 */
export function ShareLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  function link() {
    return `${window.location.origin}${path}`;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button type="button" onClick={handleCopy} className="btn btn-outline btn-sm">
        <Link2 className="h-4 w-4" />
        {copied ? "¡Link copiado!" : "Compartir link"}
      </button>
      {copyFailed ? (
        <label className="flex w-full min-w-64 flex-col gap-1 text-xs text-foreground/60">
          No pudimos copiarlo automáticamente. Copiá el link:
          <input
            type="text"
            readOnly
            value={link()}
            onFocus={(event) => event.target.select()}
            className="rounded-full border border-line bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </label>
      ) : null}
    </div>
  );
}
