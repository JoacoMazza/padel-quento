export type ReportPlayer = { id: number; names: string; lastnames: string; phoneNumber: string };

export type AttendanceReportInput = {
  /** Una entrada por jugador y turno ya finalizado (no cancelado). */
  attendances: Array<{ player: ReportPlayer; attended: boolean }>;
  /** Una entrada por cancelación (o baja de un partido abierto) tardía. */
  lateCancellations: Array<{ player: ReportPlayer }>;
};

export type AttendanceStat = {
  attended: number;
  noShows: number;
  lateCancellations: number;
  /**
   * Ausencias más cancelaciones tardías sobre el total de turnos comprometidos
   * (asistencias + ausencias + cancelaciones tardías), entre 0 y 1 (0 si no hay ninguno).
   */
  absenteeismRate: number;
};

export type AttendanceReport = {
  total: AttendanceStat;
  /** De mayor a menor ausentismo y, ante un empate, por apellido y nombre. */
  byPlayer: Array<AttendanceStat & { player: ReportPlayer }>;
};

type Counter = { attended: number; noShows: number; lateCancellations: number };

function toStat({ attended, noShows, lateCancellations }: Counter): AttendanceStat {
  const committed = attended + noShows + lateCancellations;
  return {
    attended,
    noShows,
    lateCancellations,
    absenteeismRate: committed > 0 ? (noShows + lateCancellations) / committed : 0,
  };
}

/**
 * Reporte de asistencia efectiva, ausencias y cancelaciones tardías para
 * monitorear el ausentismo del complejo, en total y por jugador.
 */
export function computeAttendanceReport(input: AttendanceReportInput): AttendanceReport {
  const total: Counter = { attended: 0, noShows: 0, lateCancellations: 0 };
  const byPlayer = new Map<number, { player: ReportPlayer; counter: Counter }>();

  const counterFor = (player: ReportPlayer) => {
    const entry = byPlayer.get(player.id) ?? { player, counter: { attended: 0, noShows: 0, lateCancellations: 0 } };
    byPlayer.set(player.id, entry);
    return entry.counter;
  };

  for (const { player, attended } of input.attendances) {
    const key = attended ? "attended" : "noShows";
    counterFor(player)[key] += 1;
    total[key] += 1;
  }
  for (const { player } of input.lateCancellations) {
    counterFor(player).lateCancellations += 1;
    total.lateCancellations += 1;
  }

  return {
    total: toStat(total),
    byPlayer: [...byPlayer.values()]
      .map(({ player, counter }) => ({ player, ...toStat(counter) }))
      .sort(
        (a, b) =>
          b.absenteeismRate - a.absenteeismRate ||
          a.player.lastnames.localeCompare(b.player.lastnames, "es") ||
          a.player.names.localeCompare(b.player.names, "es"),
      ),
  };
}
