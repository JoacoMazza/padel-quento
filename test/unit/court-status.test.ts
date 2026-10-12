import { describe, expect, it } from "vitest";
import { CourtState, OutOfServiceReason } from "@/src/domain/enums";
import { summarizeCourts, type CourtItem } from "@/app/admin/court-status";

function court(overrides: Partial<CourtItem> = {}): CourtItem {
  return { id: 1, number: 1, state: CourtState.AVAILABLE, price: 18000, activeOutOfService: null, ...overrides };
}

describe("summarizeCourts", () => {
  it("cuenta las canchas habilitadas y los bloqueos activos", () => {
    const summary = summarizeCourts([
      court({ id: 1 }),
      court({ id: 2 }),
      court({
        id: 3,
        activeOutOfService: { id: 9, reason: OutOfServiceReason.MAINTENANCE, toDateTime: new Date(2099, 0, 1) },
      }),
      court({ id: 4, state: CourtState.CLOSED_DOWN }),
    ]);

    expect(summary).toEqual({ total: 4, enabled: 2, activeBlocks: 1 });
  });

  it("devuelve ceros si no hay canchas", () => {
    expect(summarizeCourts([])).toEqual({ total: 0, enabled: 0, activeBlocks: 0 });
  });
});
