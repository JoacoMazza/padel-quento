import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { AppHeader } from "@/app/components/app-header";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col bg-background min-h-screen">
      <AppHeader active="/" userName={session.user.name} userEmail={session.user.email} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <div className="rounded-2xl border border-line bg-card p-8 shadow-sm">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Bienvenido{session?.user?.name ? `, ${session.user.name}` : ""}
          </h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-foreground/70">
            Ya estás dentro de <span className="font-semibold text-primary">Quento CLUB</span>. Desde acá vas a poder reservar canchas y gestionar partidos cuando esas funcionalidades estén disponibles.
          </p>
        </div>
      </main>
    </div>
  );
}

