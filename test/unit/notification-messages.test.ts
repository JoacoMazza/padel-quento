import { describe, expect, it } from "vitest";
import {
  courtUnavailableNotice,
  playerJoinedNotice,
  playerLeftNotice,
  toWhatsAppNumber,
} from "@/src/domain/notifications";

// Sábado 17 de octubre de 2026 a las 19:30 (hora de pared del club).
const booking = { fromDateTime: new Date(2026, 9, 17, 19, 30), courtNumber: 3 };

describe("courtUnavailableNotice", () => {
  it("avisa que el turno se canceló porque la cancha no va a estar disponible, sin penalización", () => {
    const notice = courtUnavailableNotice("Ana", booking);

    expect(notice.subject).toBe("Tu turno del sábado 17 de octubre fue cancelado");
    expect(notice.text).toBe(
      "Hola Ana, tu turno del sábado 17 de octubre a las 19:30 en la cancha 3 fue cancelado porque la cancha no va a estar disponible. No se aplicó ninguna penalización.",
    );
    expect(notice.whatsappTemplate).toEqual({
      name: "quento_turno_cancelado",
      parameters: ["Ana", "sábado 17 de octubre", "19:30", "3"],
    });
  });
});

describe("playerJoinedNotice", () => {
  it("avisa quién se sumó y cuántos lugares quedan libres", () => {
    const notice = playerJoinedNotice("Ana", "Bruno Díaz", booking, 1);

    expect(notice.subject).toBe("Bruno Díaz se sumó a tu partido del sábado 17 de octubre");
    expect(notice.text).toBe(
      "Hola Ana, Bruno Díaz se sumó al partido del sábado 17 de octubre a las 19:30 en la cancha 3. Lugares libres: 1.",
    );
    expect(notice.whatsappTemplate).toEqual({
      name: "quento_jugador_se_sumo",
      parameters: ["Ana", "Bruno Díaz", "sábado 17 de octubre", "19:30", "3", "1"],
    });
  });
});

describe("playerLeftNotice", () => {
  it("avisa quién se bajó y cuántos lugares quedan libres", () => {
    const notice = playerLeftNotice("Ana", "Bruno Díaz", booking, 2);

    expect(notice.subject).toBe("Bruno Díaz se bajó de tu partido del sábado 17 de octubre");
    expect(notice.text).toBe(
      "Hola Ana, Bruno Díaz se bajó del partido del sábado 17 de octubre a las 19:30 en la cancha 3. Lugares libres: 2.",
    );
    expect(notice.whatsappTemplate).toEqual({
      name: "quento_jugador_se_bajo",
      parameters: ["Ana", "Bruno Díaz", "sábado 17 de octubre", "19:30", "3", "2"],
    });
  });
});

describe("toWhatsAppNumber", () => {
  it("agrega el prefijo de celulares argentinos a los números cargados sin código de país", () => {
    expect(toWhatsAppNumber("221 555-0101")).toBe("5492215550101");
  });

  it("respeta el código de país de los números cargados en formato internacional", () => {
    expect(toWhatsAppNumber("+34 600 111 222")).toBe("34600111222");
  });
});
