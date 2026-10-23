import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Clock, LayoutGrid, Plus, Users } from "lucide-react";
import { PageShell } from "@/app/components/page-shell";
import { Avatar } from "@/app/components/ui/avatar";
import { CLUB_LOCATION } from "@/app/components/club-info";
import { JoinMatchCard } from "@/app/open-matches/[bookingId]/join-match-card";
import { anonymizeOpenMatch, inviteOptions, toOpenMatchDetail } from "@/app/open-matches/open-matches";
import { AddPlayerForm } from "@/app/open-matches/add-player-form";
import { ShareLinkButton } from "@/app/components/share-link-button";
import { formatLongDate, formatPrice } from "@/app/bookings/slot-utils";
import { dateToTimeLabel } from "@/src/domain/time-format";
import { authOptions } from "@/src/lib/auth";
import { getSessionPlayerId, playerHasCategory } from "@/src/lib/session-player";
import { getBookingById } from "@/src/actions/booking";
import { LATE_CANCELLATION_HOURS, OPEN_MATCH_MAX_PLAYERS, PENALTY_POINTS } from "@/src/domain/constants";
import { PLAYER_CATEGORY_LABELS } from "@/src/domain/player-category-labels";
import { getReputations } from "@/src/lib/player-reviews";
import { ReputationBadge } from "@/app/components/reputation-badge";

export const metadata: Metadata = { title: "Partido abierto" };

export default async function OpenMatchDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  // Se puede ver sin sesión (issue #55), pero sin los nombres de los jugadores ni el chat.
  const session = await getServerSession(authOptions);
  const isGuest = !session?.user?.email;

  const { bookingId } = await params;
  const id = Number(bookingId);
  const result = Number.isInteger(id) ? await getBookingById(id) : null;
  const booking = result?.success ? result.data : null;

  const playerId = isGuest ? null : await getSessionPlayerId();
  const fullDetail = booking ? toOpenMatchDetail(booking, playerId, new Date()) : null;
  if (!fullDetail) {
    notFound();
  }
  const detail = isGuest ? anonymizeOpenMatch(fullDetail) : fullDetail;
  // Reputación de cada jugador según sus compañeros de partidos anteriores (HU-36). A un
  // visitante sin sesión no se le muestra: el partido se le muestra anónimo.
  const reputations = await getReputations(
    isGuest ? [] : detail.participants.map((participant) => participant.playerId),
  );

  const timeRange = `${dateToTimeLabel(detail.start)} – ${dateToTimeLabel(detail.end)}`;
  const durationMinutes = Math.round((detail.end.getTime() - detail.start.getTime()) / 60_000);
  const emptySpots = detail.status === "open" ? detail.remainingSpots : 0;
  const invite = inviteOptions(detail);

  return (
    <PageShell active="/open-matches" user={isGuest ? null : session.user}>
      <Link
        href="/open-matches"
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-foreground/70 transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a partidos abiertos
      </Link>

      <div className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3">
            {detail.status === "open" ? (
              <span className="badge badge-success tracking-wide uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {detail.remainingSpots === 1 ? "1 lugar restante" : `${detail.remainingSpots} lugares restantes`}
              </span>
            ) : (
              <span className="badge badge-neutral tracking-wide uppercase">
                {detail.status === "full" ? "Completo" : detail.status === "cancelled" ? "Cancelado" : "Finalizado"}
              </span>
            )}
            <span className="text-xs font-semibold tracking-wider text-foreground/40">ID #{detail.bookingId}</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Cancha {detail.courtNumber} · Partido abierto
          </h1>
          <p className="mt-2 text-lg text-foreground/60">Turno compartido · Comunidad Quento</p>
        </div>
        <div className="card flex items-baseline gap-3 px-6 py-4">
          <span className="label-caps">Valor cancha</span>
          <span className="text-3xl font-extrabold tracking-tight whitespace-nowrap text-foreground">
            {formatPrice(detail.price)}
          </span>
          <span className="text-sm text-foreground/50">/ turno</span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <div className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            <InfoTile icon={<Clock className="h-5 w-5" />} label="Horario" value={timeRange}>
              {formatLongDate(detail.start)} · {durationMinutes} min
            </InfoTile>
            <InfoTile icon={<LayoutGrid className="h-5 w-5" />} label="Cancha" value={`Cancha ${detail.courtNumber}`}>
              {CLUB_LOCATION}
            </InfoTile>
            <InfoTile icon={<Users className="h-5 w-5" />} label="Cupos" value={`${OPEN_MATCH_MAX_PLAYERS} jugadores`}>
              <span className={detail.status === "open" ? "font-medium text-success" : undefined}>
                {detail.confirmedPlayers} de {OPEN_MATCH_MAX_PLAYERS} confirmados
              </span>
            </InfoTile>
          </div>

          <section className="card p-6">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-line pb-5">
              <div>
                <p className="eyebrow">Organización del turno</p>
                <h2 className="mt-1 text-xl font-extrabold text-foreground">Participantes confirmados</h2>
              </div>
              <span className="badge badge-success">
                {detail.confirmedPlayers} de {OPEN_MATCH_MAX_PLAYERS} confirmados
              </span>
            </div>

            <ul className="flex flex-col gap-3">
              {detail.participants.map((participant) => (
                <li
                  key={participant.playerId}
                  className="flex items-center gap-4 rounded-xl border border-line bg-background/60 p-4"
                >
                  <Avatar initials={participant.initials} tone={participant.isOrganizer ? "dark" : "light"} />
                  <div className="flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                      {participant.name}
                      {participant.isOrganizer ? (
                        <span className="badge badge-primary text-[10px] tracking-wider uppercase">Organizador</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-foreground/50">
                      {PLAYER_CATEGORY_LABELS[participant.category] ?? participant.category}
                      {participant.playersCount > 1
                        ? ` · +${participant.playersCount - 1} acompañante${participant.playersCount === 2 ? "" : "s"}`
                        : ""}
                    </p>
                    {reputations.get(participant.playerId) ? (
                      <div className="mt-1">
                        <ReputationBadge summary={reputations.get(participant.playerId)!} />
                      </div>
                    ) : null}
                  </div>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
                    <Check className="h-4 w-4" />
                    Confirmado ({participant.playersCount} plaza{participant.playersCount === 1 ? "" : "s"})
                  </span>
                </li>
              ))}

              {Array.from({ length: emptySpots }, (_, i) => (
                <li
                  key={`empty-${i}`}
                  className="flex items-center gap-4 rounded-xl border-2 border-dashed border-success/40 bg-success-light/50 p-4"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-success/60 text-success">
                    <Plus className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Cupo disponible</p>
                    <p className="text-sm text-success">Tu lugar en la cancha</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-6">
            <h2 className="label-caps mb-4">Información del turno</h2>
            <ul className="grid grid-cols-1 gap-4 text-sm text-foreground/70 sm:grid-cols-2">
              <RuleItem title="Costo total">
                El valor de la cancha es de {formatPrice(detail.price)} y se abona en el club entre los participantes.
              </RuleItem>
              <RuleItem title="Puntualidad">Presentate 10 minutos antes en la recepción de Quento Club.</RuleItem>
              <RuleItem title="Aviso de baja">
                Si no podés asistir, date de baja desde Mis reservas. Con menos de {LATE_CANCELLATION_HOURS} horas de
                anticipación se descuentan {PENALTY_POINTS} puntos.
              </RuleItem>
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <JoinMatchCard
            bookingId={detail.bookingId}
            isGuest={isGuest}
            courtNumber={detail.courtNumber}
            timeRange={timeRange}
            dateLabel={formatLongDate(detail.start)}
            price={detail.price}
            remainingSpots={detail.remainingSpots}
            status={detail.status}
            alreadyJoined={detail.alreadyJoined}
            chatId={detail.chatId}
            hasCategory={await playerHasCategory(playerId)}
          />

          {invite.canShare || invite.canAddPlayer ? (
            <section className="card flex flex-col gap-4 p-6">
              <div>
                <h2 className="label-caps">Invitar jugadores</h2>
                <p className="mt-1 text-sm text-foreground/60">
                  Compartí el link del partido o agregá a un jugador registrado por su email o teléfono.
                </p>
              </div>
              {invite.canShare ? <ShareLinkButton path={`/open-matches/${detail.bookingId}`} /> : null}
              {invite.canAddPlayer ? <AddPlayerForm bookingId={detail.bookingId} /> : null}
            </section>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

function InfoTile({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="label-caps">{label}</p>
        <p className="font-bold text-foreground">{value}</p>
        <p className="text-xs text-foreground/50">{children}</p>
      </div>
    </div>
  );
}

function RuleItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p>
        <span className="font-semibold text-foreground">{title}:</span> {children}
      </p>
    </li>
  );
}
