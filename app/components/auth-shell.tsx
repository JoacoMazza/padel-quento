export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-court">
          Padel Quento
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 mb-8 text-sm leading-6 text-foreground/70">
          {subtitle}
        </p>
        {children}
      </div>
    </div>
  );
}
