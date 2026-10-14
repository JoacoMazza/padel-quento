import Link from "next/link";
import { CLUB_ADDRESS, CLUB_MAPS_URL } from "@/app/components/club-info";

const FOOTER_LINKS = [
  { href: "/bookings", label: "Reservar cancha" },
  { href: "/open-matches", label: "Partidos abiertos" },
  { href: "/my-bookings", label: "Mis reservas" },
];

/** Pie común de las pantallas de jugador. `showLinks` se apaga en el panel de administración. */
export function AppFooter({ showLinks = true }: { showLinks?: boolean }) {
  return (
    <footer className="mt-auto border-t border-line bg-card">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-extrabold tracking-wide text-foreground uppercase">Quento Club</p>
          <a
            href={CLUB_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-foreground/50 transition-colors hover:text-primary"
          >
            {CLUB_ADDRESS}
          </a>
          <p className="text-xs text-foreground/40">© {new Date().getFullYear()} Quento Club · Pádel & Club Social</p>
        </div>
        {showLinks ? (
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-foreground/70 transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </footer>
  );
}
