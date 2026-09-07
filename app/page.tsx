import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { SignOutButton } from "@/app/components/sign-out-button";
import { QuentoLogo } from "@/app/components/quento-logo";
import { authOptions } from "@/src/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex flex-1 flex-col bg-background min-h-screen">
      <header className="flex items-center justify-between border-b border-line bg-card px-6 py-3.5 shadow-sm">
        <div className="flex items-center gap-6">
          <QuentoLogo size="sm" variant="horizontal" />
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/"
              className="text-primary font-semibold border-b-2 border-primary py-1"
            >
              Inicio
            </Link>
            <Link
              href="/profile"
              className="text-foreground/70 hover:text-foreground transition-colors"
            >
              Mi Perfil
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-foreground/80">
            {session?.user?.name ?? session?.user?.email}
          </span>
          <SignOutButton />
        </div>
      </header>
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

