"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { QuentoLogo } from "@/app/components/quento-logo";
import { SignOutButton } from "@/app/components/sign-out-button";
import {
  LayoutDashboard,
  MapPin,
  Lock,
  BarChart3,
  Users,
  ArrowLeft,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/courts", label: "Canchas", icon: MapPin },
] as const;

const UPCOMING_ITEMS = [
  { label: "Bloqueos", icon: Lock },
  { label: "Métricas", icon: BarChart3 },
  { label: "Usuarios", icon: Users },
] as const;

export function AdminSidebar({
  userName,
  userEmail,
}: {
  userName?: string | null;
  userEmail?: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-line bg-card">
      <div className="border-b border-line px-5 py-5">
        <QuentoLogo size="sm" variant="horizontal" />
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-foreground/50">
          Panel de Administración
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/70 hover:bg-line/40 hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}

        <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-foreground/40">
          Próximamente
        </p>
        {UPCOMING_ITEMS.map(({ label, icon: Icon }) => (
          <span
            key={label}
            className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/35"
          >
            <Icon className="h-5 w-5" />
            {label}
          </span>
        ))}
      </nav>

      <div className="space-y-3 border-t border-line px-3 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-line/40 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al sitio
        </Link>
        <div className="rounded-xl bg-background px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-foreground">{userName ?? "Administrador"}</p>
          <p className="truncate text-xs text-foreground/60">{userEmail}</p>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
