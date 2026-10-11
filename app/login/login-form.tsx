"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/app/components/ui/password-input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registrado") === "1";
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setPending(false);

    if (!result || result.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }

    router.push(result.url || callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      {registered ? (
        <p className="alert-success">
          Cuenta creada con éxito. Iniciá sesión para entrar.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="alert-error"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="field-label mb-0">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@email.com"
          className="field h-11 bg-card"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="field-label mb-0">
          Contraseña
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="h-11 bg-card"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-2 w-full"
      >
        {pending ? "Ingresando…" : "Iniciar sesión"}
      </button>

      <p className="mt-1 text-center text-sm text-foreground/70">
        ¿Jugador nuevo?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Registrarme
        </Link>
      </p>
    </form>
  );
}

