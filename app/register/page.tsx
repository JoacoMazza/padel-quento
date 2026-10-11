import { RegisterForm } from "@/app/register/register-form";
import { AuthShell } from "@/app/components/auth-shell";
import { pageMetadata } from "@/app/site-metadata";

export const metadata = pageMetadata("Creá tu cuenta", "/register");

export default function RegisterPage() {
  return (
    <AuthShell
      title="Creá tu cuenta"
      subtitle="Registráte como jugador para reservar canchas y gestionar partidos."
    >
      <RegisterForm />
    </AuthShell>
  );
}
