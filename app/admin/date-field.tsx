"use client";

import { Calendar } from "lucide-react";
import { INPUT_CLASS, LABEL_CLASS } from "@/app/admin/holder-fields";

/** "YYYY-MM-DD" → "DD/MM/YYYY". */
function toDisplay(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Campo de fecha que siempre se lee como día/mes/año. El input nativo muestra
 * el formato del idioma del navegador (en inglés, mes/día/año), así que queda
 * invisible encima del texto y solo se usa para abrir el calendario, como la
 * fecha de la Turnera Global.
 */
export function DateField({
  id,
  label,
  value,
  onChange,
  required = false,
}: {
  id: string;
  label: string;
  /** "YYYY-MM-DD", o "" sin fecha. */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className={`relative flex items-center justify-between ${INPUT_CLASS}`}>
        <span className={value ? "text-foreground" : "text-foreground/40"}>{value ? toDisplay(value) : "dd/mm/aaaa"}</span>
        <Calendar className="h-4 w-4 text-foreground/50" />
        <input
          id={id}
          type="date"
          required={required}
          value={value}
          onClick={(event) => {
            event.currentTarget.showPicker?.();
          }}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
