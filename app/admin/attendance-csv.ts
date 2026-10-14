import type { AttendanceReport } from "@/src/domain/attendance-report";
import { formatPercent } from "@/app/admin/metrics-format";

const HEADER = ["Jugador", "Teléfono", "Asistencias", "Ausencias", "Cancelaciones tardías", "Ausentismo"];

/** Encierra entre comillas el valor si tiene separadores, comillas o saltos de línea. */
function escape(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Reporte de asistencia como CSV separado por punto y coma (el que abre
 * directo Excel con la configuración regional argentina), con una fila por
 * jugador y una última de total.
 */
export function attendanceReportToCsv(report: AttendanceReport): string {
  const rows = [
    HEADER,
    ...report.byPlayer.map((row) => [
      `${row.player.lastnames}, ${row.player.names}`,
      row.player.phoneNumber,
      String(row.attended),
      String(row.noShows),
      String(row.lateCancellations),
      formatPercent(row.absenteeismRate),
    ]),
    [
      "Total",
      "",
      String(report.total.attended),
      String(report.total.noShows),
      String(report.total.lateCancellations),
      formatPercent(report.total.absenteeismRate),
    ],
  ];
  return rows.map((row) => row.map(escape).join(";")).join("\r\n");
}
