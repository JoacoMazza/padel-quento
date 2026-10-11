import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarPlus, User, Users } from "lucide-react";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";

// La home usa el título por defecto del sitio; solo define su URL canónica.
export const metadata: Metadata = { alternates: { canonical: "/" } };

const SHORTCUTS = [
  {
    href: "/bookings",
    icon: CalendarPlus,
    title: "Reservar turno",
    description: "Mirá la disponibilidad de las canchas y reservá en segundos.",
  },
  {
    href: "/open-matches",
    icon: Users,
    title: "Partidos abiertos",
    description: "Sumate a un partido que ya está armado y completá la cancha.",
  },
  {
    href: "/my-bookings",
    icon: CalendarCheck,
    title: "Mis reservas",
    description: "Revisá tus próximos turnos, el chat del partido y cancelaciones.",
  },
  {
    href: "/profile",
    icon: User,
    title: "Mi perfil",
    description: "Actualizá tus datos y consultá tu saldo de puntos.",
  },
];

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  return (
    <PageShell active="/" user={session.user}>
      <PageHeading
        eyebrow="Quento Club"
        title={`Bienvenido${session.user.name ? `, ${session.user.name}` : ""}`}
        description="Reservá tu cancha, sumate a partidos abiertos y seguí tus puntos, todo desde un mismo lugar."
        actions={
          <Link href="/bookings" className="btn btn-primary">
            <CalendarPlus className="h-4 w-4" />
            Nuevo turno
          </Link>
        }
      />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SHORTCUTS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="card group flex items-start gap-4 p-6 transition-all hover:border-foreground/20 hover:shadow-md"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary transition-colors group-hover:bg-primary group-hover:text-white">
              <Icon className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block text-lg font-bold text-foreground">{title}</span>
              <span className="mt-1 block text-sm text-foreground/60">{description}</span>
            </span>
            <ArrowRight className="mt-1 h-5 w-5 text-foreground/30 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
