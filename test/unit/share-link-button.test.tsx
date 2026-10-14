// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ShareLinkButton } from "@/app/components/share-link-button";

describe("ShareLinkButton", () => {
  const writeText = vi.fn(async () => undefined);
  const link = () => `${window.location.origin}/open-matches/34`;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("copies the absolute link of the given path to the clipboard", async () => {
    render(<ShareLinkButton path="/open-matches/34" />);

    fireEvent.click(screen.getByRole("button", { name: /Compartir link/ }));

    await waitFor(() => expect(screen.getByText("¡Link copiado!")).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(link());
  });

  it("shows the link to copy it by hand when the clipboard cannot be written", async () => {
    writeText.mockRejectedValueOnce(new Error("NotAllowedError"));
    render(<ShareLinkButton path="/open-matches/34" />);

    fireEvent.click(screen.getByRole("button", { name: /Compartir link/ }));

    await waitFor(() => expect(screen.getByDisplayValue(link())).toBeTruthy());
    expect(screen.queryByText("¡Link copiado!")).toBeNull();
  });

  it("shows the link to copy it by hand when the browser has no clipboard API", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    render(<ShareLinkButton path="/open-matches/34" />);

    fireEvent.click(screen.getByRole("button", { name: /Compartir link/ }));

    await waitFor(() => expect(screen.getByDisplayValue(link())).toBeTruthy());
  });
});
