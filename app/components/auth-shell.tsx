import Link from "next/link";
import { CalendarCheck, Trophy, Users } from "lucide-react";
import { QuentoLogo } from "@/app/components/quento-logo";
import { CLUB_ADDRESS } from "@/app/components/club-info";

const HIGHLIGHTS = [
  { icon: CalendarCheck, text: "Reservá tu cancha en segundos" },
  { icon: Users, text: "Sumate a partidos abiertos de la comunidad" },
  { icon: Trophy, text: "Sumá puntos asistiendo a tus turnos" },
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-panel p-12 text-white lg:flex">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <Link href="/" aria-label="Ir al inicio" className="relative w-fit text-base font-extrabold tracking-wide uppercase">
          Quento Club <span className="font-semibold text-white/40">· Villa Elisa</span>
        </Link>
        <div className="relative">
          <h2 className="text-5xl leading-tight font-extrabold tracking-tight">
            Tu próximo partido empieza acá<span className="text-primary">.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/75">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">{CLUB_ADDRESS}</p>
      </aside>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="card w-full max-w-md p-8 shadow-lg">
          <Link href="/" aria-label="Ir al inicio" className="mx-auto mb-6 flex w-fit flex-col items-center justify-center">
            <QuentoLogo size="md" variant="full" />
          </Link>
          <h1 className="text-center text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1.5 mb-6 text-center text-sm leading-relaxed text-foreground/60">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
