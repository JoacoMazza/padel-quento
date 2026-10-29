// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const {
  getScheduleBoardData,
  getCourts,
  getOutOfServices,
  getPlayersAdmin,
  getOccupancyReportData,
  getFixedBookingsAdmin,
  createFixedBooking,
  releaseFixedBookingDate,
  getAttendanceReport,
  createBookingAdmin,
  getAvailableSlotsAdmin,
  getTeam,
} = vi.hoisted(() => ({
  createBookingAdmin: vi.fn(),
  getTeam: vi.fn(),
  getAvailableSlotsAdmin: vi.fn(),
  createFixedBooking: vi.fn(),
  releaseFixedBookingDate: vi.fn(),
  getScheduleBoardData: vi.fn(),
  getCourts: vi.fn(),
  getOutOfServices: vi.fn(),
  getPlayersAdmin: vi.fn(),
  getOccupancyReportData: vi.fn(),
  getFixedBookingsAdmin: vi.fn(),
  getAttendanceReport: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/src/actions/scheduleBoard", () => ({ getScheduleBoardData }));
vi.mock("@/src/actions/court", () => ({ getCourts, updateCourt: vi.fn(), updateAllCourtsPrice: vi.fn() }));
vi.mock("@/src/actions/outOfService", () => ({
  getOutOfServices,
  createOutOfService: vi.fn(),
  endOutOfService: vi.fn(),
}));
vi.mock("@/src/actions/player", () => ({ getPlayersAdmin, blockPlayer: vi.fn(), unblockPlayer: vi.fn() }));
vi.mock("@/src/actions/metrics", () => ({ getOccupancyReportData }));
vi.mock("@/src/actions/reports", () => ({ getAttendanceReport }));
vi.mock("@/src/actions/attendance", () => ({ setBookingAttendance: vi.fn(), setMatchPlayerAttendance: vi.fn() }));
vi.mock("@/src/actions/admin", () => ({ getTeam, createAdmin: vi.fn(), updateAdmin: vi.fn(), deleteAdmin: vi.fn() }));
vi.mock("@/src/actions/adminBooking", () => ({ createBookingAdmin, getAvailableSlotsAdmin }));
vi.mock("@/src/actions/fixedBooking", () => ({
  getFixedBookingsAdmin,
  createFixedBooking,
  releaseFixedBookingDate,
  restoreFixedBookingDate: vi.fn(),
  cancelFixedBooking: vi.fn(),
}));

import { BookingState, CourtState, DayOfWeek, OutOfServiceReason, PlayerCategory } from "@/src/domain/enums";
import { AdminPanel } from "@/app/admin/admin-panel";
import { formatPrice } from "@/app/bookings/slot-utils";

const EMPTY_BOARD = {
  success: true,
  data: { courts: [], schedules: [], bookings: [], outOfServices: [], fixedBookingDates: [] },
};

// Deja que se resuelvan las promesas de las Server Actions mockeadas y se apliquen los setState.
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function openSection(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("AdminPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    getScheduleBoardData.mockResolvedValue(EMPTY_BOARD);
    getCourts.mockResolvedValue({
      success: true,
      data: [{ id: 1, number: 3, state: CourtState.AVAILABLE, price: 10000 }],
    });
    getOutOfServices.mockResolvedValue({ success: true, data: [] });
    getFixedBookingsAdmin.mockResolvedValue({ success: true, data: [] });
    getTeam.mockResolvedValue({ success: true, data: [] });
    getAvailableSlotsAdmin.mockResolvedValue({ success: true, data: ["09:30", "18:00"] });
    getOccupancyReportData.mockResolvedValue({
      success: true,
      data: { courts: [], schedules: [], bookings: [], outOfServices: [] },
    });
    getAttendanceReport.mockResolvedValue({
      success: true,
      data: { total: { attended: 0, noShows: 0, lateCancellations: 0, absenteeismRate: 0 }, byPlayer: [] },
    });
    getPlayersAdmin.mockResolvedValue({
      success: true,
      data: [
        {
          id: 7,
          names: "Ana",
          lastnames: "Gómez",
          email: "ana@test.com",
          phoneNumber: "2215550101",
          category: PlayerCategory.FOURTH,
          scoring: 0,
          isBlocked: false,
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("al entrar solo pide los datos de la Turnera Global y de sus turnos fijos", async () => {
    render(<AdminPanel isOwner />);
    await flush();

    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);
    // Turnos fijos, y las canchas y jugadores que ofrece su alta.
    expect(getFixedBookingsAdmin).toHaveBeenCalledTimes(1);
    expect(getCourts).toHaveBeenCalledTimes(1);
    expect(getPlayersAdmin).toHaveBeenCalledTimes(1);
    expect(getOutOfServices).not.toHaveBeenCalled();
    expect(getOccupancyReportData).not.toHaveBeenCalled();
    expect(getAttendanceReport).not.toHaveBeenCalled();
  });

  describe("en pantallas chicas", () => {
    function classesOf(element: Element) {
      return element.className.split(" ");
    }

    it("las secciones quedan arriba del contenido, y al costado desde lg", async () => {
      render(<AdminPanel isOwner />);
      await flush();

      const aside = screen.getByRole("navigation").closest("aside")!;
      expect(classesOf(aside.parentElement!)).toEqual(expect.arrayContaining(["flex-col", "lg:flex-row"]));
      expect(classesOf(aside)).toEqual(expect.arrayContaining(["border-b", "lg:w-64", "lg:border-r"]));
      expect(classesOf(aside)).not.toContain("w-64");
    });

    it("las secciones quedan detrás de un botón hamburguesa que muestra la sección actual", async () => {
      render(<AdminPanel isOwner />);
      await flush();

      const toggle = screen.getByRole("button", { name: "Abrir secciones" });
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(classesOf(toggle)).toContain("lg:hidden");
      expect(toggle.textContent).toContain("Turnera Global");
      expect(classesOf(screen.getByRole("navigation"))).toEqual(expect.arrayContaining(["hidden", "lg:flex"]));
    });

    it("al abrirlo, las secciones se despliegan de arriba hacia abajo", async () => {
      render(<AdminPanel isOwner />);
      await flush();

      fireEvent.click(screen.getByRole("button", { name: "Abrir secciones" }));

      const nav = screen.getByRole("navigation");
      expect(classesOf(nav)).toEqual(expect.arrayContaining(["flex", "motion-safe:animate-slide-down"]));
      expect(classesOf(nav)).not.toContain("hidden");
      expect(screen.getByRole("button", { name: "Cerrar secciones" }).getAttribute("aria-expanded")).toBe("true");
    });

    it("el menú de secciones se cierra al tocar fuera de él, pero no al tocar adentro", async () => {
      render(<AdminPanel isOwner />);
      await flush();

      fireEvent.click(screen.getByRole("button", { name: "Abrir secciones" }));
      fireEvent.pointerDown(screen.getByRole("navigation"));
      expect(classesOf(screen.getByRole("navigation"))).not.toContain("hidden");

      fireEvent.pointerDown(screen.getByRole("main"));
      expect(classesOf(screen.getByRole("navigation"))).toContain("hidden");
      expect(screen.getByRole("button", { name: "Abrir secciones" }).getAttribute("aria-expanded")).toBe("false");
    });

    it("al elegir una sección el menú se cierra y el botón pasa a mostrarla", async () => {
      render(<AdminPanel isOwner />);
      await flush();

      fireEvent.click(screen.getByRole("button", { name: "Abrir secciones" }));
      openSection("Canchas");
      await flush();

      expect(classesOf(screen.getByRole("navigation"))).toContain("hidden");
      expect(screen.getByRole("button", { name: "Abrir secciones" }).textContent).toContain("Canchas");
    });

    it("cada sección del menú ocupa todo el ancho y mide 44 px en pantallas táctiles", async () => {
      render(<AdminPanel isOwner />);
      await flush();

      expect(classesOf(within(screen.getByRole("navigation")).getByRole("button", { name: "Canchas" }))).toEqual(
        expect.arrayContaining(["w-full", "pointer-coarse:py-3"]),
      );
    });

    it("ocultan el rótulo del panel y Cerrar sesión, que queda en el menú de usuario del header", async () => {
      render(<AdminPanel isOwner />);
      await flush();

      expect(classesOf(screen.getByText("Panel operativo"))).toEqual(expect.arrayContaining(["hidden", "lg:block"]));
      expect(classesOf(screen.getByRole("button", { name: "Cerrar sesión" }).parentElement!)).toEqual(
        expect.arrayContaining(["hidden", "lg:block"]),
      );
    });

    it("el contenido usa el mismo margen lateral que el header", async () => {
      render(<AdminPanel isOwner />);
      await flush();

      expect(classesOf(screen.getByRole("main"))).toEqual(expect.arrayContaining(["px-6", "lg:px-8"]));
    });
  });

  it("los turnos fijos están en la Turnera Global, debajo de la grilla, y no en una sección aparte", async () => {
    render(<AdminPanel isOwner />);
    await flush();

    const nav = within(screen.getByRole("navigation"));
    expect(nav.queryByRole("button", { name: "Turnos Fijos" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Turnos fijos" })).toBeTruthy();
    expect(screen.getByText("Todavía no hay turnos fijos.")).toBeTruthy();
  });

  it("el botón Registrar turno fijo está junto a Actualizar y abre el alta", async () => {
    render(<AdminPanel isOwner />);
    await flush();

    const refreshButton = screen.getByRole("button", { name: "Actualizar turnera" });
    const registerButton = screen.getByRole("button", { name: "Registrar turno fijo" });
    expect(registerButton.parentElement).toBe(refreshButton.parentElement);

    fireEvent.click(registerButton);
    expect(screen.getByRole("heading", { name: "Nuevo turno fijo" })).toBeTruthy();
  });

  it("los botones de la turnera van en orden: Actualizar, Agendar turno y Registrar turno fijo", async () => {
    render(<AdminPanel isOwner />);
    await flush();

    const refreshButton = screen.getByRole("button", { name: "Actualizar turnera" });
    const toolbar = within(refreshButton.parentElement!);
    const names = toolbar.getAllByRole("button").map((b) => b.textContent?.trim() || b.getAttribute("aria-label"));
    expect(names).toEqual(["Actualizar", "Agendar turno", "Registrar turno fijo"]);
  });

  it("Agendar turno abre el alta de un turno común", async () => {
    render(<AdminPanel isOwner />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Agendar turno" }));

    expect(screen.getByRole("heading", { name: "Nuevo turno" })).toBeTruthy();
    expect((screen.getByLabelText("Precio") as HTMLInputElement).value).toBe(formatPrice(10000));
  });

  it("al agendar un turno cierra el alta, actualiza la grilla y avisa", async () => {
    createBookingAdmin.mockResolvedValue({ success: true, data: { id: 9 } });
    render(<AdminPanel isOwner />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Agendar turno" }));
    await flush();
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "18:00" } });
    fireEvent.change(screen.getByLabelText("Jugador"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar turno" }));
    await flush();

    expect(createBookingAdmin).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "Nuevo turno" })).toBeNull();
    expect(getScheduleBoardData).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Turno agendado.")).toBeTruthy();
  });

  it("click en una celda libre de la grilla abre el alta con esa cancha, día y hora", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 9, 0));
    getScheduleBoardData.mockResolvedValue({
      success: true,
      data: {
        ...EMPTY_BOARD.data,
        courts: [{ id: 1, number: 3, state: CourtState.AVAILABLE, price: 10000 }],
        schedules: [
          { id: 1, dayOfWeek: DayOfWeek.MONDAY, openingTime: "08:00:00", closingTime: "23:00:00", court: { id: 1 } },
        ],
      },
    });
    render(<AdminPanel isOwner />);
    await flush();

    fireEvent.click(screen.getAllByTitle("Agendar turno")[0]);
    await flush();

    expect(screen.getByRole("heading", { name: "Nuevo turno" })).toBeTruthy();
    expect((screen.getByLabelText("Cancha") as HTMLSelectElement).value).toBe("1");
    expect((screen.getByLabelText("Fecha") as HTMLInputElement).value).toBe("2026-10-12");
    expect((screen.getByLabelText("Hora") as HTMLInputElement).value).toBe("09:30");
  });

  it("al crear un turno fijo actualiza la grilla para que aparezcan sus fechas", async () => {
    createFixedBooking.mockResolvedValue({ success: true, data: { id: 2, conflicts: [] } });
    render(<AdminPanel isOwner />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Registrar turno fijo" }));
    fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: "2026-10-20" } });
    await flush();
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "18:00" } });
    fireEvent.change(screen.getByLabelText("Jugador"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear turno fijo" }));
    await flush();

    expect(createFixedBooking).toHaveBeenCalledTimes(1);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Turno fijo creado.")).toBeTruthy();
  });

  it("al liberar una fecha desde la grilla actualiza también el listado de turnos fijos", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 9, 0));
    releaseFixedBookingDate.mockResolvedValue({ success: true, data: null });
    getScheduleBoardData.mockResolvedValue({
      success: true,
      data: {
        ...EMPTY_BOARD.data,
        courts: [{ id: 1, number: 3, state: CourtState.AVAILABLE, price: 10000 }],
        schedules: [
          { id: 1, dayOfWeek: DayOfWeek.MONDAY, openingTime: "08:00:00", closingTime: "23:00:00", court: { id: 1 } },
        ],
        bookings: [
          {
            id: 5,
            fromDateTime: new Date(2026, 9, 12, 18, 0),
            durationMinutes: 90,
            bookingState: BookingState.RESERVED,
            price: 10000,
            attended: false,
            court: { id: 1 },
            booker: { id: 3, names: "Grupo", lastnames: "Lunes" },
            match: null,
          },
        ],
        fixedBookingDates: [{ bookingId: 5, fixedBookingDateId: 9 }],
      },
    });
    render(<AdminPanel isOwner />);
    await flush();
    expect(getFixedBookingsAdmin).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByText("Turno fijo").find((el) => el.getAttribute("role") === "button")!);
    fireEvent.click(screen.getByRole("button", { name: "Liberar esta fecha" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await flush();

    expect(releaseFixedBookingDate).toHaveBeenCalledWith(9);
    expect(getFixedBookingsAdmin).toHaveBeenCalledTimes(2);
  });

  it("pide las métricas de ocupación recién al abrir su sección", async () => {
    render(<AdminPanel isOwner />);
    await flush();

    openSection("Métricas del Complejo");
    await flush();

    expect(getOccupancyReportData).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Métricas del Complejo" })).toBeTruthy();
  });

  it("pide el reporte de asistencia recién al abrir su sección", async () => {
    render(<AdminPanel isOwner />);
    await flush();

    openSection("Reportes de Asistencia");
    await flush();

    expect(getAttendanceReport).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Reportes de Asistencia" })).toBeTruthy();
  });

  it("el menú tiene una sola sección de canchas, sin el Bloqueo de Canchas obsoleto", async () => {
    render(<AdminPanel isOwner />);
    await flush();

    const nav = within(screen.getByRole("navigation"));
    expect(nav.getByRole("button", { name: "Canchas" })).toBeTruthy();
    expect(nav.queryByText("Estado de Canchas")).toBeNull();
    expect(nav.queryByText("Bloqueo de Canchas")).toBeNull();
  });

  it("pide las canchas recién al abrir su sección y las muestra", async () => {
    render(<AdminPanel isOwner />);
    await flush();

    getCourts.mockClear();
    getPlayersAdmin.mockClear();
    openSection("Canchas");
    await flush();

    expect(getCourts).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Cancha 3")).toBeTruthy();
    expect(getPlayersAdmin).not.toHaveBeenCalled();
  });

  it("muestra fuera de servicio la cancha con un bloqueo activo, pero no por uno programado o vencido", async () => {
    vi.setSystemTime(new Date("2026-10-01T10:00:00"));
    getCourts.mockResolvedValue({
      success: true,
      data: [
        { id: 1, number: 3, state: CourtState.AVAILABLE, price: 10000 },
        { id: 2, number: 4, state: CourtState.AVAILABLE, price: 10000 },
      ],
    });
    getOutOfServices.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 20,
          fromDateTime: new Date("2026-10-01T09:00:00"),
          toDateTime: new Date("2026-10-01T12:00:00"),
          reason: OutOfServiceReason.MAINTENANCE,
          court: { id: 1 },
        },
        {
          id: 21,
          fromDateTime: new Date("2026-10-02T09:00:00"),
          toDateTime: new Date("2026-10-02T12:00:00"),
          reason: OutOfServiceReason.CLEANING,
          court: { id: 2 },
        },
        {
          id: 22,
          fromDateTime: new Date("2026-09-30T09:00:00"),
          toDateTime: new Date("2026-09-30T12:00:00"),
          reason: OutOfServiceReason.OTHER,
          court: { id: 2 },
        },
      ],
    });
    render(<AdminPanel isOwner />);
    await flush();

    openSection("Canchas");
    await flush();

    const row = (courtLabel: string) => within(screen.getByText(courtLabel).closest("tr")!);
    expect(row("Cancha 3").getByText("Fuera de Servicio (Mantenimiento)")).toBeTruthy();
    expect(row("Cancha 4").getByText("Disponible")).toBeTruthy();
  });

  it("pide los usuarios recién al abrir su sección y los muestra", async () => {
    render(<AdminPanel isOwner />);
    await flush();

    getCourts.mockClear();
    getPlayersAdmin.mockClear();
    openSection("Gestión de Usuarios");
    await flush();

    expect(getPlayersAdmin).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Ana/)).toBeTruthy();
    expect(getCourts).not.toHaveBeenCalled();
  });

  it("mantiene en memoria lo ya obtenido al volver a una sección visitada", async () => {
    render(<AdminPanel isOwner />);
    await flush();
    getCourts.mockClear();
    getPlayersAdmin.mockClear();

    openSection("Canchas");
    await flush();
    openSection("Gestión de Usuarios");
    await flush();
    openSection("Canchas");
    await flush();
    openSection("Turnera Global");
    await flush();

    expect(getCourts).toHaveBeenCalledTimes(1);
    expect(getPlayersAdmin).toHaveBeenCalledTimes(1);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);
  });

  it("muestra el error si no se pudieron obtener las canchas", async () => {
    render(<AdminPanel isOwner />);
    await flush();
    getCourts.mockResolvedValueOnce({ success: false, error: "No se pudieron obtener las canchas." });

    openSection("Canchas");
    await flush();

    expect(screen.getByText("No se pudieron obtener las canchas.")).toBeTruthy();
  });

  it("pausa el refresco en vivo de la turnera mientras no está visible", async () => {
    render(<AdminPanel isOwner />);
    await flush();

    openSection("Canchas");
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);
  });

  describe("dueño y trabajador", () => {
    it("al dueño le muestra Métricas, Reportes y Equipo", async () => {
      render(<AdminPanel isOwner />);
      await flush();

      const nav = within(screen.getByRole("navigation"));
      for (const label of ["Métricas del Complejo", "Reportes de Asistencia", "Equipo"]) {
        expect(nav.getByRole("button", { name: label })).toBeTruthy();
      }
    });

    it("a un trabajador le oculta Métricas, Reportes y Equipo", async () => {
      render(<AdminPanel isOwner={false} />);
      await flush();

      const nav = within(screen.getByRole("navigation"));
      for (const label of ["Métricas del Complejo", "Reportes de Asistencia", "Equipo"]) {
        expect(nav.queryByRole("button", { name: label })).toBeNull();
      }
      expect(nav.getByRole("button", { name: "Turnera Global" })).toBeTruthy();
      expect(nav.getByRole("button", { name: "Canchas" })).toBeTruthy();
      expect(nav.getByRole("button", { name: "Gestión de Usuarios" })).toBeTruthy();
    });

    it("pide el equipo recién al abrir su sección y lo muestra", async () => {
      getTeam.mockResolvedValue({
        success: true,
        data: [{ id: 1, names: "Mario", lastnames: "Dueño", dni: 30111222, email: "m@q.com", accessLevel: "owner", isSelf: true }],
      });
      render(<AdminPanel isOwner />);
      await flush();
      expect(getTeam).not.toHaveBeenCalled();

      openSection("Equipo");
      await flush();

      expect(getTeam).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Mario Dueño")).toBeTruthy();
    });
  });
});
