"use client";

import { useState } from "react";
import { MapPin, Lock, BarChart3, Users, CalendarClock } from "lucide-react";
import { SignOutButton } from "@/app/components/sign-out-button";
import { CourtsTable } from "@/app/admin/courts-table";
import { ScheduleBoard } from "@/app/admin/schedule-board";
import { UsersTable } from "@/app/admin/users-table";
import type { CourtItem } from "@/app/admin/court-status";
import type { AdminBookingProp } from "@/app/admin/types";
import type { OutOfServiceProp, ScheduleProp } from "@/app/bookings/types";
import type { PlayerAdminItem } from "@/src/actions/player";

const SECTIONS = [
  { id: "schedule", label: "Turnera Global", icon: CalendarClock, available: true },
  { id: "courts", label: "Estado de Canchas", icon: MapPin, available: true },
  { id: "blocks", label: "Bloqueo de Canchas", icon: Lock, available: false },
  { id: "metrics", label: "Métricas del Complejo", icon: BarChart3, available: false },
  { id: "users", label: "Gestión de Usuarios", icon: Users, available: true },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function AdminPanel({
  courts,
  courtsError,
  schedules,
  bookings,
  outOfServices,
  players,
}: {
  courts: CourtItem[];
  courtsError?: string | null;
  schedules: ScheduleProp[];
  bookings: AdminBookingProp[];
  outOfServices: OutOfServiceProp[];
  players: PlayerAdminItem[];
}) {
  const [activeSection, setActiveSection] = useState<SectionId>("schedule");
  const activeLabel = SECTIONS.find((s) => s.id === activeSection)?.label ?? "";

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-line bg-card">
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {SECTIONS.map(({ id, label, icon: Icon, available }) => {
            const isActive = id === activeSection;
            if (!available) {
              return (
                <span
                  key={id}
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/35"
                >
                  <Icon className="h-5 w-5" />
                  {label}
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                    Próx.
                  </span>
                </span>
              );
            }
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:bg-line/40 hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-line px-3 py-4">
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-10">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">{activeLabel}</h1>

        {activeSection === "schedule" ? (
          <div className="space-y-4">
            {courtsError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">
                {courtsError}
              </div>
            ) : null}
            <ScheduleBoard initialData={{ courts, schedules, bookings, outOfServices }} />
          </div>
        ) : activeSection === "courts" ? (
          <div className="space-y-4">
            {courtsError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">
                {courtsError}
              </div>
            ) : null}
            <CourtsTable courts={courts} />
          </div>
        ) : activeSection === "users" ? (
          <UsersTable players={players} />
        ) : (
          <p className="text-sm text-foreground/60">Esta sección estará disponible próximamente.</p>
        )}
      </main>
    </div>
  );
}
