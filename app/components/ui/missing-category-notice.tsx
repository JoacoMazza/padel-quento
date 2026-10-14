import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Aviso de los paneles oscuros de partidos abiertos para quien todavía no cargó
 * su categoría: crear o sumarse a un partido abierto la requiere, así que se lo
 * manda a completarla en su perfil.
 */
export function MissingCategoryNotice({ message }: { message: string }) {
  return (
    <div className="space-y-3 rounded-xl bg-white/5 px-4 py-3 text-sm">
      <p className="font-medium text-white/80">{message}</p>
      <Link href="/profile" className="btn w-full bg-white text-ink hover:bg-white/90">
        Completar mi perfil
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
