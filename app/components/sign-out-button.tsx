"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="h-10 rounded-full border border-line px-4 text-sm font-medium hover:bg-line/60"
    >
      Cerrar sesión
    </button>
  );
}
