// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { addPlayerToMatch, refresh } = vi.hoisted(() => ({ addPlayerToMatch: vi.fn(), refresh: vi.fn() }));

vi.mock("@/src/actions/match", () => ({ addPlayerToMatch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { PlayerCategory } from "@/src/domain/enums";
import { AddPlayerForm } from "@/app/open-matches/add-player-form";

describe("AddPlayerForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("adds a registered player by email or phone to the match and refreshes the page", async () => {
    addPlayerToMatch.mockResolvedValueOnce({
      success: true,
      data: { id: 9, names: "Caro", lastnames: "Gómez", category: PlayerCategory.FOURTH },
    });
    render(<AddPlayerForm bookingId={34} />);

    fireEvent.change(screen.getByLabelText("Email o teléfono del jugador"), { target: { value: "caro@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => expect(screen.getByText("Caro Gómez se sumó al partido.")).toBeTruthy());
    expect(addPlayerToMatch).toHaveBeenCalledWith(34, "caro@test.com");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the error when the player cannot be added", async () => {
    addPlayerToMatch.mockResolvedValueOnce({
      success: false,
      error: "No encontramos un jugador registrado con ese email o teléfono.",
    });
    render(<AddPlayerForm bookingId={34} />);

    fireEvent.change(screen.getByLabelText("Email o teléfono del jugador"), { target: { value: "nadie@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("No encontramos un jugador registrado con ese email o teléfono."),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not submit an empty identifier", () => {
    render(<AddPlayerForm bookingId={34} />);

    expect((screen.getByRole("button", { name: "Agregar" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
