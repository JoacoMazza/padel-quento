"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerPlayer, type RegisterState } from "@/src/actions/register";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerPlayer,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      {state.message ? (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <Field
        id="names"
        name="names"
        label="Nombre"
        autoComplete="given-name"
        error={state.errors?.names}
      />
      <Field
        id="lastnames"
        name="lastnames"
        label="Apellido"
        autoComplete="family-name"
        error={state.errors?.lastnames}
      />
      <Field
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={state.errors?.email}
      />
      <Field
        id="password"
        name="password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        error={state.errors?.password}
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-11 rounded-full bg-court text-sm font-semibold text-white transition-colors hover:bg-court-dark disabled:opacity-60"
      >
        {pending ? "Creando cuenta…" : "Registrarme"}
      </button>

      <p className="text-center text-sm text-foreground/70">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-court underline">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  error,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="h-11 rounded-md border border-line bg-white px-3 text-sm outline-none ring-court/30 focus:ring-2"
      />
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
