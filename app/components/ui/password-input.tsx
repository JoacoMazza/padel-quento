"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Campo de contraseña con un botón para mostrarla u ocultarla. */
export function PasswordInput({
  className = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={isVisible ? "text" : "password"} className={`field pr-11 ${className}`} />
      <button
        type="button"
        onClick={() => setIsVisible((visible) => !visible)}
        aria-label={isVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-foreground/45 transition-colors hover:text-foreground"
      >
        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
