import { QuentoLogo } from "@/app/components/quento-logo";

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
    <div className="flex flex-1 items-center justify-center px-4 py-12 bg-background min-h-screen">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-md transition-all">
        <div className="mb-6 flex flex-col items-center justify-center">
          <QuentoLogo size="md" variant="full" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-center text-foreground">{title}</h1>
        <p className="mt-1.5 mb-6 text-sm text-center leading-relaxed text-foreground/70">
          {subtitle}
        </p>
        {children}
      </div>
    </div>
  );
}

