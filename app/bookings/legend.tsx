export function Legend() {
  return (
    <div className="mt-6 flex items-center gap-6 text-sm text-foreground/70">
      <LegendItem className="border border-line bg-card" label="Disponible" />
      <LegendItem className="bg-line" label="Ocupado" />
      <LegendItem className="bg-primary" label="Seleccionado" />
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-3.5 w-3.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
