/** Iniciales a partir del nombre completo (o del email si no hay nombre). */
export function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return `${first}${second}`.toUpperCase();
  }
  if (email) return email[0]?.toUpperCase() ?? "?";
  return "?";
}

const SIZE_CLASSES = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-20 w-20 text-2xl",
} as const;

const TONE_CLASSES = {
  dark: "bg-ink text-white",
  light: "bg-line/70 text-foreground/70",
  primary: "bg-primary text-white",
} as const;

export function Avatar({
  initials,
  size = "md",
  tone = "light",
}: {
  initials: string;
  size?: keyof typeof SIZE_CLASSES;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]}`}
    >
      {initials}
    </span>
  );
}
