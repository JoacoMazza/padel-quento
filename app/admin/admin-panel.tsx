"use client";

import { useEffect, useState } from "react";
import { MapPin, Lock, BarChart3, Users, CalendarClock } from "lucide-react";
import { SignOutButton } from "@/app/components/sign-out-button";
import { CourtsTable } from "@/app/admin/courts-table";
import { ScheduleBoard } from "@/app/admin/schedule-board";
import { UsersTable } from "@/app/admin/users-table";
import type { CourtItem } from "@/app/admin/court-status";
import { getCourts } from "@/src/actions/court";
import { getOutOfServices } from "@/src/actions/outOfService";
import { isOutOfServiceActive } from "@/src/domain/out-of-service";
import { getPlayersAdmin } from "@/src/actions/player";
import type { ActionResult } from "@/src/lib/action-result";

const SECTIONS = [
  { id: "schedule", label: "Turnera Global", icon: CalendarClock, available: true },
  { id: "courts", label: "Estado de Canchas", icon: MapPin, available: true },
  { id: "blocks", label: "Bloqueo de Canchas", icon: Lock, available: false },
  { id: "metrics", label: "Métricas del Complejo", icon: BarChart3, available: false },
  { id: "users", label: "Gestión de Usuarios", icon: Users, available: true },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

type SectionData<T> = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; data: T };

/**
 * Pide los datos de una sección una sola vez, al montarse. Como las secciones
 * visitadas quedan montadas (ocultas), lo obtenido se mantiene en memoria y no
 * se vuelve a pedir al cambiar de sección.
 */
function useSectionData<T>(load: () => Promise<ActionResult<T>>): SectionData<T> {
  const [state, setState] = useState<SectionData<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    load().then((result) => {
      if (cancelled) return;
      setState(result.success ? { status: "ready", data: result.data } : { status: "error", error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return state;
}

function SectionStatus({ state }: { state: SectionData<unknown> }) {
  if (state.status === "loading") {
    return <p className="text-sm text-foreground/60">Cargando...</p>;
  }
  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">
        {state.error}
      </div>
    );
  }
  return null;
}

async function loadCourts(): Promise<ActionResult<CourtItem[]>> {
  const [courtsResult, outOfServicesResult] = await Promise.all([getCourts(), getOutOfServices()]);
  if (!courtsResult.success) return courtsResult;
  if (!outOfServicesResult.success) return outOfServicesResult;

  const now = new Date();
  return {
    success: true,
    data: courtsResult.data.map((c) => {
      const active = outOfServicesResult.data.find((o) => o.court?.id === c.id && isOutOfServiceActive(o, now));
      return {
        id: c.id,
        number: c.number,
        state: c.state,
        price: c.price,
        activeOutOfService: active ? { id: active.id, reason: active.reason, toDateTime: active.toDateTime } : null,
      };
    }),
  };
}

function CourtsSection() {
  const state = useSectionData(loadCourts);
  return state.status === "ready" ? <CourtsTable courts={state.data} /> : <SectionStatus state={state} />;
}

function UsersSection() {
  const state = useSectionData(getPlayersAdmin);
  return state.status === "ready" ? <UsersTable players={state.data} /> : <SectionStatus state={state} />;
}

export function AdminPanel() {
  const [activeSection, setActiveSection] = useState<SectionId>("schedule");
  const [visitedSections, setVisitedSections] = useState<SectionId[]>(["schedule"]);
  const activeLabel = SECTIONS.find((s) => s.id === activeSection)?.label ?? "";

  function openSection(id: SectionId) {
    setActiveSection(id);
    setVisitedSections((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

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
                onClick={() => openSection(id)}
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

        {/* Las secciones visitadas quedan montadas y solo se ocultan, para no volver a pedir sus datos. */}
        {visitedSections.includes("schedule") ? (
          <div hidden={activeSection !== "schedule"}>
            <ScheduleBoard isActive={activeSection === "schedule"} />
          </div>
        ) : null}
        {visitedSections.includes("courts") ? (
          <div hidden={activeSection !== "courts"}>
            <CourtsSection />
          </div>
        ) : null}
        {visitedSections.includes("users") ? (
          <div hidden={activeSection !== "users"}>
            <UsersSection />
          </div>
        ) : null}
      </main>
    </div>
  );
}
