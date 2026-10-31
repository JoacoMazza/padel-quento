import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { CalendarDays, ShieldAlert } from "lucide-react";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";
import { pageMetadata } from "@/app/site-metadata";
import { authOptions } from "@/src/lib/auth";
import { ForbiddenError, UnauthorizedError, requireTeacher } from "@/src/lib/rbac";

export const metadata = pageMetadata("Mis clases", "/teacher");

/**
 * Sección del profesor (HU-42). El proxy ya deja entrar solo a quien inició
 * sesión como profesor; acá se verifica contra la base, así un profesor que el
 * administrador desactivó deja de verla aunque su sesión diga lo contrario.
 */
export default async function TeacherPage() {
  const session = await getServerSession(authOptions);

  let denied: string | null = null;
  try {
    await requireTeacher();
  } catch (error) {
    if (!(error instanceof ForbiddenError || error instanceof UnauthorizedError)) throw error;
    denied = error.message;
  }

  return (
    <PageShell active="/teacher" user={session?.user ?? null}>
      {denied ? (
        <div className="card mx-auto max-w-lg space-y-4 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-light text-danger">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <p className="text-sm text-foreground/70">{denied}</p>
          <Link href="/" className="btn btn-primary">
            Volver al Inicio
          </Link>
        </div>
      ) : (
        <>
          <PageHeading
            eyebrow="Profesor"
            title="Mis clases"
            description="Tus turnos de clase y tus alumnos."
          />
          <div className="card mt-10 flex flex-col items-center gap-3 p-10 text-center">
            <CalendarDays className="h-8 w-8 text-foreground/40" aria-hidden="true" />
            <p className="text-sm text-foreground/60">Todavía no tenés turnos de clase.</p>
          </div>
        </>
      )}
    </PageShell>
  );
}
