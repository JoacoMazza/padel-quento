import { getServerSession } from "next-auth/next";
import { SignOutButton } from "@/app/components/sign-out-button";
import { QuentoLogo } from "@/app/components/quento-logo";
import { authOptions } from "@/src/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex flex-1 flex-col bg-background min-h-screen">
      <header className="flex items-center justify-between border-b border-line bg-card px-6 py-3.5 shadow-sm">
        <QuentoLogo size="sm" variant="horizontal" />
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-foreground/80">
            {session?.user?.name ?? session?.user?.email}
          </span>
          <SignOutButton />
        </div>
      </header>
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

