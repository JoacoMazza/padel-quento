import Link from "next/link";
import { QuentoLogo } from "@/app/components/quento-logo";
import { UserMenu } from "@/app/components/user-menu";
import { CLUB_LOCATION } from "@/app/components/club-info";
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
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <QuentoLogo size="sm" variant="icon" />
          <span className="text-base font-extrabold tracking-wide text-foreground uppercase">Quento Club</span>
          <span className="hidden text-xs font-semibold tracking-wider text-foreground/40 uppercase sm:inline">
            · {CLUB_LOCATION}
          </span>
        </div>
        {showNav ? (
          // En mobile baja a una segunda fila con scroll horizontal.
          <nav className="order-last -mx-2 flex w-full gap-1 overflow-x-auto md:order-none md:mx-0 md:w-auto">
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
        <UserMenu name={userName} email={userEmail} role={userRole} />
      </div>
    </header>
  );
}
