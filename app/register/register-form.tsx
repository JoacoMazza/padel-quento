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
          className="rounded-lg border border-danger/30 bg-danger-light px-3.5 py-2.5 text-sm font-medium text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <Field
        id="names"
        name="names"
        label="Nombre"
        autoComplete="given-name"
        placeholder="Juan"
        error={state.errors?.names}
      />
      <Field
        id="lastnames"
        name="lastnames"
        label="Apellido"
        autoComplete="family-name"
        placeholder="Pérez"
        error={state.errors?.lastnames}
      />
      <Field
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="juan@email.com"
        error={state.errors?.email}
      />
      <Field
        id="password"
        name="password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        minLength={6}
        maxLength={25}
        error={state.errors?.password}
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-11 rounded-full bg-primary text-sm font-semibold text-white transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60 shadow-sm cursor-pointer"
      >
        {pending ? "Creando cuenta…" : "Registrarme"}
      </button>

      <p className="mt-1 text-center text-sm text-foreground/70">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
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
  placeholder,
  minLength,
  maxLength,
  error,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        maxLength={maxLength}
        required
        className="h-11 rounded-lg border border-line bg-white px-3.5 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

