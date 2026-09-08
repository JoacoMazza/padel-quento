import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { authOptions } from "@/src/lib/auth";
import { Role } from "@/src/domain/enums";
import { AdminSidebar } from "@/app/admin/admin-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  // Si no es admin, se deniega el acceso con vista de 403 (sin la barra lateral)
  if (session.user.role !== Role.ADMIN) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-6 py-16 text-center">
        <div className="w-full max-w-lg space-y-4 rounded-2xl border border-danger/30 bg-danger/10 p-8 shadow-sm">
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
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-primary/90 transition-colors"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar userName={session.user.name} userEmail={session.user.email} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
