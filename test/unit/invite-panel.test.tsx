// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { addPlayerToChat, refresh } = vi.hoisted(() => ({ addPlayerToChat: vi.fn(), refresh: vi.fn() }));

vi.mock("@/src/actions/chat", () => ({ addPlayerToChat }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { PlayerCategory } from "@/src/domain/enums";
import { InvitePanel } from "@/app/chats/[chatId]/invite-panel";

describe("InvitePanel", () => {
  const writeText = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("copies the invitation link of the chat to the clipboard", async () => {
    render(<InvitePanel chatId={12} />);

    fireEvent.click(screen.getByRole("button", { name: /Copiar link/ }));

    await waitFor(() => expect(screen.getByText("¡Link copiado!")).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/chats/12/join`);
  });

  it("shows the link to copy it by hand when the clipboard cannot be written", async () => {
    writeText.mockRejectedValueOnce(new Error("NotAllowedError"));
    render(<InvitePanel chatId={12} />);

    fireEvent.click(screen.getByRole("button", { name: /Copiar link/ }));

    await waitFor(() => expect(screen.getByDisplayValue(`${window.location.origin}/chats/12/join`)).toBeTruthy());
    expect(screen.queryByText("¡Link copiado!")).toBeNull();
  });

  it("shows the link to copy it by hand when the browser has no clipboard API", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    render(<InvitePanel chatId={12} />);

    fireEvent.click(screen.getByRole("button", { name: /Copiar link/ }));

    await waitFor(() => expect(screen.getByDisplayValue(`${window.location.origin}/chats/12/join`)).toBeTruthy());
  });

  it("adds a registered player by email or phone and refreshes the room", async () => {
    addPlayerToChat.mockResolvedValueOnce({
      success: true,
      data: { id: 9, names: "Caro", lastnames: "Gómez", category: PlayerCategory.FOURTH },
    });
    render(<InvitePanel chatId={12} />);

    fireEvent.change(screen.getByLabelText("Email o teléfono del jugador"), { target: { value: "caro@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => expect(screen.getByText("Caro Gómez se sumó al partido.")).toBeTruthy());
    expect(addPlayerToChat).toHaveBeenCalledWith(12, "caro@test.com");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the error when the player cannot be added", async () => {
    addPlayerToChat.mockResolvedValueOnce({
      success: false,
      error: "No encontramos un jugador registrado con ese email o teléfono.",
    });
    render(<InvitePanel chatId={12} />);

    fireEvent.change(screen.getByLabelText("Email o teléfono del jugador"), { target: { value: "nadie@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("No encontramos un jugador registrado con ese email o teléfono."),
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
