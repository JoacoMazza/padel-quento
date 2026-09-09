import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { AppHeader } from "@/app/components/app-header";
import { redirect } from "next/navigation";
import { Role } from "@/src/domain/enums";
import Link from "next/link";
import { ShieldAlert, BarChart3, Lock, Users, Calendar, Settings } from "lucide-react";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  // Si no es admin, se deniega el acceso con vista de 403
  if (session.user.role !== Role.ADMIN) {
    return (
      <div className="flex flex-1 flex-col bg-background min-h-screen">
        <AppHeader
          active="/"
          userName={session.user.name}
          userEmail={session.user.email}
          userRole={session.user.role}
        />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-8 shadow-sm space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/20 text-danger">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">403 - Acceso Denegado</h1>
            <p className="text-sm text-foreground/70">
              No tenés permisos de Administrador para acceder al panel operativo del complejo.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                Volver al Inicio
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background min-h-screen">
      <AppHeader
        active="/admin"
        userName={session.user.name}
        userEmail={session.user.email}
        userRole={session.user.role}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10 space-y-8">
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
            Bienvenido, <span className="font-semibold text-foreground">{session.user.name}</span>. Control centralizado de operaciones, canchas y métricas del complejo.
          </p>
        </div>

        {/* Módulos de gestión */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Tarjeta: Bloqueo de Canchas */}
          <Link
            href="/admin/out-of-service"
            className="group rounded-2xl border border-line bg-card p-6 shadow-sm transition hover:shadow-md hover:border-primary/50"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Lock className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Operativo
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Bloqueo de Canchas</h3>
            <p className="mt-1.5 text-sm text-foreground/60 leading-relaxed">
              Programá mantenimientos preventivos, cierres especiales o reparaciones fuera de servicio.
            </p>
            <div className="mt-5 pt-3 border-t border-line/60">
              <span className="text-xs font-medium text-primary group-hover:underline">
                Gestionar bloqueos &rarr;
              </span>
            </div>
          </Link>

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
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                Ver estadísticas &rarr;
              </span>
            </div>
          </div>

          {/* Tarjeta: Canchas y Horarios */}
          <div className="group rounded-2xl border border-line bg-card p-6 shadow-sm transition hover:shadow-md hover:border-primary/50">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-purple-500/10 p-3 text-purple-600 dark:text-purple-400">
                <Calendar className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                Configuración
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Canchas y Horarios</h3>
            <p className="mt-1.5 text-sm text-foreground/60 leading-relaxed">
              Administrá los horarios de apertura/cierre de turnos por día y estado de cada pista.
            </p>
            <div className="mt-5 pt-3 border-t border-line/60">
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400 group-hover:underline">
                Ajustar horarios &rarr;
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
                Seguridad
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Gestión de Usuarios</h3>
            <p className="mt-1.5 text-sm text-foreground/60 leading-relaxed">
              Revisá el listado de jugadores registrados y administradores autorizados del sistema.
            </p>
            <div className="mt-5 pt-3 border-t border-line/60">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-400 group-hover:underline">
                Ver usuarios &rarr;
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
