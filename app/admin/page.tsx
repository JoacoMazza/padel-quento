import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import Link from "next/link";
import { BarChart3, Lock, Users, MapPin, Settings } from "lucide-react";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10 space-y-8">
      {/* Encabezado del Panel */}
      <div className="flex flex-col gap-2 border-b border-line pb-6">
        <div className="flex items-center gap-2.5">
          <span className="rounded-md bg-slate-500/15 p-1.5 text-slate-700 dark:text-slate-400">
            <Settings className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Panel de Administración
          </h1>
        </div>
        <p className="text-sm text-foreground/70">
          Bienvenido, <span className="font-semibold text-foreground">{session?.user?.name}</span>. Control centralizado de operaciones, canchas y métricas del complejo.
        </p>
      </div>

      {/* Módulos de gestión */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Tarjeta: Estado de Canchas (funcional) */}
        <Link
          href="/admin/courts"
          className="group rounded-2xl border border-line bg-card p-6 shadow-sm transition hover:shadow-md hover:border-primary/50"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-purple-500/10 p-3 text-purple-600 dark:text-purple-400">
              <MapPin className="h-6 w-6" />
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Operativo
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">Estado de Canchas</h3>
          <p className="mt-1.5 text-sm text-foreground/60 leading-relaxed">
            Marcá cada pista como disponible, en mantenimiento, fuera de servicio o dada de baja.
          </p>
          <div className="mt-5 pt-3 border-t border-line/60">
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400 group-hover:underline">
              Gestionar canchas &rarr;
            </span>
          </div>
        </Link>

        {/* Tarjeta: Bloqueo de Canchas */}
        <div className="group rounded-2xl border border-line bg-card p-6 shadow-sm transition hover:shadow-md hover:border-primary/50">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              Próximamente
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">Bloqueo de Canchas</h3>
          <p className="mt-1.5 text-sm text-foreground/60 leading-relaxed">
            Programá mantenimientos preventivos, cierres especiales o reparaciones fuera de servicio.
          </p>
          <div className="mt-5 pt-3 border-t border-line/60">
            <span className="text-xs font-medium text-foreground/40">
              Gestionar bloqueos &rarr;
            </span>
          </div>
        </div>

        {/* Tarjeta: Métricas y Estadísticas */}
        <div className="group rounded-2xl border border-line bg-card p-6 shadow-sm transition hover:shadow-md hover:border-primary/50">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-blue-500/10 p-3 text-blue-600 dark:text-blue-400">
              <BarChart3 className="h-6 w-6" />
            </div>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              Próximamente
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">Métricas del Complejo</h3>
          <p className="mt-1.5 text-sm text-foreground/60 leading-relaxed">
            Consultá la tasa de ocupación, horas pico de reservas y recaudación mensual del predio.
          </p>
          <div className="mt-5 pt-3 border-t border-line/60">
            <span className="text-xs font-medium text-foreground/40">
              Ver estadísticas &rarr;
            </span>
          </div>
        </div>

        {/* Tarjeta: Usuarios y Roles */}
        <div className="group rounded-2xl border border-line bg-card p-6 shadow-sm transition hover:shadow-md hover:border-primary/50">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-slate-500/10 p-3 text-slate-600 dark:text-slate-400">
              <Users className="h-6 w-6" />
            </div>
            <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-400">
              Próximamente
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">Gestión de Usuarios</h3>
          <p className="mt-1.5 text-sm text-foreground/60 leading-relaxed">
            Revisá el listado de jugadores registrados y administradores autorizados del sistema.
          </p>
          <div className="mt-5 pt-3 border-t border-line/60">
            <span className="text-xs font-medium text-foreground/40">
              Ver usuarios &rarr;
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
