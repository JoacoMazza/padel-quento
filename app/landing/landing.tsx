import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { QuentoLogo } from "@/app/components/quento-logo";
import {
  CLUB_ADDRESS,
  CLUB_MAPS_EMBED_URL,
  CLUB_MAPS_URL,
  CLUB_NAME,
  CLUB_WHATSAPP_URL,
} from "@/app/components/club-info";
import type { ClubHoursRow } from "@/app/landing/club-hours";
import { ATTENDANCE_POINTS, OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";

const FEATURES = [
  {
    icon: CalendarPlus,
    title: "Reservá online",
    description: "Mirá qué canchas están libres y reservá tu turno en segundos, sin llamar.",
  },
  {
    icon: Users,
    title: "Partidos abiertos",
    description: `¿Te faltan jugadores? Abrí tu partido o sumate a uno armado hasta completar los ${OPEN_MATCH_MAX_PLAYERS}.`,
  },
  {
    icon: MessageCircle,
    title: "Chat del partido",
    description: "Coordiná con los demás jugadores del partido desde un chat propio.",
  },
  {
    icon: Trophy,
    title: "Sumá puntos",
    description: `Cada turno al que asistís suma ${ATTENDANCE_POINTS} puntos de fidelidad.`,
  },
];

const SHORTCUTS = [
  { href: "/bookings", icon: CalendarPlus, title: "Reservar turno" },
  { href: "/open-matches", icon: Users, title: "Partidos abiertos" },
  { href: "/my-bookings", icon: CalendarCheck, title: "Mis reservas" },
  { href: "/profile", icon: User, title: "Mi perfil" },
];

/**
 * Página de inicio (issue #55): información del complejo y de lo que se puede
 * hacer en la plataforma. El visitante ve accesos para entrar o registrarse;
 * el jugador con sesión, sus accesos directos.
 */
export function Landing({
  userName,
  isGuest,
  courtCount,
  hours,
}: {
  userName: string | null;
  isGuest: boolean;
  courtCount: number;
  hours: ClubHoursRow[];
}) {
  return (
    <div className="space-y-16">
      <section aria-label="Bienvenida" className="card flex flex-col items-start gap-8 p-8 sm:p-12 md:flex-row md:items-center">
        <QuentoLogo size="lg" />
        <div className="flex-1">
          <p className="label-caps">{isGuest ? "Pádel en Villa Elisa" : `Bienvenido, ${userName ?? "jugador"}`}</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">{CLUB_NAME}</h1>
          <p className="mt-3 max-w-xl text-foreground/60">
            Reservá tu cancha, armá partidos con otros jugadores y seguí tus puntos, todo desde un mismo lugar.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/bookings" className="btn btn-primary btn-lg">
              <CalendarPlus className="h-4 w-4" />
              Ver turnos disponibles
            </Link>
            {isGuest ? (
              <>
                <Link href="/login" className="btn btn-outline btn-lg">
                  Iniciar sesión
                </Link>
                <Link href="/register" className="btn btn-soft btn-lg">
                  Registrarse
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {!isGuest ? (
        <section aria-label="Tus accesos" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map(({ href, icon: Icon, title }) => (
            <Link
              key={href}
              href={href}
              className="card group flex items-center gap-4 p-5 transition-all hover:border-foreground/20 hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1 font-bold text-foreground">{title}</span>
              <ArrowRight className="h-4 w-4 text-foreground/30 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          ))}
        </section>
      ) : null}

      <section aria-label="Qué podés hacer">
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Qué podés hacer</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-foreground/60">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="El complejo" className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="card space-y-6 p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">El complejo</h2>

          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold text-foreground">{CLUB_ADDRESS}</p>
              <a
                href={CLUB_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                Cómo llegar
              </a>
            </div>
          </div>

          <div className="flex gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="font-semibold text-foreground">{courtCount === 1 ? "1 cancha" : `${courtCount} canchas`}</p>
          </div>

          <div className="flex gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            {hours.length > 0 ? (
              <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
                {hours.map((row) => (
                  <div key={row.days} className="contents">
                    <dt className="text-foreground/70">{row.days}</dt>
                    <dd className="font-semibold text-foreground">{row.hours}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-foreground/70">Consultá los horarios por WhatsApp.</p>
            )}
          </div>

          <div className="flex gap-3">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <a
              href={CLUB_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Escribinos por WhatsApp
            </a>
          </div>
        </div>

        <iframe
          title="Mapa del complejo"
          src={CLUB_MAPS_EMBED_URL}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-72 w-full rounded-2xl border border-line lg:h-full lg:min-h-80"
        />
      </section>
    </div>
  );
}
