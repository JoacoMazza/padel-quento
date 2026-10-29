import Link from "next/link";
import { QuentoLogo } from "@/app/components/quento-logo";
import { UserMenu } from "@/app/components/user-menu";
import { MobileNav } from "@/app/components/mobile-nav";
import { Role } from "@/src/domain/enums";

export type HeaderActiveTab =
  | "/"
  | "/bookings"
  | "/open-matches"
  | "/my-bookings"
  | "/profile"
  | "/admin";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", guest: true },
  { href: "/bookings", label: "Turnos", guest: true },
  { href: "/open-matches", label: "Partidos abiertos", guest: true },
  { href: "/my-bookings", label: "Mis reservas", guest: false },
];

const LOGO_LINK_CLASS = "flex w-fit items-center gap-2.5 rounded-lg";

/** Logo del encabezado: lleva al inicio (la home de los jugadores o el panel del admin). */
function LogoContent() {
  return (
    <>
      <QuentoLogo size="sm" variant="icon" />
      <span className="hidden text-base font-extrabold tracking-wide text-foreground uppercase sm:inline">
        Quento Club
      </span>
    </>
  );
}

export function AppHeader({
  active,
  userName,
  userEmail,
  userRole,
  showNav = true,
  guest = false,
}: {
  active: HeaderActiveTab;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: Role | string | null;
  /** Cuando es `false`, oculta los links de navegación principal (usado en el panel de administración). */
  showNav?: boolean;
  /** Visitante sin sesión: ve solo las secciones públicas y los accesos para entrar o registrarse. */
  guest?: boolean;
}) {
  const navItems = NAV_ITEMS.filter((item) => !guest || item.guest);

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-line bg-card/95 backdrop-blur">
      {/* Tres columnas en una fila: logo a la izquierda, navegación centrada y menú de usuario a la derecha.
          En el panel de administración ocupa todo el ancho, con el mismo margen que las opciones del aside. */}
      <div
        className={`grid w-full grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-x-4 px-6 py-3 ${showNav ? "mx-auto max-w-7xl" : ""}`}
      >
        {userRole === Role.ADMIN ? (
          // Link común: el panel es una sola ruta, y una navegación del cliente a /admin
          // conservaría la sección abierta en vez de volver a la Turnera Global.
          <a href="/admin" aria-label="Ir al inicio" className={LOGO_LINK_CLASS}>
            <LogoContent />
          </a>
        ) : (
          <Link href="/" aria-label="Ir al inicio" className={LOGO_LINK_CLASS}>
            <LogoContent />
          </Link>
        )}
        {showNav ? (
          // En pantallas chicas no entra en una fila: los links pasan al menú desplegable (MobileNav).
          <nav className="hidden min-w-0 gap-1 lg:flex">
            {navItems.map((item) => {
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
        <div className="col-start-3 flex items-center gap-2 justify-self-end">
          {guest ? (
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn btn-outline btn-sm">
                Iniciar sesión
              </Link>
              {/* En pantallas chicas no entra: registrarse queda en la landing y en el login. */}
              <Link href="/register" className="btn btn-primary btn-sm hidden sm:inline-flex">
                Registrarse
              </Link>
            </div>
          ) : (
            <UserMenu name={userName} email={userEmail} role={userRole} />
          )}
          {showNav ? <MobileNav items={navItems} active={active} /> : null}
        </div>
      </div>
    </header>
  );
}
