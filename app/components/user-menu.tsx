"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { Role } from "@/src/domain/enums";
import { getInitials } from "@/app/components/ui/avatar";

export function UserMenu({
  name,
  email,
  role,
}: {
  name?: string | null;
  email?: string | null;
  role?: Role | string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const isAdmin = role === Role.ADMIN || role === "admin";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú de usuario"
        aria-expanded={open}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-md shadow-primary/25 transition-colors hover:bg-primary-hover"
      >
        {getInitials(name, email)}
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-card shadow-xl">
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{name ?? "Mi cuenta"}</p>
              {role ? (
                <span className={`badge text-[10px] tracking-wider uppercase ${isAdmin ? "bg-ink text-white" : "badge-primary"}`}>
                  {isAdmin ? "Admin" : "Jugador"}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-foreground/60">{email}</p>
          </div>
          {!isAdmin && (
            <div className="py-2">
              <Link
                href="/profile"
                className="flex items-center gap-3 px-4 py-2 text-sm text-foreground/80 hover:bg-background hover:text-foreground"
              >
                <User size={16} />
                Mi perfil
              </Link>
            </div>
          )}
          <div className="border-t border-line py-2">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm font-medium text-danger hover:bg-danger-light"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
