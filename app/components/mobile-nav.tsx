"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export type NavItem = { href: string; label: string };

/**
 * Menú desplegable con la navegación principal para pantallas chicas, donde
 * los links del header no entran en una fila (desde lg se ocultan este botón y
 * el menú, y se ve la navegación en línea).
 */
export function MobileNav({ items, active }: { items: NavItem[]; active: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        className="icon-btn lg:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Menú principal"
          className="absolute inset-x-0 top-full border-b border-line bg-card px-4 py-3 shadow-lg motion-safe:animate-slide-down lg:hidden"
        >
          {items.map((item) => {
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex h-11 items-center rounded-xl px-4 text-sm font-semibold transition-colors ${
                  isActive ? "bg-primary-light text-primary" : "text-foreground/70 hover:bg-background hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}
