// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { push, joinOpenMatch } = vi.hoisted(() => ({ push: vi.fn(), joinOpenMatch: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/src/actions/booking", () => ({ joinOpenMatch }));

import { JoinMatchCard } from "@/app/open-matches/[bookingId]/join-match-card";

type Props = React.ComponentProps<typeof JoinMatchCard>;

function renderCard(overrides: Partial<Props> = {}) {
  return render(
    <JoinMatchCard
      bookingId={10}
      isGuest={false}
      courtNumber={2}
      timeRange="19:30 – 21:00"
      dateLabel="Lunes 12 de octubre"
      price={18000}
      remainingSpots={2}
      status="open"
      alreadyJoined={false}
      chatId={null}
      hasCategory
      {...overrides}
    />,
  );
}

describe("JoinMatchCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("se suma al partido con la cantidad de jugadores elegida y va a mis turnos", async () => {
    joinOpenMatch.mockResolvedValueOnce({ success: true, data: {} });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "2 jugadores" }));
    fireEvent.click(screen.getByRole("button", { name: "Sumarme al partido" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/my-bookings"));
    expect(joinOpenMatch).toHaveBeenCalledWith({ bookingId: 10, groupSize: 2 });
  });

  it("no ofrece elegir la cantidad si queda un solo lugar", () => {
    renderCard({ remainingSpots: 1 });

    expect(screen.queryByRole("button", { name: "1 jugador" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sumarme al partido" })).toBeTruthy();
  });

  it("muestra el error si no se pudo sumar", async () => {
    joinOpenMatch.mockResolvedValueOnce({ success: false, error: "El partido ya está completo, no quedan lugares libres." });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Sumarme al partido" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "El partido ya está completo, no quedan lugares libres.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("si el jugador no tiene categoría, le pide completarla en su perfil en vez de dejarlo sumarse", () => {
    renderCard({ hasCategory: false });

    expect(screen.getByText("Para sumarte a un partido abierto necesitás cargar tu categoría.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Completar mi perfil" }).getAttribute("href")).toBe("/profile");
    expect(screen.queryByRole("button", { name: "Sumarme al partido" })).toBeNull();
  });

  it("muestra el error de categoría distinta que devuelve el servidor", async () => {
    joinOpenMatch.mockResolvedValueOnce({ success: false, error: "Este partido es para jugadores de 3ª Categoría." });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Sumarme al partido" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Este partido es para jugadores de 3ª Categoría.");
    expect(push).not.toHaveBeenCalled();
  });

  it("a un visitante sin sesión lo manda a iniciar sesión y a volver a este partido", () => {
    renderCard({ isGuest: true });

    fireEvent.click(screen.getByRole("button", { name: "Sumarme al partido" }));

    expect(push).toHaveBeenCalledWith("/login?callbackUrl=%2Fopen-matches%2F10");
    expect(joinOpenMatch).not.toHaveBeenCalled();
  });

  it("a quien ya está anotado le ofrece ir al chat en lugar de sumarse", () => {
    renderCard({ alreadyJoined: true, chatId: 4 });

    expect(screen.queryByRole("button", { name: "Sumarme al partido" })).toBeNull();
    expect(screen.getByText("Ya formás parte de este partido.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /chat del partido/i }).getAttribute("href")).toBe("/chats/4");
  });

  it("no permite sumarse a un partido completo, cancelado o que ya empezó", () => {
    renderCard({ status: "full" });
    expect(screen.queryByRole("button", { name: "Sumarme al partido" })).toBeNull();
    expect(screen.getByText("Este partido ya está completo.")).toBeTruthy();
    cleanup();

    renderCard({ status: "cancelled" });
    expect(screen.getByText("Este turno fue cancelado.")).toBeTruthy();
    cleanup();

    renderCard({ status: "past" });
    expect(screen.getByText("Este partido ya empezó.")).toBeTruthy();
  });
});
