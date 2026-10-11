/**
 * Encabezado de página: etiqueta superior con punto rojo, título grande con
 * punto final de marca y bajada. `actions` se alinea a la derecha en desktop.
 */
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  accentDot = true,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  accentDot?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="eyebrow mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          {title}
          {accentDot ? <span className="text-primary">.</span> : null}
        </h1>
        {description ? <p className="mt-3 text-base leading-relaxed text-foreground/60">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
