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

  describe("Procesos en segundo plano (/api/cron/*)", () => {
    it("deja pasar al programador sin sesión: el endpoint se protege con CRON_SECRET", async () => {
      vi.mocked(getToken).mockResolvedValueOnce(null);
      const req = createMockRequest("/api/cron/attendance-points");

      const res = await proxy(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("Manifest del sitio (/manifest.webmanifest)", () => {
    it("permite el acceso sin token, para que el navegador pueda leerlo", async () => {
      vi.mocked(getToken).mockResolvedValueOnce(null);
      const req = createMockRequest("/manifest.webmanifest");

      const res = await proxy(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it("permite el acceso a usuarios autenticados sin redirigirlos", async () => {
      vi.mocked(getToken).mockResolvedValueOnce({
        sub: "3",
        email: "admin@test.com",
        role: Role.ADMIN,
      });
      const req = createMockRequest("/manifest.webmanifest");

      const res = await proxy(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("Rutas personales (/my-bookings, /profile, /chats/*)", () => {
    it.each(["/my-bookings", "/profile", "/chats/3"])(
      "redirige %s al login con callbackUrl si no hay token",
      async (pathname) => {
        vi.mocked(getToken).mockResolvedValueOnce(null);

        const res = await proxy(createMockRequest(pathname));

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe(
          `http://localhost:3000/login?callbackUrl=${encodeURIComponent(pathname)}`,
        );
      },
    );

    it("permite el acceso a usuarios con rol jugador", async () => {
      vi.mocked(getToken).mockResolvedValueOnce({
        sub: "1",
        email: "jugador@test.com",
        role: Role.PLAYER,
      });
      const req = createMockRequest("/profile");

      const res = await proxy(req);

      expect(res.status).toBe(200);
    });
  });

  describe("Rutas visibles sin sesión (/, /bookings, /open-matches)", () => {
    it.each(["/", "/bookings", "/open-matches", "/open-matches/12"])(
      "un visitante puede ver %s sin que lo manden al login",
      async (pathname) => {
        vi.mocked(getToken).mockResolvedValueOnce(null);

        const res = await proxy(createMockRequest(pathname));

        expect(res.status).toBe(200);
        expect(res.headers.get("location")).toBeNull();
      },
    );

    it("un jugador con sesión también las ve", async () => {
      vi.mocked(getToken).mockResolvedValueOnce({ sub: "1", email: "jugador@test.com", role: Role.PLAYER });

      const res = await proxy(createMockRequest("/"));

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });

    it.each(["/", "/bookings"])("un admin con sesión que entra a %s vuelve al panel", async (pathname) => {
      vi.mocked(getToken).mockResolvedValueOnce({ sub: "3", email: "admin@test.com", role: Role.ADMIN });

      const res = await proxy(createMockRequest(pathname));

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/admin");
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
