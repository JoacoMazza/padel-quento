// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { getReviewableTeammates, submitPlayerReview } = vi.hoisted(() => ({
  getReviewableTeammates: vi.fn(),
  submitPlayerReview: vi.fn(),
}));

vi.mock("@/src/actions/review", () => ({ getReviewableTeammates, submitPlayerReview }));

import { ReviewTeammatesModal } from "@/app/my-bookings/review-teammates-modal";
import { PlayerCategory, ReviewLevel } from "@/src/domain/enums";

const teammates = [
  { playerId: 2, name: "Bruno Díaz", category: PlayerCategory.FIFTH, alreadyReviewed: false },
  { playerId: 3, name: "Carla Gómez", category: PlayerCategory.FOURTH, alreadyReviewed: true },
];

async function renderModal() {
  render(<ReviewTeammatesModal matchId={7} onClose={vi.fn()} />);
  return screen.findByRole("region", { name: "Calificar a Bruno Díaz" });
}

describe("ReviewTeammatesModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getReviewableTeammates.mockResolvedValue({ success: true, data: teammates });
  });

  afterEach(() => {
    cleanup();
  });

  it("lista a los compañeros: a los pendientes con las preguntas y a los ya calificados marcados", async () => {
    const bruno = await renderModal();

    expect(getReviewableTeammates).toHaveBeenCalledWith(7);
    expect(within(bruno).getByText("¿Su nivel coincide con su categoría (5ª Categoría)?")).toBeTruthy();
    expect(within(bruno).getByText("¿Tuvo buena actitud?")).toBeTruthy();
    expect(within(bruno).getByText("¿Llegó a horario?")).toBeTruthy();
    const carla = screen.getByRole("region", { name: "Calificar a Carla Gómez" });
    expect(within(carla).getByText("Ya lo calificaste")).toBeTruthy();
  });

  it("no deja enviar hasta responder las tres preguntas", async () => {
    const bruno = await renderModal();
    const send = within(bruno).getByRole("button", { name: "Enviar calificación" }) as HTMLButtonElement;

    expect(send.disabled).toBe(true);
    fireEvent.click(within(bruno).getByRole("button", { name: "Más bajo" }));
    fireEvent.click(within(within(bruno).getByRole("group", { name: "¿Tuvo buena actitud?" })).getByRole("button", { name: "Sí" }));
    expect(send.disabled).toBe(true);
    fireEvent.click(within(within(bruno).getByRole("group", { name: "¿Llegó a horario?" })).getByRole("button", { name: "No" }));

    expect(send.disabled).toBe(false);
  });

  it("envía las respuestas y el comentario, y lo marca como calificado", async () => {
    submitPlayerReview.mockResolvedValue({ success: true, data: null });
    const bruno = await renderModal();

    fireEvent.click(within(bruno).getByRole("button", { name: "Más bajo" }));
    fireEvent.click(within(within(bruno).getByRole("group", { name: "¿Tuvo buena actitud?" })).getByRole("button", { name: "Sí" }));
    fireEvent.click(within(within(bruno).getByRole("group", { name: "¿Llegó a horario?" })).getByRole("button", { name: "No" }));
    fireEvent.change(within(bruno).getByLabelText("Comentario (opcional, solo lo ve el club)"), {
      target: { value: "Llegó tarde" },
    });
    fireEvent.click(within(bruno).getByRole("button", { name: "Enviar calificación" }));

    await waitFor(() => expect(within(bruno).getByText("¡Gracias! Ya lo calificaste")).toBeTruthy());
    expect(submitPlayerReview).toHaveBeenCalledWith({
      matchId: 7,
      reviewedPlayerId: 2,
      level: ReviewLevel.LOWER,
      goodAttitude: true,
      onTime: false,
      comment: "Llegó tarde",
    });
  });

  it("muestra el error si no se pudo guardar", async () => {
    submitPlayerReview.mockResolvedValue({ success: false, error: "Ya pasaron las 48 horas para calificar este partido." });
    const bruno = await renderModal();

    fireEvent.click(within(bruno).getByRole("button", { name: "Acorde" }));
    fireEvent.click(within(within(bruno).getByRole("group", { name: "¿Tuvo buena actitud?" })).getByRole("button", { name: "Sí" }));
    fireEvent.click(within(within(bruno).getByRole("group", { name: "¿Llegó a horario?" })).getByRole("button", { name: "Sí" }));
    fireEvent.click(within(bruno).getByRole("button", { name: "Enviar calificación" }));

    expect(await within(bruno).findByText("Ya pasaron las 48 horas para calificar este partido.")).toBeTruthy();
  });

  it("muestra el error si no se pudieron cargar los compañeros", async () => {
    getReviewableTeammates.mockResolvedValue({ success: false, error: "Ya pasaron las 48 horas para calificar este partido." });

    render(<ReviewTeammatesModal matchId={7} onClose={vi.fn()} />);

    expect(await screen.findByText("Ya pasaron las 48 horas para calificar este partido.")).toBeTruthy();
  });
});
