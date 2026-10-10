"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getOccupancyReportData, type OccupancyReportData } from "@/src/actions/metrics";
import { DayOfWeek } from "@/src/domain/enums";
import { WEEK_DAYS, computeOccupancyMetrics, type OccupancyStat } from "@/src/domain/occupancy";
import { SLOT_DURATION_MINUTES } from "@/app/bookings/slot-utils";
import { formatDuration, formatPercent, formatSlotTime } from "@/app/admin/metrics-format";

const PRESETS = [
  { id: "last7", label: "Últimos 7 días", days: 7, upcoming: false },
  { id: "last30", label: "Últimos 30 días", days: 30, upcoming: false },
  { id: "last90", label: "Últimos 90 días", days: 90, upcoming: false },
  { id: "next30", label: "Próximos 30 días", days: 30, upcoming: true },
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

// Mismo azul que "Reservado" en la turnera: más intenso cuanto más ocupado.
const OCCUPIED_RGB = "59, 130, 246";

/** Rango del período elegido: de 00:00 del primer día a 23:59:59.999 del último. */
function presetRange(id: PresetId, now: Date): { from: Date; to: Date } {
  const preset = PRESETS.find((p) => p.id === id)!;
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  return preset.upcoming
    ? { from: new Date(y, m, d), to: new Date(y, m, d + preset.days - 1, 23, 59, 59, 999) }
    : { from: new Date(y, m, d - preset.days + 1), to: new Date(y, m, d, 23, 59, 59, 999) };
}

/** Turno de inicio a fin, por ejemplo "9 a 10:30". */
function slotLabel(startMinutes: number): string {
  return `${formatSlotTime(startMinutes)} a ${formatSlotTime(startMinutes + SLOT_DURATION_MINUTES)}`;
}

function statDetail(stat: OccupancyStat): string {
  return `${formatDuration(stat.bookedMinutes)} reservadas de ${formatDuration(stat.availableMinutes)} disponibles`;
}

/** El de mayor ocupación entre los que tienen horario; ante un empate, el primero. */
function peakOf<T extends OccupancyStat>(items: T[]): T | null {
  return items
    .filter((item) => item.availableMinutes > 0)
    .reduce<T | null>((best, item) => (best === null || item.occupancy > best.occupancy ? item : best), null);
}

function KpiTile({ label, testId, value }: { label: string; testId: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-foreground/60">{label}</p>
      <p data-testid={testId} className="mt-1 text-xl font-bold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function ChartCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h3 id={id} className="mb-4 text-sm font-bold text-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

type ColumnItem = { key: string; label: string; name: string; stat: OccupancyStat };

/** Columnas verticales con el porcentaje arriba; sin horario se muestra "—". */
function ColumnChart({ items }: { items: ColumnItem[] }) {
  return (
    <div className="flex h-48 items-end gap-0.5 border-b border-line">
      {items.map(({ key, label, name, stat }) => {
        const hasSchedule = stat.availableMinutes > 0;
        return (
          <div key={key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] font-semibold text-foreground/70">
              {hasSchedule ? formatPercent(stat.occupancy) : "—"}
            </span>
            <div className="flex h-36 w-full items-end justify-center">
              <div
                role="img"
                aria-label={hasSchedule ? `${name}: ${formatPercent(stat.occupancy)}` : `${name}: sin horarios`}
                title={hasSchedule ? `${name}: ${statDetail(stat)}` : `${name}: sin horarios`}
                className="w-full max-w-10 rounded-t bg-blue-500"
                style={{ height: `${stat.occupancy * 100}%` }}
              />
            </div>
            <span className="pb-1 text-[11px] text-foreground/60">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Métricas de ocupación del complejo para el período elegido: porcentaje de uso
 * general, por cancha, por día de la semana, por turno y el cruce día × turno
 * para detectar los horarios pico (ver computeOccupancyMetrics).
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

  const peakSlot = metrics ? peakOf(metrics.bySlot) : null;
  const peakDay = metrics ? peakOf(metrics.byDayOfWeek) : null;
  const heatmapSlots = metrics ? metrics.bySlot.map((s) => s.startMinutes) : [];
  const heatmapDays = metrics ? WEEK_DAYS.filter((day) => metrics.byDayAndSlot.some((c) => c.dayOfWeek === day)) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={preset.id === presetId}
            onClick={() => selectPreset(preset.id)}
            className={`cursor-pointer rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
              preset.id === presetId
                ? "bg-primary text-white"
                : "border border-line bg-card text-foreground/70 hover:bg-line/40 hover:text-foreground"
            }`}
          >
            {preset.label}
          </button>
        ))}
        {state.status === "ready" ? (
          <span className="ml-auto text-xs text-foreground/50">
            Del {state.range.from.toLocaleDateString("es-AR")} al {state.range.to.toLocaleDateString("es-AR")}
          </span>
        ) : null}
      </div>

      {state.status === "loading" ? <p className="text-sm text-foreground/60">Cargando...</p> : null}
      {state.status === "error" ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">
          {state.error}
        </div>
      ) : null}

      {metrics ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiTile label="Ocupación general" testId="kpi-occupancy" value={formatPercent(metrics.total.occupancy)} />
            <KpiTile
              label="Horas reservadas"
              testId="kpi-hours"
              value={`${formatDuration(metrics.total.bookedMinutes)} de ${formatDuration(metrics.total.availableMinutes)}`}
            />
            <KpiTile label="Turnos" testId="kpi-bookings" value={String(metrics.total.bookingsCount)} />
            <KpiTile
              label="Turno pico"
              testId="kpi-peak-slot"
              value={peakSlot ? `${slotLabel(peakSlot.startMinutes)} · ${formatPercent(peakSlot.occupancy)}` : "—"}
            />
            <KpiTile
              label="Día pico"
              testId="kpi-peak-day"
              value={peakDay ? `${DAY_LABELS[peakDay.dayOfWeek]} · ${formatPercent(peakDay.occupancy)}` : "—"}
            />
          </div>

          <ChartCard id="metrics-by-court" title="Ocupación por cancha">
            {metrics.byCourt.length === 0 ? (
              <p className="text-sm text-foreground/60">No hay canchas registradas.</p>
            ) : (
              <ul className="space-y-2.5">
                {metrics.byCourt.map((court) => (
                  <li key={court.courtId} className="flex items-center gap-3 text-sm">
                    <span className="w-20 shrink-0 font-medium text-foreground/70">Cancha {court.courtNumber}</span>
                    <div className="h-4 flex-1 rounded-r bg-line/40">
                      <div
                        role="img"
                        aria-label={`Cancha ${court.courtNumber}: ${formatPercent(court.occupancy)}`}
                        title={`Cancha ${court.courtNumber}: ${statDetail(court)}`}
                        className="h-full rounded-r bg-blue-500"
                        style={{ width: `${court.occupancy * 100}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-semibold text-foreground">
                      {formatPercent(court.occupancy)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>

          <div className="grid gap-5 xl:grid-cols-2">
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
                    label: formatSlotTime(slot.startMinutes),
                    name: slotLabel(slot.startMinutes),
                    stat: slot,
                  }))}
                />
              )}
            </ChartCard>
          </div>

          <ChartCard id="metrics-heatmap" title="Horarios pico">
            {heatmapDays.length === 0 ? (
              <p className="text-sm text-foreground/60">No hay horarios configurados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0.5 text-[11px]">
                  <thead>
                    <tr>
                      <th className="w-24" />
                      {heatmapSlots.map((slot) => (
                        <th key={slot} className="px-1 pb-1 text-center font-medium text-foreground/60">
                          {formatSlotTime(slot)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapDays.map((day) => (
                      <tr key={day}>
                        <th className="pr-2 text-left font-medium text-foreground/70">{DAY_LABELS[day]}</th>
                        {heatmapSlots.map((slot) => {
                          const cell = metrics.byDayAndSlot.find((c) => c.dayOfWeek === day && c.startMinutes === slot);
                          if (!cell || cell.availableMinutes === 0) {
                            return (
                              <td key={slot} className="h-8 min-w-14 rounded bg-line/30 text-center text-foreground/30">
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
                              className={`h-8 min-w-14 rounded px-1 text-center font-semibold ${
                                cell.occupancy > 0.55 ? "text-white" : "text-foreground/70"
                              }`}
                              style={{ backgroundColor: `rgba(${OCCUPIED_RGB}, ${0.08 + cell.occupancy * 0.92})` }}
                            >
                              {formatPercent(cell.occupancy)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-foreground/60">
                  0%
                  <span
                    className="h-2.5 w-32 rounded"
                    style={{ background: `linear-gradient(to right, rgba(${OCCUPIED_RGB}, 0.08), rgb(${OCCUPIED_RGB}))` }}
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
