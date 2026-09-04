"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

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
        <p className="rounded-lg border border-primary/30 bg-primary-light px-3.5 py-2.5 text-sm font-medium text-primary">
          Cuenta creada con éxito. Iniciá sesión para entrar.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-light px-3.5 py-2.5 text-sm font-medium text-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@email.com"
          className="h-11 rounded-lg border border-line bg-white px-3.5 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-foreground">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="h-11 rounded-lg border border-line bg-white px-3.5 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-11 rounded-full bg-primary text-sm font-semibold text-white transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60 shadow-sm cursor-pointer"
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

