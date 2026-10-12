interface MovementItem {
  id: number;
  amount: number;
  type: "bonus" | "penalty";
  description: string;
  createdAt: string;
}

interface PointsHistoryProps {
  movements: MovementItem[];
}

export function PointsHistory({ movements }: PointsHistoryProps) {
  return (
    <section className="card p-6">
      <h2 className="mb-4 text-lg font-bold text-foreground">Historial de puntos</h2>

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
              <div key={item.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${isPositive ? "badge-success" : "badge-danger"}`}>
                      {isPositive ? "Bonificación" : "Penalización"}
                    </span>
                    <p className="text-sm font-medium text-foreground">{item.description}</p>
                  </div>
                  <p className="text-xs text-foreground/50">{dateStr}</p>
                </div>
                <div className={`shrink-0 text-base font-bold ${isPositive ? "text-success" : "text-danger"}`}>
                  {isPositive ? `+${item.amount}` : item.amount} pts
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
