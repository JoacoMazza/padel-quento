import { describe, expect, it, vi } from "vitest";

const { getCourts, getSchedules, getBookings, getOutOfServices, getPlayersAdmin } = vi.hoisted(() => ({
  getCourts: vi.fn(async () => ({ success: true, data: [] })),
  getSchedules: vi.fn(async () => ({ success: true, data: [] })),
  getBookings: vi.fn(async () => ({ success: true, data: [] })),
  getOutOfServices: vi.fn(async () => ({ success: true, data: [] })),
  getPlayersAdmin: vi.fn(async () => ({ success: true, data: [] })),
}));

vi.mock("@/src/actions/court", () => ({ getCourts }));
vi.mock("@/src/actions/schedule", () => ({ getSchedules }));
vi.mock("@/src/actions/booking", () => ({ getBookings }));
vi.mock("@/src/actions/outOfService", () => ({ getOutOfServices }));
vi.mock("@/src/actions/player", () => ({ getPlayersAdmin }));
vi.mock("@/app/admin/admin-panel", () => ({ AdminPanel: () => null }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));

import { getServerSession } from "next-auth/next";
import AdminPage from "@/app/admin/page";

function signInAs(isOwner: boolean) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { email: "a@test.com", role: "admin", isOwner } } as never);
}

describe("AdminPage", () => {
  it("no precarga en el servidor los datos de todas las secciones del panel", async () => {
    signInAs(true);
    await AdminPage();

    expect(getCourts).not.toHaveBeenCalled();
    expect(getSchedules).not.toHaveBeenCalled();
    expect(getBookings).not.toHaveBeenCalled();
    expect(getOutOfServices).not.toHaveBeenCalled();
    expect(getPlayersAdmin).not.toHaveBeenCalled();
  });

  it("le dice al panel si el admin es el dueño, según la sesión", async () => {
    signInAs(true);
    expect((await AdminPage()).props.isOwner).toBe(true);

    signInAs(false);
    expect((await AdminPage()).props.isOwner).toBe(false);
  });
});
