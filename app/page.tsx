import { getServerSession } from "next-auth/next";
import { SignOutButton } from "@/app/components/sign-out-button";
import { authOptions } from "@/src/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court">
          Padel Quento
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-foreground/70">
            {session?.user?.name ?? session?.user?.email}
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          Bienvenido{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="mt-3 max-w-lg text-base leading-7 text-foreground/70">
          Ya estás dentro. Desde acá vas a poder reservar canchas y gestionar
          partidos cuando esas funcionalidades estén disponibles.
        </p>
      </main>
    </div>
  );
}
