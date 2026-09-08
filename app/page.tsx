import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { AppHeader } from "@/app/components/app-header";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col bg-background min-h-screen">
      <AppHeader active="/" userName={session.user.name} userEmail={session.user.email} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <div className="rounded-2xl border border-line bg-card p-8 shadow-sm space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Bienvenido{session?.user?.name ? `, ${session.user.name}` : ""}
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-foreground/70">
            Ya estás dentro de <span className="font-semibold text-primary">Quento CLUB</span>. Podés acceder a tu perfil para editar tus datos personales y revisar tu saldo acumulado de puntos.
          </p>
          <div className="pt-2">
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Ir a Mi Perfil
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

