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
  ];

  return (
    <header className="flex items-center justify-between border-b border-line bg-card px-6 py-3.5 shadow-sm">
      <QuentoLogo size="sm" variant="horizontal" />
      <nav className="flex items-center gap-8">
        {navItems.map((item) => {
          const isActive = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 pb-1 text-sm font-semibold transition-colors ${
                isActive
                  ? "border-b-2 border-primary text-primary"
                  : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <UserMenu name={userName} email={userEmail} role={userRole} />
    </header>
  );
}
