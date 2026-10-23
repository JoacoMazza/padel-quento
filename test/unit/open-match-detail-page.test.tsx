// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { getBookingById } = vi.hoisted(() => ({ getBookingById: vi.fn() }));

vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/app/components/page-shell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/app/open-matches/[bookingId]/join-match-card", () => ({ JoinMatchCard: () => null }));
vi.mock("@/app/open-matches/add-player-form", () => ({ AddPlayerForm: () => null }));
vi.mock("@/app/components/share-link-button", () => ({ ShareLinkButton: () => null }));
vi.mock("@/src/actions/booking", () => ({ getBookingById }));
vi.mock("@/src/lib/session-player", () => ({ getSessionPlayerId: vi.fn(), playerHasCategory: vi.fn() }));
vi.mock("@/src/lib/player-reviews", () => ({ getReputations: vi.fn(async () => new Map()) }));

import { BookingState, PlayerCategory } from "@/src/domain/enums";
import { formatPrice } from "@/app/bookings/slot-utils";
import OpenMatchDetailPage from "@/app/open-matches/[bookingId]/page";

const BOOKING = {
  id: 10,
  fromDateTime: new Date(2099, 9, 12, 19, 30),
  durationMinutes: 90,
  bookingState: BookingState.RESERVED,
  price: 18000,
  booker: { id: 1, names: "Martín", lastnames: "Prado", phoneNumber: "2215550101" },
  court: { id: 3, number: 2 },
  match: {
    id: 5,
    needPlayers: true,
    matchPlayers: [
      {
        id: 100,
        playerId: 1,
        playersCount: 2,
        attended: true,
        player: { id: 1, names: "Martín", lastnames: "Prado", category: PlayerCategory.FIFTH },
      },
    ],
  },
};

describe("OpenMatchDetailPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("el precio de la cancha no se parte en dos líneas en pantallas chicas", async () => {
    getBookingById.mockResolvedValue({ success: true, data: BOOKING });

    render(await OpenMatchDetailPage({ params: Promise.resolve({ bookingId: "10" }) }));

    expect(screen.getByText(formatPrice(18000)).className.split(" ")).toContain("whitespace-nowrap");
  });
});
