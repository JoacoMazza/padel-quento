"use client";

import { useEffect, useState } from "react";
import { CalendarX, Download, Gauge, UserCheck, UserX } from "lucide-react";
import { getAttendanceReport } from "@/src/actions/reports";
import type { AttendanceReport as AttendanceReportData } from "@/src/domain/attendance-report";
import { formatPercent } from "@/app/admin/metrics-format";
import { attendanceReportToCsv } from "@/app/admin/attendance-csv";
import { StatCard } from "@/app/components/ui/stat-card";

/** Rango por defecto: los últimos 30 días, contando hoy. */
const DEFAULT_RANGE_DAYS = 30;

/** Fecha local en el formato de un input de tipo date (por ejemplo "2026-10-12"). */
function toInputDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Del primer día a las 00:00 al último a las 23:59:59.999, en hora local. */
function toRange(fromValue: string, toValue: string): { from: Date; to: Date } {
  const [fy, fm, fd] = fromValue.split("-").map(Number);
  const [ty, tm, td] = toValue.split("-").map(Number);
  return { from: new Date(fy, fm - 1, fd), to: new Date(ty, tm - 1, td, 23, 59, 59, 999) };
}

function downloadCsv(report: AttendanceReportData, fromValue: string, toValue: string) {
  // Con BOM para que Excel reconozca los acentos.
  const blob = new Blob(["﻿" + attendanceReportToCsv(report)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-asistencia-${fromValue}-a-${toValue}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Reporte de asistencia efectiva, ausencias y cancelaciones tardías en un rango
 * de fechas, en total y por jugador, exportable a CSV (ver getAttendanceReport).
 */
export function AttendanceReport() {
  const [fromValue, setFromValue] = useState(() => {
    const now = new Date();
    return toInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DEFAULT_RANGE_DAYS - 1)));
  });
  const [toValue, setToValue] = useState(() => toInputDate(new Date()));
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; error: string } | { status: "ready"; report: AttendanceReportData }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getAttendanceReport(toRange(fromValue, toValue)).then((result) => {
      if (cancelled) return;
      setState(result.success ? { status: "ready", report: result.data } : { status: "error", error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [fromValue, toValue]);

  // Un input de fecha vacío (borrado a mano) no es un rango válido: se ignora.
  function changeDate(setValue: (value: string) => void, value: string) {
    if (!value) return;
    setState({ status: "loading" });
    setValue(value);
  }

  const report = state.status === "ready" ? state.report : null;

  return (
    <div className="space-y-5">
      <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="attendance-from" className="field-label">
              Desde
            </label>
            <input
              id="attendance-from"
              type="date"
              className="field"
              value={fromValue}
              max={toValue}
              onChange={(e) => changeDate(setFromValue, e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="attendance-to" className="field-label">
              Hasta
            </label>
            <input
              id="attendance-to"
              type="date"
              className="field"
              value={toValue}
              min={fromValue}
              onChange={(e) => changeDate(setToValue, e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          disabled={!report}
          onClick={() => report && downloadCsv(report, fromValue, toValue)}
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      {state.status === "loading" ? <p className="text-sm text-foreground/60">Cargando...</p> : null}
      {state.status === "error" ? <div className="alert-error">{state.error}</div> : null}

      {report ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Tasa de ausentismo"
              value={<span data-testid="kpi-absenteeism">{formatPercent(report.total.absenteeismRate)}</span>}
              icon={<Gauge className="h-4 w-4" />}
              progress={report.total.absenteeismRate}
              tone="primary"
              footer="Ausencias y cancelaciones tardías sobre los turnos comprometidos"
            />
            <StatCard
              label="Asistencias"
              value={<span data-testid="kpi-attended">{report.total.attended}</span>}
              icon={<UserCheck className="h-4 w-4" />}
              footer="Jugadores presentes en turnos ya jugados"
            />
            <StatCard
              label="Ausencias"
              value={<span data-testid="kpi-no-shows">{report.total.noShows}</span>}
              icon={<UserX className="h-4 w-4" />}
              footer="Marcadas desde la turnera"
            />
            <StatCard
              label="Cancelaciones tardías"
              value={<span data-testid="kpi-late-cancellations">{report.total.lateCancellations}</span>}
              icon={<CalendarX className="h-4 w-4" />}
              footer="Con menos de 3 horas de anticipación"
            />
          </div>

          {report.byPlayer.length === 0 ? (
            <p className="text-sm text-foreground/60">No hay registros de asistencia ni cancelaciones en el período.</p>
          ) : (
            <div className="card overflow-x-auto">
              <table aria-label="Asistencia por jugador" className="w-full text-left text-sm">
                <thead className="border-b border-line bg-background/60">
                  <tr>
                    <th className="table-head">Jugador</th>
                    <th className="table-head">Teléfono</th>
                    <th className="table-head text-right">Asistencias</th>
                    <th className="table-head text-right">Ausencias</th>
                    <th className="table-head text-right">Cancelaciones tardías</th>
                    <th className="table-head text-right">Ausentismo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.byPlayer.map((row) => (
                    <tr key={row.player.id} className="transition-colors hover:bg-background/60">
                      <td className="table-cell font-semibold text-foreground">
                        {row.player.lastnames}, {row.player.names}
                      </td>
                      <td className="table-cell text-foreground/70">{row.player.phoneNumber}</td>
                      <td className="table-cell text-right tabular-nums">{row.attended}</td>
                      <td className="table-cell text-right tabular-nums">{row.noShows}</td>
                      <td className="table-cell text-right tabular-nums">{row.lateCancellations}</td>
                      <td className="table-cell text-right font-extrabold tabular-nums">
                        {formatPercent(row.absenteeismRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
