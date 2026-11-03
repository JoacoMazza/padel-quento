import { AppHeader, type HeaderActiveTab } from "@/app/components/app-header";
import { AppFooter } from "@/app/components/app-footer";

const WIDTH_CLASSES = {
  wide: "mx-auto max-w-7xl px-6 py-10 sm:py-12",
  narrow: "mx-auto max-w-5xl px-6 py-10 sm:py-12",
  full: "w-full px-0 py-0",
} as const;

/** Estructura común de las pantallas de jugador: header, contenido centrado y footer. */
export function PageShell({
  active,
  user,
  width = "wide",
  children,
}: {
  active: HeaderActiveTab;
  /** Usuario de la sesión, o null para un visitante sin sesión. */
  user: { name?: string | null; email?: string | null; role?: string | null; isTeacher?: boolean } | null;
  width?: keyof typeof WIDTH_CLASSES;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <AppHeader
        active={active}
        userName={user?.name}
        userEmail={user?.email}
        userRole={user?.role}
        guest={user === null}
        isTeacher={user?.isTeacher ?? false}
      />
      <main className={`w-full flex-1 ${WIDTH_CLASSES[width]}`}>{children}</main>
      <AppFooter />
    </div>
  );
}
