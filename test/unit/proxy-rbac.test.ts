import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/src/domain/enums";
import { proxy } from "@/proxy";
import type { NextRequest } from "next/server";

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

import { getToken } from "next-auth/jwt";

function createMockRequest(pathname: string): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`);
  return {
    url: url.toString(),
    nextUrl: url,
  } as unknown as NextRequest;
}

describe("proxy RBAC and Route Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rutas públicas (/login, /register)", () => {
    it("permite el acceso sin token", async () => {
      vi.mocked(getToken).mockResolvedValueOnce(null);
      const req = createMockRequest("/login");

      const res = await proxy(req);

      // NextResponse.next()
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it("redirige al home (/) si el usuario ya está autenticado", async () => {
      vi.mocked(getToken).mockResolvedValueOnce({
        sub: "1",
        email: "jugador@test.com",
        role: Role.PLAYER,
      });
      const req = createMockRequest("/login");

      const res = await proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/");
    });
  });

  describe("Rutas protegidas generales (/bookings, /profile)", () => {
    it("redirige al login con callbackUrl si no hay token", async () => {
      vi.mocked(getToken).mockResolvedValueOnce(null);
      const req = createMockRequest("/bookings");

      const res = await proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login?callbackUrl=%2Fbookings");
    });

    it("permite el acceso a usuarios con rol jugador", async () => {
      vi.mocked(getToken).mockResolvedValueOnce({
        sub: "1",
        email: "jugador@test.com",
        role: Role.PLAYER,
      });
      const req = createMockRequest("/bookings");

      const res = await proxy(req);

      expect(res.status).toBe(200);
    });
  });

  describe("Criterio de Aceptación: Rutas administrativas (/admin, /admin/*)", () => {
    it("redirige a /login con callbackUrl si un usuario anónimo intenta acceder a /admin", async () => {
      vi.mocked(getToken).mockResolvedValueOnce(null);
      const req = createMockRequest("/admin");

      const res = await proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login?callbackUrl=%2Fadmin");
    });

    it("DENEGA el acceso con HTTP 403 si un usuario con rol 'player' intenta acceder a /admin", async () => {
      vi.mocked(getToken).mockResolvedValueOnce({
        sub: "2",
        email: "jugador@test.com",
        role: Role.PLAYER,
      });
      const req = createMockRequest("/admin");

      const res = await proxy(req);

      expect(res.status).toBe(403);
      const body = await res.text();
      expect(body).toMatch(/Acceso denegado/i);
    });

    it("DENEGA el acceso con HTTP 403 si un usuario con rol 'player' intenta acceder a subrutas como /admin/metrics o /admin/courts", async () => {
      vi.mocked(getToken).mockResolvedValueOnce({
        sub: "2",
        email: "jugador@test.com",
        role: Role.PLAYER,
      });
      const req = createMockRequest("/admin/metrics");

      const res = await proxy(req);

      expect(res.status).toBe(403);
      const body = await res.text();
      expect(body).toMatch(/Acceso denegado/i);
    });

    it("PERMITE el acceso normal a /admin si el usuario tiene rol 'admin'", async () => {
      vi.mocked(getToken).mockResolvedValueOnce({
        sub: "3",
        email: "admin@test.com",
        role: Role.ADMIN,
      });
      const req = createMockRequest("/admin");

      const res = await proxy(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it("PERMITE el acceso a subrutas de /admin si el usuario tiene rol 'admin'", async () => {
      vi.mocked(getToken).mockResolvedValueOnce({
        sub: "3",
        email: "admin@test.com",
        role: Role.ADMIN,
      });
      const req = createMockRequest("/admin/courts/blocks");

      const res = await proxy(req);

      expect(res.status).toBe(200);
    });
  });
});
