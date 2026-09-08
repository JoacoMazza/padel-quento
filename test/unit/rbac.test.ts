import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/src/domain/enums";
import {
  requireAdmin,
  requireRole,
  UnauthorizedError,
  ForbiddenError,
} from "@/src/lib/rbac";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";

describe("RBAC server helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireAdmin", () => {
    it("lanza UnauthorizedError si no hay sesión activa", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      await expect(requireAdmin()).rejects.toThrow(UnauthorizedError);
    });

    it("lanza ForbiddenError (403) si el usuario tiene rol 'player'", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { email: "jugador@test.com", name: "Jugador", role: Role.PLAYER },
      });

      await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
    });

    it("retorna el usuario si tiene rol 'admin'", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { email: "admin@test.com", name: "Admin", role: Role.ADMIN },
      });

      const user = await requireAdmin();

      expect(user).toEqual({
        email: "admin@test.com",
        name: "Admin",
        role: Role.ADMIN,
      });
    });
  });

  describe("requireRole", () => {
    it("permite el acceso cuando el rol coincide", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { email: "jugador@test.com", name: "Jugador", role: Role.PLAYER },
      });

      const user = await requireRole([Role.PLAYER, Role.ADMIN]);

      expect(user.role).toBe(Role.PLAYER);
    });

    it("lanza ForbiddenError cuando el rol no está en la lista permitida", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { email: "jugador@test.com", name: "Jugador", role: Role.PLAYER },
      });

      await expect(requireRole(Role.ADMIN)).rejects.toThrow(ForbiddenError);
    });
  });
});
