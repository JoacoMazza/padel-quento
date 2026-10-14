/** Número de cancha con dos dígitos: 1 -> "01". */
export function courtCode(number: number): string {
  return String(number).padStart(2, "0");
}

const SIZE_CLASSES = {
  xs: "h-5 min-w-5 rounded px-1 text-[10px]",
  sm: "h-9 w-9 rounded-lg text-sm",
  md: "h-11 w-11 rounded-xl text-base",
  lg: "h-14 w-14 rounded-2xl text-xl",
} as const;

const TONE_CLASSES = {
  dark: "bg-ink text-white",
  light: "bg-white/10 text-white ring-1 ring-white/10",
  primary: "bg-primary text-white",
} as const;

/** Cuadrado con el número de cancha, como en los bocetos de docs/ui/. */
export function CourtTag({
  number,
  size = "md",
  tone = "dark",
}: {
  number: number;
  size?: keyof typeof SIZE_CLASSES;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-bold tabular-nums ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]}`}
    >
      {courtCode(number)}
    </span>
  );
}
