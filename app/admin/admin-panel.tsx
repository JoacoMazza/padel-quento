"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, BarChart3, Users, CalendarClock, CalendarPlus, Repeat, ClipboardList, UserCog, Menu, X } from "lucide-react";
import { SignOutButton } from "@/app/components/sign-out-button";
import { CourtsTable } from "@/app/admin/courts-table";
import { ScheduleBoard } from "@/app/admin/schedule-board";
import { UsersTable } from "@/app/admin/users-table";
import { FixedBookingsPanel, type FixedBookingPlayerOption } from "@/app/admin/fixed-bookings-panel";
import { CreateBookingModal, type BookingCourtOption, type BookingDraft } from "@/app/admin/create-booking-modal";
import { OccupancyMetrics } from "@/app/admin/occupancy-metrics";
import { AttendanceReport } from "@/app/admin/attendance-report";
import { TeamPanel } from "@/app/admin/team-panel";
import { getTeam } from "@/src/actions/admin";
import type { CourtItem } from "@/app/admin/court-status";
import { getCourts } from "@/src/actions/court";
import { getOutOfServices } from "@/src/actions/outOfService";
import { isOutOfServiceActive } from "@/src/domain/out-of-service";
import { getPlayersAdmin } from "@/src/actions/player";
import { getFixedBookingsAdmin, type FixedBookingAdminItem } from "@/src/actions/fixedBooking";
import { CourtState } from "@/src/domain/enums";
import type { ActionResult } from "@/src/lib/action-result";

// ownerOnly: secciones solo para el dueño del complejo (el servidor también lo exige).
const SECTIONS = [
  { id: "schedule", label: "Turnera Global", icon: CalendarClock, available: true, ownerOnly: false },
  { id: "courts", label: "Canchas", icon: MapPin, available: true, ownerOnly: false },
  { id: "metrics", label: "Métricas del Complejo", icon: BarChart3, available: true, ownerOnly: true },
  { id: "attendance", label: "Reportes de Asistencia", icon: ClipboardList, available: true, ownerOnly: true },
  { id: "users", label: "Gestión de Usuarios", icon: Users, available: true, ownerOnly: false },
  { id: "team", label: "Equipo", icon: UserCog, available: true, ownerOnly: true },
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
    return <div className="alert-error">{state.error}</div>;
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

function CourtsSection({ isOwner }: { isOwner: boolean }) {
  const state = useSectionData(loadCourts);
  return state.status === "ready" ? <CourtsTable courts={state.data} isOwner={isOwner} /> : <SectionStatus state={state} />;
}

type FixedBookingsData = {
  fixedBookings: FixedBookingAdminItem[];
  courts: BookingCourtOption[];
  players: FixedBookingPlayerOption[];
};

// Junto con los turnos fijos se traen las canchas (sin las dadas de baja) y los
// jugadores, que los formularios de alta (turno común y turno fijo) ofrecen para elegir.
async function loadFixedBookings(): Promise<ActionResult<FixedBookingsData>> {
  const [fixedResult, courtsResult, playersResult] = await Promise.all([
    getFixedBookingsAdmin(),
    getCourts(),
    getPlayersAdmin(),
  ]);
  if (!fixedResult.success) return fixedResult;
  if (!courtsResult.success) return courtsResult;
  if (!playersResult.success) return playersResult;

  return {
    success: true,
    data: {
      fixedBookings: fixedResult.data,
      courts: courtsResult.data
        .filter((c) => c.state !== CourtState.CLOSED_DOWN)
        .map((c) => ({ id: c.id, number: c.number, price: c.price })),
      players: playersResult.data.map((p) => ({
        id: p.id,
        name: `${p.names} ${p.lastnames}`,
        phoneNumber: p.phoneNumber,
      })),
    },
  };
}

/**
 * Turnera Global: la grilla con los botones para agendar un turno común y para
 * registrar un turno fijo junto a Actualizar y, debajo, el listado de turnos
 * fijos. Un turno común también se agenda haciendo click en una celda libre.
 * Después de cada alta o cambio se refresca la grilla para que se vea.
 */
function ScheduleSection({ isActive }: { isActive: boolean }) {
  const fixedState = useSectionData(loadFixedBookings);
  const [isCreatingFixed, setIsCreatingFixed] = useState(false);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [bookingNotice, setBookingNotice] = useState<string | null>(null);
  const [boardRefreshKey, setBoardRefreshKey] = useState(0);
  const refreshBoard = useCallback(() => setBoardRefreshKey((key) => key + 1), []);
  const isReady = fixedState.status === "ready";

  function openBooking(draft: BookingDraft) {
    setBookingNotice(null);
    setBookingDraft(draft);
  }

  function handleBookingCreated() {
    setBookingDraft(null);
    setBookingNotice("Turno agendado.");
    refreshBoard();
  }

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        {bookingNotice ? <p className="text-sm font-medium text-success">{bookingNotice}</p> : null}
        <ScheduleBoard
          isActive={isActive}
          refreshKey={boardRefreshKey}
          onAvailableSlotClick={isReady ? openBooking : undefined}
          toolbarActions={
            <>
              <button
                type="button"
                disabled={!isReady}
                onClick={() => openBooking({})}
                className="btn btn-sm btn-primary"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                Agendar turno
              </button>
              <button
                type="button"
                disabled={!isReady}
                onClick={() => setIsCreatingFixed(true)}
                className="btn btn-sm btn-outline"
              >
                <Repeat className="h-3.5 w-3.5" />
                Registrar turno fijo
              </button>
            </>
          }
        />
      </div>
      {isReady && bookingDraft ? (
        <CreateBookingModal
          courts={fixedState.data.courts}
          players={fixedState.data.players}
          initial={bookingDraft}
          onClose={() => setBookingDraft(null)}
          onCreated={handleBookingCreated}
        />
      ) : null}
      {fixedState.status === "ready" ? (
        <FixedBookingsPanel
          {...fixedState.data}
          isCreating={isCreatingFixed}
          onCloseCreate={() => setIsCreatingFixed(false)}
          onChanged={refreshBoard}
        />
      ) : (
        <SectionStatus state={fixedState} />
      )}
    </div>
  );
}

function UsersSection() {
  const state = useSectionData(getPlayersAdmin);
  return state.status === "ready" ? <UsersTable players={state.data} /> : <SectionStatus state={state} />;
}

function TeamSection() {
  const state = useSectionData(getTeam);
  return state.status === "ready" ? <TeamPanel team={state.data} /> : <SectionStatus state={state} />;
}

/** isOwner (de la sesión): muestra las secciones del dueño; los permisos los verifica el servidor. */
export function AdminPanel({ isOwner }: { isOwner: boolean }) {
  const [activeSection, setActiveSection] = useState<SectionId>("schedule");
  const [visitedSections, setVisitedSections] = useState<SectionId[]>(["schedule"]);
  const sections = SECTIONS.filter((section) => isOwner || !section.ownerOnly);
  const activeSectionItem = sections.find((s) => s.id === activeSection);
  const activeLabel = activeSectionItem?.label ?? "";
  const ActiveIcon = activeSectionItem?.icon;
  // Debajo de lg las secciones van en un menú hamburguesa; desde lg se ven siempre en la barra lateral.
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function openSection(id: SectionId) {
    setActiveSection(id);
    setIsMenuOpen(false);
    setVisitedSections((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  return (
    // Debajo de lg la barra lateral pasa a ser un menú hamburguesa arriba del contenido.
    <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
      <aside className="relative flex shrink-0 flex-col border-b border-line bg-card lg:w-64 lg:overflow-hidden lg:border-r lg:border-b-0">
        <p className="label-caps hidden px-6 pt-6 pb-2 lg:block">Panel operativo</p>
        <button
          type="button"
          onClick={() => setIsMenuOpen((v) => !v)}
          aria-expanded={isMenuOpen}
          aria-controls="admin-sections"
          aria-label={isMenuOpen ? "Cerrar secciones" : "Abrir secciones"}
          className="flex h-12 w-full cursor-pointer items-center justify-between gap-3 px-6 text-sm font-semibold text-foreground lg:hidden"
        >
          <span className="flex items-center gap-3">
            {ActiveIcon ? <ActiveIcon className="h-5 w-5 text-primary" /> : null}
            {activeLabel}
          </span>
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {/* En pantallas chicas se despliega de arriba hacia abajo, sobre el contenido. */}
        <nav
          id="admin-sections"
          className={`${isMenuOpen ? "flex" : "hidden"} absolute inset-x-0 top-full z-30 flex-col gap-1 border-b border-line bg-card px-3 py-2 shadow-lg motion-safe:animate-slide-down lg:static lg:z-auto lg:flex lg:flex-1 lg:overflow-y-auto lg:border-b-0 lg:shadow-none lg:motion-safe:animate-none`}
        >
          {sections.map(({ id, label, icon: Icon, available }) => {
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
                aria-current={isActive ? "page" : undefined}
                onClick={() => openSection(id)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors pointer-coarse:py-3 ${
                  isActive ? "bg-primary-light text-primary" : "text-foreground/70 hover:bg-background hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </nav>

        {/* En pantallas chicas Cerrar sesión queda solo en el menú de usuario del header. */}
        <div className="hidden shrink-0 border-t border-line px-3 py-4 lg:block">
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8 lg:py-10">
        <p className="eyebrow mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Administración · Quento Club
        </p>
        <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-foreground">
          {activeLabel}
          <span aria-hidden="true" className="text-primary">
            .
          </span>
        </h1>

        {/* Las secciones visitadas quedan montadas y solo se ocultan, para no volver a pedir sus datos. */}
        {visitedSections.includes("schedule") ? (
          <div hidden={activeSection !== "schedule"}>
            <ScheduleSection isActive={activeSection === "schedule"} />
          </div>
        ) : null}
        {visitedSections.includes("courts") ? (
          <div hidden={activeSection !== "courts"}>
            <CourtsSection isOwner={isOwner} />
          </div>
        ) : null}
        {visitedSections.includes("metrics") ? (
          <div hidden={activeSection !== "metrics"}>
            <OccupancyMetrics />
          </div>
        ) : null}
        {visitedSections.includes("attendance") ? (
          <div hidden={activeSection !== "attendance"}>
            <AttendanceReport />
          </div>
        ) : null}
        {visitedSections.includes("users") ? (
          <div hidden={activeSection !== "users"}>
            <UsersSection />
          </div>
        ) : null}
        {visitedSections.includes("team") ? (
          <div hidden={activeSection !== "team"}>
            <TeamSection />
          </div>
        ) : null}
      </main>
    </div>
  );
}
