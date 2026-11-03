import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";
import { pageMetadata } from "@/app/site-metadata";
import { authOptions } from "@/src/lib/auth";
import { TeacherAccessDenied, teacherAccessDenied } from "@/app/teacher/teacher-access";
import { TeacherClassesBoard } from "@/app/teacher/teacher-classes-board";
import { getTeacherClasses } from "@/src/actions/teacherClass";

export const metadata = pageMetadata("Mis clases", "/teacher");

/**
 * Sección del profesor (HU-42): sus próximos turnos de clase con los alumnos
 * que registró (HU-44). Solo para profesores activos (ver teacherAccessDenied).
 */
export default async function TeacherPage() {
  const session = await getServerSession(authOptions);
  const denied = await teacherAccessDenied();
  const classesResult = denied ? null : await getTeacherClasses();

  return (
    <PageShell active="/teacher" user={session?.user ?? null}>
      {denied ? (
        <TeacherAccessDenied message={denied} />
      ) : (
        <>
          <PageHeading
            eyebrow="Profesor"
            title="Mis clases"
            description="Tus próximos turnos de clase y los alumnos que registraste."
            actions={
              <Link href="/teacher/book" className="btn btn-primary">
                <CalendarPlus className="h-4 w-4" />
                Reservar clase
              </Link>
            }
          />
          {classesResult && !classesResult.success ? (
            <div className="alert-error mt-10">{classesResult.error}</div>
          ) : (
            <TeacherClassesBoard classes={classesResult?.success ? classesResult.data : []} />
          )}
        </>
      )}
    </PageShell>
  );
}
