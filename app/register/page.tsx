import { RegisterForm } from "@/app/register/register-form";
import { AuthShell } from "@/app/components/auth-shell";

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
