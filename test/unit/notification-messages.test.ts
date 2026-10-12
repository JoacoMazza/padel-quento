import { describe, expect, it } from "vitest";
import {
  courtUnavailableNotice,
  fixedBookingCancelledNotice,
  fixedDateReleasedNotice,
  matchCancelledByCreatorNotice,
  matchClosedNotice,
  matchCompleteNotice,
  matchExpiredNotice,
  playerJoinedNotice,
  playerLeftLateNotice,
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

describe("playerLeftLateNotice", () => {
  it("avisa que alguien se bajó a último momento, sin ofrecer su lugar", () => {
    const notice = playerLeftLateNotice("Ana", "Bruno Díaz", booking);

    expect(notice.subject).toBe("Bruno Díaz se bajó de tu partido del sábado 17 de octubre");
    expect(notice.text).toBe(
      "Hola Ana, Bruno Díaz se bajó a último momento del partido del sábado 17 de octubre a las 19:30 en la cancha 3.",
    );
    expect(notice.whatsappTemplate).toEqual({
      name: "quento_jugador_se_bajo_tarde",
      parameters: ["Ana", "Bruno Díaz", "sábado 17 de octubre", "19:30", "3"],
    });
  });
});

describe("matchCancelledByCreatorNotice", () => {
  it("avisa que quien armó el partido lo canceló y que no hay penalización para el destinatario", () => {
    const notice = matchCancelledByCreatorNotice("Bruno", "Ana Pérez", booking);

    expect(notice.subject).toBe("Se canceló el partido del sábado 17 de octubre");
    expect(notice.text).toBe(
      "Hola Bruno, Ana Pérez canceló el partido del sábado 17 de octubre a las 19:30 en la cancha 3. No se aplicó ninguna penalización para vos.",
    );
    expect(notice.whatsappTemplate).toEqual({
      name: "quento_partido_cancelado",
      parameters: ["Bruno", "Ana Pérez", "sábado 17 de octubre", "19:30", "3"],
    });
  });
});

describe("matchExpiredNotice", () => {
  it("avisa que el partido se canceló por no completar el cupo, sin penalización", () => {
    const notice = matchExpiredNotice("Bruno", booking);

    expect(notice.subject).toBe("Se canceló el partido del sábado 17 de octubre");
    expect(notice.text).toBe(
      "Hola Bruno, el partido del sábado 17 de octubre a las 19:30 en la cancha 3 se canceló porque no se completó el cupo de jugadores. No se aplicó ninguna penalización.",
    );
    expect(notice.whatsappTemplate).toEqual({
      name: "quento_partido_sin_cupo",
      parameters: ["Bruno", "sábado 17 de octubre", "19:30", "3"],
    });
  });
});

describe("matchClosedNotice", () => {
  it("avisa que el partido ya no busca más jugadores", () => {
    const notice = matchClosedNotice("Bruno", booking);

    expect(notice.subject).toBe("El partido del sábado 17 de octubre ya no busca jugadores");
    expect(notice.text).toBe(
      "Hola Bruno, el partido del sábado 17 de octubre a las 19:30 en la cancha 3 ya no busca más jugadores. Se juega con los que están anotados.",
    );
    expect(notice.whatsappTemplate).toEqual({
      name: "quento_partido_cerrado",
      parameters: ["Bruno", "sábado 17 de octubre", "19:30", "3"],
    });
  });
});

describe("matchCompleteNotice", () => {
  it("avisa que el partido se completó con quien se sumó último", () => {
    const notice = matchCompleteNotice("Ana", "Carla Gómez", booking);

    expect(notice.subject).toBe("¡El partido del sábado 17 de octubre está completo!");
    expect(notice.text).toBe(
      "Hola Ana, ¡el partido del sábado 17 de octubre a las 19:30 en la cancha 3 está completo! Carla Gómez se sumó y ya son 4 jugadores.",
    );
    expect(notice.whatsappTemplate).toEqual({
      name: "quento_partido_completo",
      parameters: ["Ana", "sábado 17 de octubre", "19:30", "3", "Carla Gómez"],
    });
  });
});

describe("fixedDateReleasedNotice", () => {
  it("confirma que se liberó una sola fecha del turno fijo y que las demás siguen", () => {
    const notice = fixedDateReleasedNotice("Ana", booking);

    expect(notice.subject).toBe("Liberamos tu turno fijo del sábado 17 de octubre");
    expect(notice.text).toBe(
      "Hola Ana, liberamos tu turno fijo del sábado 17 de octubre a las 19:30 en la cancha 3. Tus próximos turnos fijos siguen reservados.",
    );
    expect(notice.whatsappTemplate).toEqual({
      name: "quento_turno_fijo_liberado",
      parameters: ["Ana", "sábado 17 de octubre", "19:30", "3"],
    });
  });
});

describe("fixedBookingCancelledNotice", () => {
  it("confirma la baja del turno fijo con su día, hora y cancha", () => {
    const notice = fixedBookingCancelledNotice("Ana", { startDate: "2026-10-17", startTime: "19:30:00", courtNumber: 3 });

    expect(notice.subject).toBe("Se dio de baja tu turno fijo de los sábados");
    expect(notice.text).toBe(
      "Hola Ana, se dio de baja tu turno fijo de los sábados a las 19:30 en la cancha 3. Se cancelaron todas sus próximas fechas.",
    );
    expect(notice.whatsappTemplate).toEqual({
      name: "quento_turno_fijo_cancelado",
      parameters: ["Ana", "sábados", "19:30", "3"],
    });
  });

  it("no pluraliza los días que ya terminan en s", () => {
    const notice = fixedBookingCancelledNotice("Ana", { startDate: "2026-10-05", startTime: "18:00:00", courtNumber: 1 });

    expect(notice.whatsappTemplate.parameters[1]).toBe("lunes");
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
