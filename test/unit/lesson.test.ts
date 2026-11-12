import { describe, expect, it } from "vitest";
import { DayOfWeek } from "@/src/domain/enums";
import {
  lessonInputProblem,
  lessonOccurrenceDates,
  scheduleDurationMinutes,
  type LessonInputToValidate,
} from "@/src/domain/lesson";

// El lunes 5 de octubre de 2026.
const TODAY = "2026-10-05";

function input(overrides: Partial<LessonInputToValidate> = {}): LessonInputToValidate {
  return {
    classCapacity: 4,
    price: 15000,
    fromDate: "2026-10-05",
    toDate: "2026-10-31",
    schedules: [{ dayOfWeek: DayOfWeek.TUESDAY, startTime: "10:00", endTime: "11:30" }],
    ...overrides,
  };
}

describe("lessonOccurrenceDates", () => {
  it("trae cada fecha del día de la semana dentro del rango, ambas puntas incluidas", () => {
    expect(lessonOccurrenceDates(DayOfWeek.MONDAY, "2026-10-05", "2026-10-26")).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
  });

  it("arranca en el primer día que coincide después del inicio", () => {
    expect(lessonOccurrenceDates(DayOfWeek.THURSDAY, "2026-10-05", "2026-10-20")).toEqual(["2026-10-08", "2026-10-15"]);
  });

  it("no trae nada si el día no cae en el rango", () => {
    expect(lessonOccurrenceDates(DayOfWeek.SUNDAY, "2026-10-05", "2026-10-09")).toEqual([]);
  });
});

describe("scheduleDurationMinutes", () => {
  it("calcula los minutos entre el inicio y el fin", () => {
    expect(scheduleDurationMinutes({ startTime: "10:00", endTime: "11:30" })).toBe(90);
    expect(scheduleDurationMinutes({ startTime: "18:30:00", endTime: "19:30:00" })).toBe(60);
  });
});

describe("lessonInputProblem", () => {
  it("acepta una clase válida", () => {
    expect(lessonInputProblem(input(), TODAY)).toBeNull();
  });

  it("el cupo va de 1 a 8 alumnos", () => {
    const message = "El cupo de la clase tiene que ser de 1 a 8 alumnos.";
    expect(lessonInputProblem(input({ classCapacity: 0 }), TODAY)).toBe(message);
    expect(lessonInputProblem(input({ classCapacity: 9 }), TODAY)).toBe(message);
    expect(lessonInputProblem(input({ classCapacity: 2.5 }), TODAY)).toBe(message);
  });

  it("el precio tiene que ser mayor a 0", () => {
    const message = "El precio de la clase tiene que ser mayor a 0.";
    expect(lessonInputProblem(input({ price: 0 }), TODAY)).toBe(message);
    expect(lessonInputProblem(input({ price: Number.NaN }), TODAY)).toBe(message);
  });

  it("no empieza antes de hoy ni termina antes de empezar", () => {
    expect(lessonInputProblem(input({ fromDate: "2026-10-04" }), TODAY)).toBe(
      "La fecha de inicio no puede ser anterior a hoy.",
    );
    expect(lessonInputProblem(input({ toDate: "2026-10-04" }), TODAY)).toBe(
      "La fecha de fin no puede ser anterior a la de inicio.",
    );
  });

  it("no se extiende más de 6 meses desde hoy", () => {
    expect(lessonInputProblem(input({ toDate: "2027-06-01" }), TODAY)).toBe(
      "La clase no puede extenderse más de 6 meses desde hoy.",
    );
  });

  it("necesita al menos un horario", () => {
    expect(lessonInputProblem(input({ schedules: [] }), TODAY)).toBe("Agregá al menos un horario a la clase.");
  });

  it("cada horario termina después de empezar", () => {
    expect(
      lessonInputProblem(
        input({ schedules: [{ dayOfWeek: DayOfWeek.TUESDAY, startTime: "11:00", endTime: "11:00" }] }),
        TODAY,
      ),
    ).toBe("La hora de fin de cada horario tiene que ser posterior a la de inicio.");
  });

  it("no repite el mismo día y hora de inicio", () => {
    const slot = { dayOfWeek: DayOfWeek.TUESDAY, startTime: "10:00", endTime: "11:30" };
    expect(lessonInputProblem(input({ schedules: [slot, { ...slot, endTime: "11:00" }] }), TODAY)).toBe(
      "Hay dos horarios el mismo día a la misma hora.",
    );
  });

  it("algún horario tiene que caer dentro de las fechas", () => {
    expect(
      lessonInputProblem(
        input({
          fromDate: "2026-10-05",
          toDate: "2026-10-06",
          schedules: [{ dayOfWeek: DayOfWeek.FRIDAY, startTime: "10:00", endTime: "11:00" }],
        }),
        TODAY,
      ),
    ).toBe("Ningún horario cae dentro de las fechas de la clase.");
  });
});
