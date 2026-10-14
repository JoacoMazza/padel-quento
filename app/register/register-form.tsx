"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerPlayer, type RegisterState } from "@/src/actions/register";
import { PasswordInput } from "@/app/components/ui/password-input";

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
          className="alert-error"
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
        id="phoneNumber"
        name="phoneNumber"
        label="Teléfono"
        type="tel"
        autoComplete="tel"
        placeholder="221 555-0101"
        error={state.errors?.phoneNumber}
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
        className="btn btn-primary mt-2 w-full"
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
      <label htmlFor={id} className="field-label mb-0">
        {label}
      </label>
      {type === "password" ? (
        <PasswordInput
          id={id}
          name={name}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          maxLength={maxLength}
          required
          className="h-11 bg-card"
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          maxLength={maxLength}
          required
          className="field h-11 bg-card"
        />
      )}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

