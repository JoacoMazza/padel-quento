const BAR_CLASSES = {
  success: "bg-success",
  primary: "bg-primary",
  ink: "bg-ink",
  occupied: "bg-occupied",
} as const;

/** Tarjeta de indicador: etiqueta, valor grande, texto secundario y barra de progreso opcional. */
export function StatCard({
  label,
  value,
  suffix,
  icon,
  footer,
  progress,
  tone = "success",
}: {
  label: string;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  /** Entre 0 y 1. */
  progress?: number;
  tone?: keyof typeof BAR_CLASSES;
}) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="label-caps">{label}</span>
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-foreground/50">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tracking-tight text-foreground">{value}</span>
        {suffix ? <span className="text-sm text-foreground/60">{suffix}</span> : null}
      </p>
      {progress !== undefined ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-line/70">
          <div
            className={`h-full rounded-full ${BAR_CLASSES[tone]}`}
            style={{ width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%` }}
          />
        </div>
      ) : null}
      {footer ? <div className="text-xs text-foreground/50">{footer}</div> : null}
    </div>
  );
}
