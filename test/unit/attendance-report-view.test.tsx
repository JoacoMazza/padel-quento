// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { getAttendanceReport } = vi.hoisted(() => ({ getAttendanceReport: vi.fn() }));

vi.mock("@/src/actions/reports", () => ({ getAttendanceReport }));

import { AttendanceReport } from "@/app/admin/attendance-report";

const REPORT = {
  success: true,
  data: {
    total: { attended: 3, noShows: 1, lateCancellations: 1, absenteeismRate: 0.4 },
    byPlayer: [
      {
        player: { id: 2, names: "Beto", lastnames: "López", phoneNumber: "2212222222" },
        attended: 0,
        noShows: 1,
        lateCancellations: 1,
        absenteeismRate: 1,
      },
      {
        player: { id: 1, names: "Ana", lastnames: "García", phoneNumber: "2211111111" },
        attended: 3,
        noShows: 0,
        lateCancellations: 0,
        absenteeismRate: 0,
      },
    ],
  },
};

describe("AttendanceReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Solo se congela la fecha (el rango por defecto es relativo a hoy); los timers siguen reales.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 12, 20, 0));
    getAttendanceReport.mockResolvedValue(REPORT);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("por defecto pide los últimos 30 días, hasta el final de hoy", async () => {
    render(<AttendanceReport />);

    await waitFor(() =>
      expect(getAttendanceReport).toHaveBeenCalledWith({
        from: new Date(2026, 8, 13),
        to: new Date(2026, 9, 12, 23, 59, 59, 999),
      }),
    );
    expect((screen.getByLabelText("Desde") as HTMLInputElement).value).toBe("2026-09-13");
    expect((screen.getByLabelText("Hasta") as HTMLInputElement).value).toBe("2026-10-12");
  });

  it("al cambiar el rango de fechas vuelve a pedir el reporte para ese rango", async () => {
    render(<AttendanceReport />);
    await screen.findByTestId("kpi-absenteeism");

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-05" } });

    await waitFor(() =>
      expect(getAttendanceReport).toHaveBeenLastCalledWith({
        from: new Date(2026, 9, 1),
        to: new Date(2026, 9, 5, 23, 59, 59, 999),
      }),
    );
  });

  it("muestra los totales de asistencias, ausencias, cancelaciones tardías y la tasa de ausentismo", async () => {
    render(<AttendanceReport />);

    expect((await screen.findByTestId("kpi-absenteeism")).textContent).toBe("40,00%");
    expect(screen.getByTestId("kpi-attended").textContent).toBe("3");
    expect(screen.getByTestId("kpi-no-shows").textContent).toBe("1");
    expect(screen.getByTestId("kpi-late-cancellations").textContent).toBe("1");
  });

  it("lista a cada jugador con su asistencia, ausencias, cancelaciones tardías y ausentismo", async () => {
    render(<AttendanceReport />);

    const table = await screen.findByRole("table", { name: "Asistencia por jugador" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([
      ["López, Beto", "2212222222", "0", "1", "1", "100,00%"],
      ["García, Ana", "2211111111", "3", "0", "0", "0,00%"],
    ]);
  });

  it("avisa cuando no hay registros en el período", async () => {
    getAttendanceReport.mockResolvedValue({
      success: true,
      data: { total: { attended: 0, noShows: 0, lateCancellations: 0, absenteeismRate: 0 }, byPlayer: [] },
    });
    render(<AttendanceReport />);

    expect(await screen.findByText("No hay registros de asistencia ni cancelaciones en el período.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("muestra el error si no se pudo generar el reporte", async () => {
    getAttendanceReport.mockResolvedValue({ success: false, error: "No se pudo generar el reporte de asistencia." });
    render(<AttendanceReport />);

    expect(await screen.findByText("No se pudo generar el reporte de asistencia.")).toBeTruthy();
  });

  it("exporta el reporte como un archivo CSV con el rango en el nombre", async () => {
    const createObjectURL = vi.fn(() => "blob:report");
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<AttendanceReport />);
    await screen.findByTestId("kpi-absenteeism");

    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(await blob.text()).toContain("López, Beto;2212222222;0;1;1;100,00%");
    const link = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(link.download).toBe("reporte-asistencia-2026-09-13-a-2026-10-12.csv");
  });
});
