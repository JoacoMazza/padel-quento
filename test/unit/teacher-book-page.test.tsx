// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { getServerSession, requireTeacher } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requireTeacher: vi.fn(),
}));

vi.mock("next-auth/next", () => ({ getServerSession }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/rbac")>();
  return { ...actual, requireTeacher };
});
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/src/actions/court", () => ({ getCourts: vi.fn(async () => ({ success: true, data: [] })) }));
vi.mock("@/src/actions/schedule", () => ({ getSchedules: vi.fn(async () => ({ success: true, data: [] })) }));
vi.mock("@/src/actions/outOfService", () => ({ getOutOfServices: vi.fn(async () => ({ success: true, data: [] })) }));
vi.mock("@/src/lib/public-bookings", () => ({ getPublicBookings: vi.fn(async () => []) }));
vi.mock("@/src/actions/teacherClass", () => ({ createClassBooking: vi.fn() }));

import TeacherBookPage from "@/app/teacher/book/page";
import { ForbiddenError } from "@/src/lib/rbac";
import { Role } from "@/src/domain/enums";

describe("TeacherBookPage (HU-43)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { email: "p@test.com", role: Role.PLAYER, isTeacher: true } });
  });

  afterEach(() => {
    cleanup();
  });

  it("a un profesor activo le muestra la disponibilidad para reservar su clase", async () => {
    requireTeacher.mockResolvedValue({ teacherId: 1, playerId: 3 });

    render(await TeacherBookPage());

    expect(screen.getByRole("heading", { name: /Reservar clase/ })).toBeTruthy();
    expect(screen.getByText("Elegí el día")).toBeTruthy();
  });

  it("si lo desactivaron, no le deja reservar", async () => {
    requireTeacher.mockRejectedValue(new ForbiddenError("Acceso denegado: Se requiere el rol de Profesor"));

    render(await TeacherBookPage());

    expect(screen.getByText("Acceso denegado: Se requiere el rol de Profesor")).toBeTruthy();
    expect(screen.queryByText("Elegí el día")).toBeNull();
  });
});
