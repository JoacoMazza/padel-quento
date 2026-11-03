import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";
import { pageMetadata } from "@/app/site-metadata";
import { authOptions } from "@/src/lib/auth";
import { TeacherAccessDenied, teacherAccessDenied } from "@/app/teacher/teacher-access";
import { TeacherDashboard } from "@/app/teacher/teacher-dashboard";
import { getTeacherClasses, getTeacherStudents } from "@/src/actions/teacherClass";

export const metadata = pageMetadata("Mis clases", "/teacher");

/**
 * Sección del profesor (HU-42): la agenda de sus turnos de clase con los
 * alumnos (HU-44 y HU-46) y el listado de sus alumnos (HU-45). Solo para
 * profesores activos (ver teacherAccessDenied).
 */
export default async function TeacherPage() {
  const session = await getServerSession(authOptions);
  const denied = await teacherAccessDenied();
  const [classesResult, studentsResult] = denied
    ? [null, null]
    : await Promise.all([getTeacherClasses(), getTeacherStudents()]);

  return (
    <PageShell active="/teacher" user={session?.user ?? null}>
      {denied ? (
        <TeacherAccessDenied message={denied} />
      ) : (
        <>
          <PageHeading
            eyebrow="Profesor"
            title="Mis clases"
            description="Tu agenda de clases y tus alumnos."
            actions={
              <Link href="/teacher/book" className="btn btn-primary">
                <CalendarPlus className="h-4 w-4" />
                Reservar clase
              </Link>
            }
          />
          {classesResult && !classesResult.success ? (
            <div className="alert-error mt-10">{classesResult.error}</div>
          ) : studentsResult && !studentsResult.success ? (
            <div className="alert-error mt-10">{studentsResult.error}</div>
          ) : (
            <TeacherDashboard
              classes={classesResult?.success ? classesResult.data : []}
              students={studentsResult?.success ? studentsResult.data : []}
            />
          )}
        </>
      )}
    </PageShell>
  );
}
