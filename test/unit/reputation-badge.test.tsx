// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReputationBadge } from "@/app/components/reputation-badge";
import { summarizeReputation } from "@/src/domain/reputation";
import { ReviewLevel } from "@/src/domain/enums";

const good = { level: ReviewLevel.AS_DECLARED, goodAttitude: true, onTime: true };

describe("ReputationBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra la puntualidad, la actitud y el nivel en porcentajes", () => {
    const summary = summarizeReputation([good, good, { ...good, onTime: false }, { ...good, level: ReviewLevel.LOWER }]);

    render(<ReputationBadge summary={summary} />);

    expect(screen.getByText("Puntual 75%")).toBeTruthy();
    expect(screen.getByText("Buena actitud 100%")).toBeTruthy();
    expect(screen.getByText("Nivel acorde 75%")).toBeTruthy();
    expect(screen.getByText("4 reseñas")).toBeTruthy();
  });

  it("con pocas reseñas no muestra porcentajes", () => {
    render(<ReputationBadge summary={summarizeReputation([good])} />);

    expect(screen.getByText("Pocas reseñas todavía")).toBeTruthy();
    expect(screen.queryByText(/Puntual/)).toBeNull();
  });

  it("marca en rojo lo que quedó por debajo del 70%", () => {
    const summary = summarizeReputation([good, { ...good, onTime: false }, { ...good, onTime: false }]);

    render(<ReputationBadge summary={summary} />);

    expect(screen.getByText("Puntual 33%").className).toContain("text-danger");
    expect(screen.getByText("Buena actitud 100%").className).not.toContain("text-danger");
  });
});
