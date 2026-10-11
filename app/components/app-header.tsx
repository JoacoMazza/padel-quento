import Link from "next/link";
import { QuentoLogo } from "@/app/components/quento-logo";
import { UserMenu } from "@/app/components/user-menu";
import { Role } from "@/src/domain/enums";

export type HeaderActiveTab =
  | "/"
  | "/bookings"
  | "/open-matches"
  | "/my-bookings"
  | "/profile"
  | "/admin";

const NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/bookings", label: "Turnos" },
  { href: "/open-matches", label: "Partidos abiertos" },
  { href: "/my-bookings", label: "Mis reservas" },
];

export function AppHeader({
  active,
  userName,
  userEmail,
  userRole,
  showNav = true,
}: {
  active: HeaderActiveTab;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: Role | string | null;
  /** Cuando es `false`, oculta los links de navegación principal (usado en el panel de administración). */
  showNav?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-line bg-card/95 backdrop-blur">
      {/* Tres columnas en una fila: logo a la izquierda, navegación centrada y menú de usuario a la derecha.
          En el panel de administración ocupa todo el ancho, con el mismo margen que las opciones del aside. */}
      <div
        className={`grid w-full grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-x-4 px-6 py-3 ${showNav ? "mx-auto max-w-7xl" : ""}`}
      >
        <div className="flex items-center gap-2.5">
          <QuentoLogo size="sm" variant="icon" />
          <span className="hidden text-base font-extrabold tracking-wide text-foreground uppercase sm:inline">
            Quento Club
          </span>
        </div>
        {showNav ? (
          // Si no entra en pantallas chicas, scrollea en horizontal.
          <nav className="flex min-w-0 gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === active;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`nav-pill shrink-0 ${isActive ? "nav-pill-active" : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
        <div className="col-start-3 justify-self-end">
          <UserMenu name={userName} email={userEmail} role={userRole} />
        </div>
      </div>
    </header>
  );
}
