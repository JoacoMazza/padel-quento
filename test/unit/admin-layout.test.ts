import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/app/components/app-header", () => ({ AppHeader: () => null }));

import { getServerSession } from "next-auth/next";
import AdminLayout from "@/app/admin/layout";

describe("AdminLayout", () => {
  it("ocupa el alto visible de la pantalla (dvh), sin quedar tapado por la barra del navegador en el celular", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "a@test.com", role: "admin" } } as never);

    const layout = await AdminLayout({ children: null });

    const classes = layout.props.className.split(" ");
    expect(classes).toContain("h-dvh");
    expect(classes).not.toContain("h-screen");
  });
});
