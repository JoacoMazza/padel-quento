import { describe, expect, it } from "vitest";
import { mailtoUrl, whatsappUrl } from "@/app/admin/player-contact";

describe("player contact links", () => {
  it("agrega el prefijo de Argentina (549) a un teléfono local", () => {
    expect(whatsappUrl("2215550101")).toBe("https://wa.me/5492215550101");
  });

  it("respeta un teléfono que ya viene con código de país", () => {
    expect(whatsappUrl("+34600111222")).toBe("https://wa.me/34600111222");
  });

  it("arma el enlace de email", () => {
    expect(mailtoUrl("ana@test.com")).toBe("mailto:ana@test.com");
  });
});
