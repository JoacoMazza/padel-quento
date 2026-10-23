// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { push, createBooking, joinOpenMatch } = vi.hoisted(() => ({
  push: vi.fn(),
  createBooking: vi.fn(),
  joinOpenMatch: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/src/actions/booking", () => ({ createBooking, joinOpenMatch }));

import { BookingState, CourtState, DayOfWeek } from "@/src/domain/enums";
import { BookingsBoard } from "@/app/bookings/bookings-board";

const courts = [{ id: 1, number: 1, state: CourtState.AVAILABLE, price: 18000 }];
const schedules = [
  { id: 1, dayOfWeek: DayOfWeek.MONDAY, openingTime: "18:00:00", closingTime: "21:00:00", courtId: 1 },
];
const openMatch = {
  id: 50,
  fromDateTime: new Date(2026, 9, 12, 19, 30),
  durationMinutes: 90,
  bookingState: BookingState.RESERVED,
  price: 18000,
  needPlayers: true,
  courtId: 1,
  confirmedPlayers: 2,
  matchPlayerIds: [9],
};

function renderBoard(props: Partial<React.ComponentProps<typeof BookingsBoard>> = {}) {
  return render(
    <BookingsBoard
      playerId={7}
      isGuest={false}
      hasCategory
      {...props}
      courts={courts}
      schedules={schedules}
      bookings={[openMatch]}
      outOfServices={[]}
    />,
  );
}

describe("BookingsBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    // Lunes 12/10/2026 a las 10:00: todos los turnos del día siguen disponibles.
    vi.setSystemTime(new Date(2026, 9, 12, 10, 0));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("muestra los turnos del día en la grilla con su estado", () => {
    renderBoard();

    expect(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancha 1, 19:30, partido abierto" })).toBeTruthy();
  });

  it("al elegir un turno libre muestra el resumen para reservarlo", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));

    expect(screen.getByRole("button", { name: "Cancha 1, 18:00, seleccionado" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reservar turno/ })).toBeTruthy();
  });

  it("el turno seleccionado usa el fondo oscuro del resumen y apila el ícono sobre el texto", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));

    const classes = screen.getByRole("button", { name: "Cancha 1, 18:00, seleccionado" }).className.split(" ");
    expect(classes).toEqual(expect.arrayContaining(["flex-col", "bg-panel", "text-white"]));
    expect(classes).not.toContain("border-primary");
  });

  it("todas las celdas apilan el ícono sobre el texto", () => {
    renderBoard();

    for (const name of ["Cancha 1, 18:00, disponible", "Cancha 1, 19:30, partido abierto"]) {
      expect(screen.getByRole("button", { name }).className.split(" ")).toContain("flex-col");
    }
  });

  it("las celdas de la grilla solo muestran el estado del turno, sin precios", () => {
    renderBoard();

    expect(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }).textContent).toBe("Disponible");
    expect(screen.getByRole("button", { name: "Cancha 1, 19:30, partido abierto" }).textContent).toBe(
      "Partido abierto",
    );
    expect(screen.queryByText(/18\.000/)).toBeNull();
  });

  it("muestra fuera de servicio los turnos de una cancha bloqueada", () => {
    render(
      <BookingsBoard
        playerId={7}
        isGuest={false}
        hasCategory
        courts={courts}
        schedules={schedules}
        bookings={[]}
        outOfServices={[
          { id: 1, fromDateTime: new Date(2026, 9, 12, 18, 0), toDateTime: new Date(2026, 9, 12, 19, 30), courtId: 1 },
        ]}
      />,
    );

    const cell = screen.getByRole("button", { name: "Cancha 1, 18:00, fuera de servicio" });
    expect(cell.textContent).toBe("Fuera de servicio");
    expect((cell as HTMLButtonElement).disabled).toBe(true);
  });

  it("las columnas de las canchas se achican hasta 7.5rem para que entren todas en el ancho disponible", () => {
    renderBoard();

    const grid = screen.getByText("Horario").parentElement!;
    expect(grid.style.gridTemplateColumns).toBe("5.5rem repeat(1, minmax(7.5rem, 1fr))");
  });

  describe("resumen en pantallas chicas", () => {
    let scrollIntoView: ReturnType<typeof vi.fn>;

    function mockScreen(isLarge: boolean) {
      window.matchMedia = vi.fn((query: string) => ({ matches: isLarge && query === "(min-width: 64rem)" })) as never;
    }

    beforeEach(() => {
      scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView as never;
    });

    afterEach(() => {
      delete (window as { matchMedia?: unknown }).matchMedia;
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    });

    it("al elegir un turno lleva la vista al resumen, que queda debajo de la grilla", () => {
      mockScreen(false);
      renderBoard();

      fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
      const target = scrollIntoView.mock.contexts[0] as HTMLElement;
      expect(target.textContent).toContain("Reservar turno");
      // Deja lugar para el header fijo.
      expect(target.className.split(" ")).toContain("scroll-mt-20");
    });

    it("al elegir un partido abierto también lleva la vista al panel para sumarse", () => {
      mockScreen(false);
      renderBoard();

      fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 19:30, partido abierto" }));

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it("desde lg no mueve la vista: el resumen se ve al costado de la grilla", () => {
      mockScreen(true);
      renderBoard();

      fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));

      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it("al deseleccionar el turno no mueve la vista", () => {
      mockScreen(false);
      renderBoard();

      fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, seleccionado" }));

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
  });

  it("muestra el título Filtrar antes de los botones de fecha", () => {
    renderBoard();

    const title = screen.getByText("Filtrar");
    const firstDay = screen.getByRole("button", { name: /Hoy/ });
    expect(title.compareDocumentPosition(firstDay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("muestra el resumen del turno solo al elegir un turno disponible", () => {
    renderBoard();

    expect(screen.queryByRole("complementary", { name: "Resumen de tu turno" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));

    expect(screen.getByRole("complementary", { name: "Resumen de tu turno" })).toBeTruthy();
  });

  it("el resumen se cierra al volver a hacer click en el turno elegido", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, seleccionado" }));

    expect(screen.queryByRole("complementary", { name: "Resumen de tu turno" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" })).toBeTruthy();
  });

  it("el resumen se cierra con el botón Cerrar y descarta el turno elegido", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.queryByRole("complementary", { name: "Resumen de tu turno" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" })).toBeTruthy();
  });

  it("el resumen muestra la modalidad y el precio por jugador", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));

    expect(screen.getByText("Modalidad")).toBeTruthy();
    expect(screen.queryByText("¿Cómo vienen?")).toBeNull();
    expect(screen.getByText("$ 4.500 por jugador")).toBeTruthy();
  });

  it("sin categoría cargada, al elegir un partido abierto le pide completarla en su perfil", () => {
    renderBoard({ hasCategory: false });

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 19:30, partido abierto" }));

    expect(screen.getByText("Para sumarte a un partido abierto necesitás cargar tu categoría.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Completar mi perfil" }).getAttribute("href")).toBe("/profile");
    expect(screen.queryByRole("button", { name: "Sumarme al partido" })).toBeNull();
  });

  it("sin categoría cargada, al elegir buscar jugadores le pide completarla y no deja reservar", () => {
    renderBoard({ hasCategory: false });

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));
    fireEvent.click(screen.getByLabelText(/Buscar jugadores/));

    expect(screen.getByText("Para crear un partido abierto necesitás cargar tu categoría.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Completar mi perfil" }).getAttribute("href")).toBe("/profile");
    expect((screen.getByRole("button", { name: /Reservar turno/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sin categoría cargada puede reservar la cancha completa", () => {
    renderBoard({ hasCategory: false });

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));

    expect(screen.queryByText("Para crear un partido abierto necesitás cargar tu categoría.")).toBeNull();
    expect((screen.getByRole("button", { name: /Reservar turno/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("al volver a hacer click en el partido abierto elegido lo deselecciona en vez de ofrecer reservarlo", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 19:30, partido abierto" }));
    expect(screen.getByRole("button", { name: "Sumarme al partido" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 19:30, seleccionado" }));

    expect(screen.queryByRole("button", { name: "Sumarme al partido" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Reservar turno/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancha 1, 19:30, partido abierto" })).toBeTruthy();
  });

  describe("visitante sin sesión", () => {
    const loginFor = (bookingsUrl: string) => `/login?callbackUrl=${encodeURIComponent(bookingsUrl)}`;

    it("al reservar lo manda a iniciar sesión, con el turno elegido para volver, sin llamar a la reserva", () => {
      renderBoard({ playerId: null, isGuest: true });

      fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));
      fireEvent.click(screen.getByRole("button", { name: /Reservar turno/ }));

      expect(push).toHaveBeenCalledWith(loginFor("/bookings?date=2026-10-12&court=1&time=18:00"));
      expect(createBooking).not.toHaveBeenCalled();
    });

    it("al sumarse a un partido abierto lo manda a iniciar sesión, sin llamar a la acción", () => {
      renderBoard({ playerId: null, isGuest: true });

      fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 19:30, partido abierto" }));
      fireEvent.click(screen.getByRole("button", { name: "Sumarme al partido" }));

      expect(push).toHaveBeenCalledWith(loginFor("/bookings?date=2026-10-12&court=1&time=19:30"));
      expect(joinOpenMatch).not.toHaveBeenCalled();
    });
  });

  it("con sesión reserva sin mandar a nombre de quién: lo define el servidor", async () => {
    createBooking.mockResolvedValue({ success: true, data: {} });
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));
    fireEvent.click(screen.getByRole("button", { name: /Reservar turno/ }));

    await waitFor(() => expect(createBooking).toHaveBeenCalled());
    expect(createBooking.mock.calls[0][0]).not.toHaveProperty("bookerId");
    expect(createBooking.mock.calls[0][0]).toMatchObject({ courtId: 1, fromDateTime: new Date(2026, 9, 12, 18, 0) });
  });

  it("al volver del login deja elegido el turno que había seleccionado", () => {
    renderBoard({ initialSelection: { date: "2026-10-12", courtId: 1, time: "18:00" } });

    expect(screen.getByRole("button", { name: "Cancha 1, 18:00, seleccionado" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reservar turno/ })).toBeTruthy();
  });

  it("al volver del login deja elegido el partido abierto al que se quería sumar", () => {
    renderBoard({ initialSelection: { date: "2026-10-12", courtId: 1, time: "19:30" } });

    expect(screen.getByRole("button", { name: "Sumarme al partido" })).toBeTruthy();
  });

  it("ignora un turno elegido que ya no está disponible", () => {
    renderBoard({ initialSelection: { date: "2026-10-12", courtId: 1, time: "07:00" } });

    expect(screen.queryByRole("button", { name: /Reservar turno/ })).toBeNull();
  });
});
