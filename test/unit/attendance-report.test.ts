import { describe, expect, it } from "vitest";
import { computeAttendanceReport } from "@/src/domain/attendance-report";

const ana = { id: 1, names: "Ana", lastnames: "García", phoneNumber: "2211111111" };
const beto = { id: 2, names: "Beto", lastnames: "López", phoneNumber: "2212222222" };
const carla = { id: 3, names: "Carla", lastnames: "Díaz", phoneNumber: "2213333333" };

describe("computeAttendanceReport", () => {
  it("devuelve todo en cero si no hay turnos ni cancelaciones", () => {
    expect(computeAttendanceReport({ attendances: [], lateCancellations: [] })).toEqual({
      total: { attended: 0, noShows: 0, lateCancellations: 0, absenteeismRate: 0 },
      byPlayer: [],
    });
  });

  it("cuenta asistencias, ausencias y cancelaciones tardías por jugador y en total", () => {
    const report = computeAttendanceReport({
      attendances: [
        { player: ana, attended: true },
        { player: ana, attended: true },
        { player: ana, attended: false },
        { player: beto, attended: true },
      ],
      lateCancellations: [{ player: ana }, { player: carla }],
    });

    expect(report.total).toEqual({ attended: 3, noShows: 1, lateCancellations: 2, absenteeismRate: 3 / 6 });
    expect(report.byPlayer).toContainEqual({
      player: ana,
      attended: 2,
      noShows: 1,
      lateCancellations: 1,
      absenteeismRate: 2 / 4,
    });
    expect(report.byPlayer).toContainEqual({
      player: beto,
      attended: 1,
      noShows: 0,
      lateCancellations: 0,
      absenteeismRate: 0,
    });
    expect(report.byPlayer).toContainEqual({
      player: carla,
      attended: 0,
      noShows: 0,
      lateCancellations: 1,
      absenteeismRate: 1,
    });
  });

  it("ordena a los jugadores de mayor a menor ausentismo y, ante un empate, por apellido", () => {
    const report = computeAttendanceReport({
      attendances: [
        { player: beto, attended: true },
        { player: ana, attended: true },
        { player: carla, attended: false },
      ],
      lateCancellations: [],
    });

    expect(report.byPlayer.map((row) => row.player.id)).toEqual([carla.id, ana.id, beto.id]);
  });
});
