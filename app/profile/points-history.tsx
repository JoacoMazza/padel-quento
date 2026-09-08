interface MovementItem {
  id: number;
  amount: number;
  type: "bonus" | "penalty";
  description: string;
  createdAt: string;
}

interface PointsHistoryProps {
  scoring: number;
  movements: MovementItem[];
}

export function PointsHistory({ scoring, movements }: PointsHistoryProps) {
  return (
    <div className="space-y-6">
      {/* Tarjeta Destacada de Saldo Neto */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Saldo Neto de Puntos
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-foreground">
                {scoring > 0 ? `+${scoring}` : scoring}
              </span>
              <span className="text-sm font-medium text-foreground/70">pts</span>
            </div>
            <p className="mt-2 text-xs text-foreground/60">
              Puntos calculados por el sistema <span className="italic">(Modo solo lectura)</span>
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary shadow-inner">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385c.116.486-.425.878-.852.623l-4.771-2.859a.563.563 0 00-.586 0l-4.771 2.859c-.427.255-.968-.137-.852-.623l1.285-5.385a.563.563 0 00-.182-.557l-4.204-3.602c-.38-.325-.178-.948.32-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Historial de Movimientos */}
      <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h3 className="text-lg font-bold text-foreground mb-4">
          Historial de Movimientos
        </h3>

        {movements.length === 0 ? (
          <div className="py-8 text-center text-sm text-foreground/60">
            No registrás movimientos de puntos de bonificaciones o penalizaciones aún.
          </div>
        ) : (
          <div className="divide-y divide-line/60 overflow-hidden">
            {movements.map((item) => {
              const isPositive = item.amount >= 0;
              const dateStr = new Date(item.createdAt).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={item.id} className="flex items-center justify-between py-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isPositive
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-500 border border-red-500/20"
                        }`}
                      >
                        {isPositive ? "Bonificación" : "Penalización"}
                      </span>
                      <p className="text-sm font-medium text-foreground">
                        {item.description}
                      </p>
                    </div>
                    <p className="text-xs text-foreground/50">{dateStr}</p>
                  </div>
                  <div
                    className={`text-base font-bold ${
                      isPositive ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    {isPositive ? `+${item.amount}` : item.amount} pts
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

