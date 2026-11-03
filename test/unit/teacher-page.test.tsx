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
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import TeacherPage from "@/app/teacher/page";
import { ForbiddenError } from "@/src/lib/rbac";
import { Role } from "@/src/domain/enums";

describe("TeacherPage (HU-42)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({
      user: { email: "p@test.com", name: "Lucía Profe", role: Role.PLAYER, isTeacher: true },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("a un profesor activo le muestra su sección de clases", async () => {
    requireTeacher.mockResolvedValue({ teacherId: 1, playerId: 3 });

    render(await TeacherPage());

    expect(screen.getByRole("heading", { name: /Mis clases/ })).toBeTruthy();
    expect(screen.queryByText(/Acceso denegado/)).toBeNull();
  });

  it("si el administrador lo desactivó, no le muestra la sección aunque su sesión diga que es profesor", async () => {
    requireTeacher.mockRejectedValue(new ForbiddenError("Acceso denegado: Se requiere el rol de Profesor"));

    render(await TeacherPage());

    expect(screen.getByText("Acceso denegado: Se requiere el rol de Profesor")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Mis clases/ })).toBeNull();
  });
});
