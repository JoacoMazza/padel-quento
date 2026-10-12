// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { joinChatMatch, push } = vi.hoisted(() => ({ joinChatMatch: vi.fn(), push: vi.fn() }));

vi.mock("@/src/actions/chat", () => ({ joinChatMatch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { JoinChatButton } from "@/app/chats/[chatId]/join/join-chat-button";

describe("JoinChatButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("joins the match and goes to the chat room", async () => {
    joinChatMatch.mockResolvedValueOnce({ success: true, data: null });
    render(<JoinChatButton chatId={12} />);

    fireEvent.click(screen.getByRole("button", { name: "Sumarme al partido" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/chats/12"));
    expect(joinChatMatch).toHaveBeenCalledWith(12);
  });

  it("shows the error and stays on the page when joining fails", async () => {
    joinChatMatch.mockResolvedValueOnce({
      success: false,
      error: "El partido ya está completo, no quedan lugares libres.",
    });
    render(<JoinChatButton chatId={12} />);

    fireEvent.click(screen.getByRole("button", { name: "Sumarme al partido" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("El partido ya está completo, no quedan lugares libres."),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
