"use client";

import { useEffect, useState } from "react";
import { CircleCheck, X } from "lucide-react";
import { getReviewableTeammates, submitPlayerReview, type ReviewableTeammate } from "@/src/actions/review";
import { ReviewLevel } from "@/src/domain/enums";
import { PLAYER_CATEGORY_LABELS } from "@/src/domain/player-category-labels";

const LEVEL_OPTIONS = [
  { value: ReviewLevel.LOWER, label: "Más bajo" },
  { value: ReviewLevel.AS_DECLARED, label: "Acorde" },
  { value: ReviewLevel.HIGHER, label: "Más alto" },
];

/**
 * Calificación de los compañeros de un partido abierto que ya terminó (HU-36):
 * tres preguntas cortas y un comentario opcional por compañero.
 */
export function ReviewTeammatesModal({ matchId, onClose }: { matchId: number; onClose: () => void }) {
  const [teammates, setTeammates] = useState<ReviewableTeammate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getReviewableTeammates(matchId).then((result) => {
      if (result.success) setTeammates(result.data);
      else setLoadError(result.error);
    });
  }, [matchId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Calificar compañeros</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-foreground/50 hover:bg-line/40 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-5 text-sm text-foreground/60">
          Tu calificación es anónima: tus compañeros solo ven porcentajes, nunca quién dijo qué.
        </p>

        {loadError ? <p className="text-sm font-medium text-danger">{loadError}</p> : null}
        {!teammates && !loadError ? <p className="text-sm text-foreground/60">Cargando…</p> : null}

        <div className="space-y-4">
          {teammates?.map((teammate) => (
            <TeammateReview key={teammate.playerId} matchId={matchId} teammate={teammate} />
          ))}
        </div>
      </div>
    </div>
  );
}

function YesNo({ question, value, onChange }: { question: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div role="group" aria-label={question} className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground/80">{question}</span>
      <span className="flex gap-2">
        {[
          { label: "Sí", answer: true },
          { label: "No", answer: false },
        ].map(({ label, answer }) => (
          <button
            key={label}
            type="button"
            aria-pressed={value === answer}
            onClick={() => onChange(answer)}
            className={`chip ${value === answer ? "chip-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </span>
    </div>
  );
}

function TeammateReview({ matchId, teammate }: { matchId: number; teammate: ReviewableTeammate }) {
  const [level, setLevel] = useState<ReviewLevel | null>(null);
  const [goodAttitude, setGoodAttitude] = useState<boolean | null>(null);
  const [onTime, setOnTime] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(teammate.alreadyReviewed);
  const [justSent, setJustSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = level !== null && goodAttitude !== null && onTime !== null;
  const categoryLabel = PLAYER_CATEGORY_LABELS[teammate.category] ?? teammate.category;

  async function handleSend() {
    if (!complete) return;
    setError(null);
    setIsSending(true);
    const result = await submitPlayerReview({
      matchId,
      reviewedPlayerId: teammate.playerId,
      level,
      goodAttitude,
      onTime,
      comment: comment.trim() || null,
    });
    setIsSending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setDone(true);
    setJustSent(true);
  }

  return (
    <section aria-label={`Calificar a ${teammate.name}`} className="rounded-xl border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-foreground">{teammate.name}</span>
        <span className="text-xs text-foreground/50">{categoryLabel}</span>
      </div>

      {done ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-success">
          <CircleCheck className="h-4 w-4" />
          {justSent ? "¡Gracias! Ya lo calificaste" : "Ya lo calificaste"}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-sm text-foreground/80">¿Su nivel coincide con su categoría ({categoryLabel})?</p>
            <div className="mt-2 flex gap-2">
              {LEVEL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={level === option.value}
                  onClick={() => setLevel(option.value)}
                  className={`chip ${level === option.value ? "chip-active" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <YesNo question="¿Tuvo buena actitud?" value={goodAttitude} onChange={setGoodAttitude} />
          <YesNo question="¿Llegó a horario?" value={onTime} onChange={setOnTime} />
          <div>
            <label htmlFor={`review-comment-${teammate.playerId}`} className="text-xs text-foreground/60">
              Comentario (opcional, solo lo ve el club)
            </label>
            <textarea
              id={`review-comment-${teammate.playerId}`}
              rows={2}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
          <button
            type="button"
            disabled={!complete || isSending}
            onClick={handleSend}
            className="btn btn-primary btn-sm w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Enviando…" : "Enviar calificación"}
          </button>
        </div>
      )}
    </section>
  );
}
