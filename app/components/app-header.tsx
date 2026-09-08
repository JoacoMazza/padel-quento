import Link from "next/link";
import { QuentoLogo } from "@/app/components/quento-logo";
import { UserMenu } from "@/app/components/user-menu";
import { Role } from "@/src/domain/enums";

export type HeaderActiveTab =
  | "/"
  | "/bookings"
  | "/my-bookings"
  | "/profile"
  | "/admin";

export function AppHeader({
  active,
  userName,
  userEmail,
  userRole,
}: {
  active: HeaderActiveTab;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: Role | string | null;
}) {
  const isAdmin = userRole === Role.ADMIN || userRole === "admin";

  const navItems = [
    { href: "/", label: "Inicio" },
    { href: "/bookings", label: "Turnos" },
    { href: "/my-bookings", label: "Mis reservas" },
    { href: "/profile", label: "Mi Perfil" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="flex items-center justify-between border-b border-line bg-card px-6 py-3.5 shadow-sm">
      <QuentoLogo size="sm" variant="horizontal" />
      <nav className="flex items-center gap-8">
        {navItems.map((item) => {
          const isActive = item.href === active;
          const isItemAdmin = item.href === "/admin";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 pb-1 text-sm font-semibold transition-colors ${
                isActive
                  ? "border-b-2 border-primary text-primary"
                  : isItemAdmin
                    ? "text-amber-600 hover:text-amber-700 dark:text-amber-400"
                    : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {item.label}
              {isItemAdmin && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  Panel
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <UserMenu name={userName} email={userEmail} role={userRole} />
    </header>
  );
}
