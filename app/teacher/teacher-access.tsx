import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { ForbiddenError, UnauthorizedError, requireTeacher } from "@/src/lib/rbac";

/**
 * Verifica contra la base que quien entra sea un profesor activo: el proxy solo
 * mira la sesión, y un profesor que el administrador desactivó no tiene que
 * ver sus secciones aunque su sesión diga lo contrario. Devuelve el motivo del
 * rechazo, o null si puede entrar.
 */
export async function teacherAccessDenied(): Promise<string | null> {
  try {
    await requireTeacher();
    return null;
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) return error.message;
    throw error;
  }
}

export function TeacherAccessDenied({ message }: { message: string }) {
  return (
    <div className="card mx-auto max-w-lg space-y-4 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-light text-danger">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <p className="text-sm text-foreground/70">{message}</p>
      <Link href="/" className="btn btn-primary">
        Volver al Inicio
      </Link>
    </div>
  );
}
