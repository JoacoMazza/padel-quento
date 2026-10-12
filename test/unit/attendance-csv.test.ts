import { describe, expect, it } from "vitest";
import { attendanceReportToCsv } from "@/app/admin/attendance-csv";

describe("attendanceReportToCsv", () => {
  it("arma un CSV separado por punto y coma con una fila por jugador y una de total", () => {
    const csv = attendanceReportToCsv({
      total: { attended: 3, noShows: 1, lateCancellations: 0, absenteeismRate: 0.25 },
      byPlayer: [
        {
          player: { id: 1, names: "Ana", lastnames: "García", phoneNumber: "2211111111" },
          attended: 3,
          noShows: 1,
          lateCancellations: 0,
          absenteeismRate: 0.25,
        },
      ],
    });

    expect(csv.split("\r\n")).toEqual([
      "Jugador;Teléfono;Asistencias;Ausencias;Cancelaciones tardías;Ausentismo",
      "García, Ana;2211111111;3;1;0;25,00%",
      "Total;;3;1;0;25,00%",
    ]);
  });

  it("encierra entre comillas los valores con separadores o comillas", () => {
    const csv = attendanceReportToCsv({
      total: { attended: 1, noShows: 0, lateCancellations: 0, absenteeismRate: 0 },
      byPlayer: [
        {
          player: { id: 1, names: 'Ana "La Zurda"', lastnames: "García;Pérez", phoneNumber: "2211111111" },
          attended: 1,
          noShows: 0,
          lateCancellations: 0,
          absenteeismRate: 0,
        },
      ],
    });

    expect(csv.split("\r\n")[1]).toBe('"García;Pérez, Ana ""La Zurda""";2211111111;1;0;0;0,00%');
  });
});
