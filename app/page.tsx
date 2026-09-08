import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { AppHeader } from "@/app/components/app-header";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User, Shield, ArrowRight } from "lucide-react";

export default async function Home() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "admin";

  return (
    <div className="flex flex-1 flex-col bg-background min-h-screen">
      <AppHeader
        active="/"
        userName={session.user.name}
        userEmail={session.user.email}
        userRole={session.user.role}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <div className="rounded-2xl border border-line bg-card p-8 shadow-sm space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Bienvenido{session?.user?.name ? `, ${session.user.name}` : ""}
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-foreground/70">
            Ya estás dentro de <span className="font-semibold text-primary">Quento CLUB</span>. Podés acceder a tu perfil para editar tus datos personales y revisar tu saldo acumulado de puntos.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/profile"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <User size={18} />
              Ir a Mi Perfil
              <ArrowRight size={18} />
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300 transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Shield size={18} />
                Ir al Panel Admin
                <ArrowRight size={18} />
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

