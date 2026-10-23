"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarCheck, CalendarDays, Clock, Gauge, Trophy } from "lucide-react";
import { getOccupancyReportData, type OccupancyReportData } from "@/src/actions/metrics";
import { DayOfWeek } from "@/src/domain/enums";
import { WEEK_DAYS, computeOccupancyMetrics, type OccupancyStat } from "@/src/domain/occupancy";
import { SLOT_DURATION_MINUTES, minutesToTimeLabel } from "@/app/bookings/slot-utils";
import { formatDuration, formatPercent } from "@/app/admin/metrics-format";
import { CourtTag } from "@/app/components/ui/court-tag";
import { StatCard } from "@/app/components/ui/stat-card";

const PRESETS = [
  { id: "today", label: "Hoy", fromOffset: 0, toOffset: 0 },
  { id: "yesterday", label: "Ayer", fromOffset: -1, toOffset: -1 },
  { id: "last7", label: "Últimos 7 días", fromOffset: -6, toOffset: 0 },
  { id: "last30", label: "Últimos 30 días", fromOffset: -29, toOffset: 0 },
  { id: "last90", label: "Últimos 90 días", fromOffset: -89, toOffset: 0 },
  { id: "next30", label: "Próximos 30 días", fromOffset: 0, toOffset: 29 },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

const DAY_LABELS: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: "Lunes",
  [DayOfWeek.TUESDAY]: "Martes",
  [DayOfWeek.WEDNESDAY]: "Miércoles",
  [DayOfWeek.THURSDAY]: "Jueves",
  [DayOfWeek.FRIDAY]: "Viernes",
  [DayOfWeek.SATURDAY]: "Sábado",
  [DayOfWeek.SUNDAY]: "Domingo",
};

/** Color de ocupación (token --occupied del tema), más intenso cuanto más ocupado. */
function occupiedShade(occupancy: number): string {
  return `color-mix(in srgb, var(--occupied) ${Math.round((0.08 + occupancy * 0.92) * 100)}%, transparent)`;
}

/**
 * Rango del período elegido, con los días contados desde hoy: de 00:00 del
 * primer día a 23:59:59.999 del último.
 */
function presetRange(id: PresetId, now: Date): { from: Date; to: Date } {
  const preset = PRESETS.find((p) => p.id === id)!;
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  return {
    from: new Date(y, m, d + preset.fromOffset),
    to: new Date(y, m, d + preset.toOffset, 23, 59, 59, 999),
  };
}

/** Turno de inicio a fin, por ejemplo "9 a 10:30". */
function slotLabel(startMinutes: number): string {
  return `${minutesToTimeLabel(startMinutes)} a ${minutesToTimeLabel(startMinutes + SLOT_DURATION_MINUTES)}`;
}

function statDetail(stat: OccupancyStat): string {
  return `${formatDuration(stat.bookedMinutes)} reservadas de ${formatDuration(stat.availableMinutes)} disponibles`;
}

/** El más solicitado (mayor ocupación) entre los que tienen horario; ante un empate, el primero. */
function mostRequested<T extends OccupancyStat>(items: T[]): T | null {
  return items
    .filter((item) => item.availableMinutes > 0)
    .reduce<T | null>((best, item) => (best === null || item.occupancy > best.occupancy ? item : best), null);
}

function ChartCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card p-6">
      <h3 id={id} className="label-caps mb-5">
        {title}
      </h3>
      {children}
    </section>
  );
}

type ColumnItem = { key: string; label: string; name: string; stat: OccupancyStat };

/**
 * Columnas verticales con el porcentaje arriba; sin horario se muestra "—".
 * Cada columna tiene un ancho mínimo para que sus textos no se encimen: si no
 * entran todas (pantallas chicas), el gráfico scrollea en horizontal.
 */
function ColumnChart({ items }: { items: ColumnItem[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex h-48 items-end gap-0.5 border-b border-line">
        {items.map(({ key, label, name, stat }) => {
          const hasSchedule = stat.availableMinutes > 0;
          return (
            <div key={key} className="flex h-full min-w-11 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] font-semibold text-foreground/70 tabular-nums">
                {hasSchedule ? formatPercent(stat.occupancy) : "—"}
              </span>
              <div className="flex h-36 w-full items-end justify-center">
                <div
                  role="img"
                  aria-label={hasSchedule ? `${name}: ${formatPercent(stat.occupancy)}` : `${name}: sin horarios`}
                  title={hasSchedule ? `${name}: ${statDetail(stat)}` : `${name}: sin horarios`}
                  className="w-full max-w-10 rounded-t-lg bg-occupied"
                  style={{ height: `${stat.occupancy * 100}%` }}
                />
              </div>
              <span className="pb-1.5 text-[11px] font-semibold text-foreground/50 tabular-nums">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Métricas de ocupación del complejo para el período elegido: porcentaje de uso
 * general, por cancha, por día de la semana, por turno y el cruce día × turno
 * para detectar los turnos más solicitados (ver computeOccupancyMetrics).
 */
export function OccupancyMetrics() {
  const [presetId, setPresetId] = useState<PresetId>("last30");
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; range: { from: Date; to: Date }; data: OccupancyReportData }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const range = presetRange(presetId, new Date());
    getOccupancyReportData(range).then((result) => {
      if (cancelled) return;
      setState(result.success ? { status: "ready", range, data: result.data } : { status: "error", error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [presetId]);

  function selectPreset(id: PresetId) {
    if (id === presetId) return;
    setState({ status: "loading" });
    setPresetId(id);
  }

  const metrics = useMemo(
    () => (state.status === "ready" ? computeOccupancyMetrics({ ...state.range, ...state.data }) : null),
    [state],
  );

  const topSlot = metrics ? mostRequested(metrics.bySlot) : null;
  const topDay = metrics ? mostRequested(metrics.byDayOfWeek) : null;
  const heatmapSlots = metrics ? metrics.bySlot.map((s) => s.startMinutes) : [];
  const heatmapDays = metrics ? WEEK_DAYS.filter((day) => metrics.byDayAndSlot.some((c) => c.dayOfWeek === day)) : [];

  return (
    <div className="space-y-5">
      <div className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={preset.id === presetId}
              onClick={() => selectPreset(preset.id)}
              className={`chip h-9 ${preset.id === presetId ? "chip-active" : ""}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {state.status === "ready" ? (
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-line bg-background px-4 py-2.5">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div className="flex flex-col">
              <span className="label-caps">Período</span>
              <span className="text-sm font-semibold text-foreground">
                Del {state.range.from.toLocaleDateString("es-AR")} al {state.range.to.toLocaleDateString("es-AR")}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {state.status === "loading" ? <p className="text-sm text-foreground/60">Cargando...</p> : null}
      {state.status === "error" ? <div className="alert-error">{state.error}</div> : null}

      {metrics ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              label="Ocupación general"
              value={<span data-testid="kpi-occupancy">{formatPercent(metrics.total.occupancy)}</span>}
              icon={<Gauge className="h-4 w-4" />}
              progress={metrics.total.occupancy}
              tone="occupied"
              footer="Sobre el tiempo disponible de todas las canchas"
            />
            <StatCard
              label="Horas reservadas"
              value={<span data-testid="kpi-hours">{formatDuration(metrics.total.bookedMinutes)}</span>}
              icon={<Clock className="h-4 w-4" />}
              footer={`De ${formatDuration(metrics.total.availableMinutes)} disponibles`}
            />
            <StatCard
              label="Turnos"
              value={<span data-testid="kpi-bookings">{metrics.total.bookingsCount}</span>}
              suffix={metrics.total.bookingsCount === 1 ? "reserva" : "reservas"}
              icon={<CalendarCheck className="h-4 w-4" />}
              footer="Reservados en el período"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <StatCard
              label="Horario más solicitado"
              value={
                <span data-testid="kpi-top-slot">
                  {topSlot ? `${minutesToTimeLabel(topSlot.startMinutes)} · ${formatPercent(topSlot.occupancy)}` : "—"}
                </span>
              }
              icon={<Trophy className="h-4 w-4" />}
              footer={topSlot ? `Turno de ${slotLabel(topSlot.startMinutes)}` : "Sin horarios configurados"}
            />
            <StatCard
              label="Día más solicitado"
              value={
                <span data-testid="kpi-top-day">
                  {topDay ? `${DAY_LABELS[topDay.dayOfWeek]} · ${formatPercent(topDay.occupancy)}` : "—"}
                </span>
              }
              icon={<Trophy className="h-4 w-4" />}
              footer={topDay ? statDetail(topDay) : "Sin horarios configurados"}
            />
          </div>

          <ChartCard id="metrics-by-court" title="Ocupación por cancha">
            {metrics.byCourt.length === 0 ? (
              <p className="text-sm text-foreground/60">No hay canchas registradas.</p>
            ) : (
              <ul className="space-y-3">
                {metrics.byCourt.map((court) => (
                  <li key={court.courtId} className="flex items-center gap-3 text-sm">
                    <div className="flex w-32 shrink-0 items-center gap-3">
                      <CourtTag number={court.courtNumber} size="sm" />
                      <span className="font-semibold text-foreground">Cancha {court.courtNumber}</span>
                    </div>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line/70">
                      <div
                        role="img"
                        aria-label={`Cancha ${court.courtNumber}: ${formatPercent(court.occupancy)}`}
                        title={`Cancha ${court.courtNumber}: ${statDetail(court)}`}
                        className="h-full rounded-full bg-occupied"
                        style={{ width: `${court.occupancy * 100}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-extrabold text-foreground tabular-nums">
                      {formatPercent(court.occupancy)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ChartCard id="metrics-by-day" title="Ocupación por día de la semana">
              <ColumnChart
                items={metrics.byDayOfWeek.map((day) => ({
                  key: day.dayOfWeek,
                  label: DAY_LABELS[day.dayOfWeek].slice(0, 3),
                  name: DAY_LABELS[day.dayOfWeek],
                  stat: day,
                }))}
              />
            </ChartCard>

            <ChartCard id="metrics-by-slot" title="Ocupación por turno">
              {metrics.bySlot.length === 0 ? (
                <p className="text-sm text-foreground/60">No hay horarios configurados.</p>
              ) : (
                <ColumnChart
                  items={metrics.bySlot.map((slot) => ({
                    key: String(slot.startMinutes),
                    label: minutesToTimeLabel(slot.startMinutes),
                    name: slotLabel(slot.startMinutes),
                    stat: slot,
                  }))}
                />
              )}
            </ChartCard>
          </div>

          <ChartCard id="metrics-heatmap" title="Turnos más solicitados">
            {heatmapDays.length === 0 ? (
              <p className="text-sm text-foreground/60">No hay horarios configurados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0.5 text-[11px]">
                  <thead>
                    <tr>
                      <th className="w-24" />
                      {heatmapSlots.map((slot) => (
                        <th key={slot} className="px-1 pb-1.5 text-center font-semibold text-foreground/50 tabular-nums">
                          {minutesToTimeLabel(slot)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapDays.map((day) => (
                      <tr key={day}>
                        <th className="pr-3 text-left font-semibold text-foreground">{DAY_LABELS[day]}</th>
                        {heatmapSlots.map((slot) => {
                          const cell = metrics.byDayAndSlot.find((c) => c.dayOfWeek === day && c.startMinutes === slot);
                          if (!cell || cell.availableMinutes === 0) {
                            return (
                              <td key={slot} className="h-9 min-w-14 rounded-lg bg-line/30 text-center text-foreground/30">
                                —
                              </td>
                            );
                          }
                          const name = `${DAY_LABELS[day]} ${slotLabel(slot)}`;
                          return (
                            <td
                              key={slot}
                              role="img"
                              aria-label={`${name}: ${formatPercent(cell.occupancy)}`}
                              title={`${name}: ${statDetail(cell)}`}
                              className={`h-9 min-w-14 rounded-lg px-1 text-center font-semibold tabular-nums ${
                                cell.occupancy > 0.55 ? "text-white" : "text-foreground/70"
                              }`}
                              style={{ backgroundColor: occupiedShade(cell.occupancy) }}
                            >
                              {formatPercent(cell.occupancy)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-foreground/50">
                  0%
                  <span
                    className="h-2.5 w-32 rounded-full"
                    style={{ background: `linear-gradient(to right, ${occupiedShade(0)}, ${occupiedShade(1)})` }}
                  />
                  100%
                </div>
              </div>
            )}
          </ChartCard>
        </>
      ) : null}
    </div>
  );
}
