// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { getOccupancyReportData } = vi.hoisted(() => ({ getOccupancyReportData: vi.fn() }));

vi.mock("@/src/actions/metrics", () => ({ getOccupancyReportData }));

import { DayOfWeek } from "@/src/domain/enums";
import { OccupancyMetrics } from "@/app/admin/occupancy-metrics";

// 2026-10-12 es lunes.
const monday = (hours: number, minutes = 0) => new Date(2026, 9, 12, hours, minutes);

const REPORT = {
  success: true,
  data: {
    courts: [
      { id: 10, number: 1 },
      { id: 20, number: 2 },
    ],
    // Turnos de 8:00, 9:30 y 11:00 (ver occupancy.test.ts).
    schedules: [
      { courtId: 10, dayOfWeek: DayOfWeek.MONDAY, openingTime: "08:00:00", closingTime: "12:30:00" },
      { courtId: 20, dayOfWeek: DayOfWeek.MONDAY, openingTime: "09:30:00", closingTime: "12:30:00" },
    ],
    bookings: [
      { courtId: 10, fromDateTime: monday(8, 0), durationMinutes: 90 },
      { courtId: 10, fromDateTime: monday(11, 0), durationMinutes: 45 },
      { courtId: 20, fromDateTime: monday(9, 30), durationMinutes: 90 },
    ],
    outOfServices: [{ courtId: 20, fromDateTime: monday(11, 0), toDateTime: monday(12, 30) }],
  },
};

// Los últimos 7 días (6 al 12 de octubre) incluyen un único lunes: el del REPORT.
async function renderLastWeek() {
  render(<OccupancyMetrics />);
  await screen.findByTestId("kpi-occupancy");
  fireEvent.click(screen.getByRole("button", { name: "Últimos 7 días" }));
  await waitFor(() => expect(getOccupancyReportData).toHaveBeenCalledTimes(2));
}

describe("OccupancyMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Solo se congela la fecha (los rangos son relativos a hoy); los timers siguen reales.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 12, 20, 0));
    getOccupancyReportData.mockResolvedValue(REPORT);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("por defecto pide los últimos 30 días, hasta el final de hoy", async () => {
    render(<OccupancyMetrics />);

    await waitFor(() =>
      expect(getOccupancyReportData).toHaveBeenCalledWith({
        from: new Date(2026, 8, 13),
        to: new Date(2026, 9, 12, 23, 59, 59, 999),
      }),
    );
  });

  it("muestra los indicadores de ocupación general, horas reservadas, turnos y lo más solicitado", async () => {
    await renderLastWeek();

    expect((await screen.findByTestId("kpi-occupancy")).textContent).toBe("62,50%");
    expect(screen.getByTestId("kpi-hours").textContent).toBe("3h 45m de 6h");
    expect(screen.getByTestId("kpi-bookings").textContent).toBe("3");
    // El horario más solicitado se muestra por la hora en que empieza el turno.
    expect(screen.getByText("Horario más solicitado")).toBeTruthy();
    expect(screen.getByTestId("kpi-top-slot").textContent).toBe("08:00 · 100,00%");
    expect(screen.getByText("Día más solicitado")).toBeTruthy();
    expect(screen.getByTestId("kpi-top-day").textContent).toBe("Lunes · 62,50%");
    expect(screen.queryByText(/pico/i)).toBeNull();
  });

  it("grafica el porcentaje de uso por cancha", async () => {
    await renderLastWeek();

    const chart = await screen.findByRole("region", { name: "Ocupación por cancha" });
    const bar = within(chart).getByRole("img", { name: "Cancha 1: 50,00%" });
    // El color de ocupación es un token del tema (--color-occupied), no un color suelto.
    expect(bar.className).toContain("bg-occupied");
    expect(within(chart).getByRole("img", { name: "Cancha 2: 100,00%" })).toBeTruthy();
  });

  it("grafica el porcentaje de uso por día de la semana y por turno", async () => {
    await renderLastWeek();

    const byDay = await screen.findByRole("region", { name: "Ocupación por día de la semana" });
    expect(within(byDay).getByRole("img", { name: "Lunes: 62,50%" })).toBeTruthy();
    expect(within(byDay).getByRole("img", { name: "Martes: sin horarios" })).toBeTruthy();

    // Las columnas siguen la grilla de turnos de 90 minutos: 8, 9:30, 11.
    const bySlot = screen.getByRole("region", { name: "Ocupación por turno" });
    expect(within(bySlot).getByRole("img", { name: "9:30 a 11: 50,00%" })).toBeTruthy();
    expect(within(bySlot).getByText("9:30")).toBeTruthy();
    expect(within(bySlot).getByText("11")).toBeTruthy();
  });

  it("muestra el mapa de los turnos más solicitados por día y turno", async () => {
    await renderLastWeek();

    const heatmap = await screen.findByRole("region", { name: "Turnos más solicitados" });
    expect(within(heatmap).getByRole("img", { name: "Lunes 11 a 12:30: 50,00%" })).toBeTruthy();
  });

  it("al elegir otro período vuelve a pedir los datos para ese rango", async () => {
    render(<OccupancyMetrics />);
    await screen.findByTestId("kpi-occupancy");

    fireEvent.click(screen.getByRole("button", { name: "Últimos 7 días" }));

    await waitFor(() =>
      expect(getOccupancyReportData).toHaveBeenLastCalledWith({
        from: new Date(2026, 9, 6),
        to: new Date(2026, 9, 12, 23, 59, 59, 999),
      }),
    );
  });

  it("permite ver la ocupación de hoy", async () => {
    render(<OccupancyMetrics />);
    await screen.findByTestId("kpi-occupancy");

    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));

    await waitFor(() =>
      expect(getOccupancyReportData).toHaveBeenLastCalledWith({
        from: new Date(2026, 9, 12),
        to: new Date(2026, 9, 12, 23, 59, 59, 999),
      }),
    );
  });

  it("permite ver la ocupación de ayer", async () => {
    render(<OccupancyMetrics />);
    await screen.findByTestId("kpi-occupancy");

    fireEvent.click(screen.getByRole("button", { name: "Ayer" }));

    await waitFor(() =>
      expect(getOccupancyReportData).toHaveBeenLastCalledWith({
        from: new Date(2026, 9, 11),
        to: new Date(2026, 9, 11, 23, 59, 59, 999),
      }),
    );
  });

  it("permite ver la ocupación de los próximos 30 días", async () => {
    render(<OccupancyMetrics />);
    await screen.findByTestId("kpi-occupancy");

    fireEvent.click(screen.getByRole("button", { name: "Próximos 30 días" }));

    await waitFor(() =>
      expect(getOccupancyReportData).toHaveBeenLastCalledWith({
        from: new Date(2026, 9, 12),
        to: new Date(2026, 10, 10, 23, 59, 59, 999),
      }),
    );
  });

  it("muestra el error si no se pudieron obtener las métricas", async () => {
    getOccupancyReportData.mockResolvedValueOnce({
      success: false,
      error: "No se pudieron obtener las métricas de ocupación.",
    });
    render(<OccupancyMetrics />);

    expect(await screen.findByText("No se pudieron obtener las métricas de ocupación.")).toBeTruthy();
  });
});
