// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/src/actions/chat", () => ({ getChatMessages: vi.fn(), sendMessage: vi.fn() }));

import { PlayerCategory } from "@/src/domain/enums";
import { ChatRoom } from "@/app/chats/[chatId]/chat-room";

describe("ChatRoom", () => {
  beforeAll(() => {
    // jsdom no implementa scrollTo, que la sala usa para bajar al último mensaje.
    Element.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("permite escribir mientras la sala está abierta", () => {
    render(<ChatRoom chatId={1} currentPlayerId={7} initialMessages={[]} closedReason={null} />);

    expect(screen.getByPlaceholderText("Escribir mensaje…")).toBeTruthy();
  });

  it("bloquea el envío e informa que el turno finalizó", () => {
    render(<ChatRoom chatId={1} currentPlayerId={7} initialMessages={[]} closedReason="finished" />);

    expect(screen.queryByPlaceholderText("Escribir mensaje…")).toBeNull();
    expect(screen.getByText(/el turno ya finalizó/)).toBeTruthy();
  });

  it("bloquea el envío e informa que el turno fue cancelado, manteniendo el historial", () => {
    render(
      <ChatRoom
        chatId={1}
        currentPlayerId={7}
        initialMessages={[
          {
            id: 1,
            content: "Nos vemos en la cancha",
            sentAt: new Date("2026-10-01T10:00:00"),
            sender: { id: 8, names: "Beto", lastnames: "Pérez", category: PlayerCategory.FOURTH },
          },
        ]}
        closedReason="cancelled"
      />,
    );

    expect(screen.queryByPlaceholderText("Escribir mensaje…")).toBeNull();
    expect(screen.getByText(/el turno fue cancelado/)).toBeTruthy();
    expect(screen.getByText("Nos vemos en la cancha")).toBeTruthy();
  });
});
