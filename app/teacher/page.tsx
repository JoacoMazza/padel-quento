import { getServerSession } from "next-auth/next";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";
import { pageMetadata } from "@/app/site-metadata";
import { authOptions } from "@/src/lib/auth";
import { TeacherAccessDenied, teacherAccessDenied } from "@/app/teacher/teacher-access";
import { TeacherDashboard } from "@/app/teacher/teacher-dashboard";
import { getTeacherClasses, getTeacherLessons, getTeacherStudents } from "@/src/actions/teacherClass";

export const metadata = pageMetadata("Mis clases", "/teacher");

/**
 * Sección del profesor (HU-42): la agenda de los turnos de sus clases (HU-46),
 * sus clases con los alumnos inscriptos (HU-44) y el listado de sus alumnos
 * (HU-45). Solo para jugadores con una clase activa (ver teacherAccessDenied).
 */
export default async function TeacherPage() {
  const session = await getServerSession(authOptions);
  const denied = await teacherAccessDenied();
  const [classesResult, lessonsResult, studentsResult] = denied
    ? [null, null, null]
    : await Promise.all([getTeacherClasses(), getTeacherLessons(), getTeacherStudents()]);

  return (
    <PageShell active="/teacher" user={session?.user ?? null}>
      {denied ? (
        <TeacherAccessDenied message={denied} />
      ) : (
        <>
          <PageHeading
            eyebrow="Profesor"
            title="Mis clases"
            description="Tu agenda, tus clases y tus alumnos."
          />
          {classesResult && !classesResult.success ? (
            <div className="alert-error mt-10">{classesResult.error}</div>
          ) : lessonsResult && !lessonsResult.success ? (
            <div className="alert-error mt-10">{lessonsResult.error}</div>
          ) : studentsResult && !studentsResult.success ? (
            <div className="alert-error mt-10">{studentsResult.error}</div>
          ) : (
            <TeacherDashboard
              classes={classesResult?.success ? classesResult.data : []}
              lessons={lessonsResult?.success ? lessonsResult.data : []}
              students={studentsResult?.success ? studentsResult.data : []}
            />
          )}
        </>
      )}
    </PageShell>
  );
}
