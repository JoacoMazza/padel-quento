import { Suspense } from "react";
import { AuthShell } from "@/app/components/auth-shell";
import { LoginForm } from "@/app/login/login-form";
import { pageMetadata } from "@/app/site-metadata";

export const metadata = pageMetadata("Iniciar sesión", "/login");

export default function LoginPage() {
  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Solo jugadores registrados pueden acceder a reservas y partidos."
    >
      <Suspense fallback={<p className="text-sm text-foreground/70">Cargando…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
