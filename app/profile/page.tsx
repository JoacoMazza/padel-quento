import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarPlus, Check, Mail, Phone, ShieldAlert, ShieldCheck, Trophy } from "lucide-react";
import { authOptions } from "@/src/lib/auth";
import { getProfileData } from "@/src/actions/profile";
import { PageShell } from "@/app/components/page-shell";
import { Avatar } from "@/app/components/ui/avatar";
import { EditProfileModal } from "@/app/profile/edit-profile-modal";
import { PointsHistory } from "@/app/profile/points-history";
import { PLAYER_CATEGORY_LABELS } from "@/src/domain/player-category-labels";
import type { PlayerCategory } from "@/src/domain/enums";
import {
  ATTENDANCE_POINTS,
  LATE_CANCELLATION_HOURS,
  OPEN_MATCH_JOIN_BONUS_POINTS,
  PENALTY_POINTS,
} from "@/src/domain/constants";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const profile = await getProfileData(session.user.email);

  if (!profile) {
    return (
      <PageShell active="/profile" user={session.user}>
        <div className="card p-8 text-center text-foreground/70">
          No se encontró información de perfil de jugador asociada a tu cuenta ({session.user.email}).
        </div>
      </PageShell>
    );
  }

  const fullName = `${profile.names} ${profile.lastnames}`;
  const penalties = profile.movements.filter((m) => m.type === "penalty").length;
  const categoryLabel = PLAYER_CATEGORY_LABELS[profile.category as PlayerCategory] ?? profile.category;

  return (
    <PageShell active="/profile" user={session.user}>
      <section className="card flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center">
        <div className="relative w-fit">
          <Avatar initials={`${profile.names[0] ?? ""}${profile.lastnames[0] ?? ""}`.toUpperCase()} size="lg" tone="dark" />
          <span
            className={`absolute right-0 bottom-0 h-5 w-5 rounded-full border-4 border-card ${
              profile.isBlocked ? "bg-danger" : "bg-success"
            }`}
          />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{fullName}</h1>
            {profile.isBlocked ? <span className="badge badge-danger tracking-wide uppercase">Cuenta bloqueada</span> : null}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground/60">
            <span className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              {profile.phoneNumber}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              {profile.email}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <EditProfileModal
            initialData={{
              names: profile.names,
              lastnames: profile.lastnames,
              category: profile.category,
              photoUrl: profile.photoUrl,
            }}
          />
          <Link href="/bookings" className="btn btn-primary">
            <CalendarPlus className="h-4 w-4" />
            Nuevo turno
          </Link>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatusCard label="Nivel de juego" icon={<Trophy className="h-4 w-4" />} title={categoryLabel}>
          Podés actualizar tu categoría desde Editar perfil.
        </StatusCard>
        <StatusCard
          label="Reputación y compromiso"
          icon={<ShieldCheck className="h-4 w-4" />}
          title={`${profile.scoring} pts`}
        >
          Puntos de fidelidad acumulados por asistir a tus turnos.
        </StatusCard>
        <StatusCard
          label="Estado de cuenta"
          icon={profile.isBlocked ? <ShieldAlert className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          title={profile.isBlocked ? "Cuenta bloqueada" : penalties === 0 ? "Sin penalizaciones" : `${penalties} penalización${penalties === 1 ? "" : "es"}`}
          tone={profile.isBlocked ? "danger" : "success"}
        >
          {profile.isBlocked
            ? "No podés reservar ni sumarte a partidos. Contactá a la recepción del club."
            : "Cuenta al día para reservar y sumarse a partidos."}
        </StatusCard>
      </div>

      {/* Mismas columnas y separación que las tarjetas de arriba: el historial ocupa dos y las reglas, la última. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <PointsHistory movements={profile.movements} />
        </div>

        <aside className="card p-6">
          <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-foreground uppercase">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Reglas de convivencia
          </h2>
          <p className="mt-2 text-sm text-foreground/60">
            Para garantizar la mejor experiencia y el respeto entre todos los jugadores del club:
          </p>
          <ol className="mt-5 space-y-5">
            <RuleItem index={1} title={`Cancelaciones con más de ${LATE_CANCELLATION_HOURS} h`}>
              Sin costo ni penalización.
            </RuleItem>
            <RuleItem index={2} title="Cancelación tardía o inasistencia" highlight>
              Cancelar con menos de {LATE_CANCELLATION_HOURS} h o no presentarte descuenta {PENALTY_POINTS} puntos.
            </RuleItem>
            <RuleItem index={3} title="Asistencia y partidos abiertos">
              Cada turno al que asistís suma {ATTENDANCE_POINTS} puntos, y {OPEN_MATCH_JOIN_BONUS_POINTS} extra si te
              sumaste al partido de otro jugador.
            </RuleItem>
          </ol>
        </aside>
      </div>
    </PageShell>
  );
}

function StatusCard({
  label,
  icon,
  title,
  tone = "neutral",
  children,
}: {
  label: string;
  icon: React.ReactNode;
  title: string;
  tone?: "neutral" | "success" | "danger";
  children: React.ReactNode;
}) {
  const iconClasses = {
    neutral: "border border-line text-foreground/60",
    success: "bg-success-light text-success",
    danger: "bg-danger-light text-danger",
  }[tone];

  return (
    <div className="card flex flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <span className="label-caps">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClasses}`}>{icon}</span>
      </div>
      <p className="text-2xl font-extrabold tracking-tight text-foreground">{title}</p>
      <p className="text-sm text-foreground/60">{children}</p>
    </div>
  );
}

function RuleItem({
  index,
  title,
  highlight = false,
  children,
}: {
  index: number;
  title: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          highlight ? "bg-primary-light text-primary" : "bg-background text-foreground/70"
        }`}
      >
        {index}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-foreground/60">{children}</p>
      </div>
    </li>
  );
}
