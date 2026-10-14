// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { PlayerCategory } from "@/src/domain/enums";
import { OpenMatchesList } from "@/app/open-matches/open-matches-list";

const match = {
  bookingId: 10,
  start: new Date(2030, 9, 12, 19, 30),
  end: new Date(2030, 9, 12, 21, 0),
  courtNumber: 2,
  price: 18000,
  confirmedPlayers: 2,
  remainingSpots: 2,
  organizerName: "Martín Prado",
  category: PlayerCategory.SECOND,
  alreadyJoined: false,
};

describe("OpenMatchesList", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra la categoría de cada partido", () => {
    render(<OpenMatchesList matches={[match]} />);

    const card = screen.getByRole("article");
    expect(within(card).getByText("2ª Categoría")).toBeTruthy();
  });

  it("indica cuando el partido no tiene categoría", () => {
    render(<OpenMatchesList matches={[{ ...match, category: PlayerCategory.WITHOUT_CATEGORY }]} />);

    expect(within(screen.getByRole("article")).getByText("Sin categoría")).toBeTruthy();
  });
});
