import { MapPin } from "lucide-react";
import { getCourts } from "@/src/actions/court";
import { CourtsManager } from "@/app/admin/courts/courts-manager";

export default async function AdminCourtsPage() {
  const result = await getCourts();
  const courts = result.success ? result.data : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10 space-y-8">
      <div className="flex flex-col gap-2 border-b border-line pb-6">
        <div className="flex items-center gap-2.5">
          <span className="rounded-md bg-purple-500/15 p-1.5 text-purple-600 dark:text-purple-400">
            <MapPin className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Estado de Canchas
          </h1>
        </div>
        <p className="text-sm text-foreground/70">
          Modificá el estado operativo de cada pista del complejo.
        </p>
      </div>

      {!result.success ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">
          {result.error}
        </div>
      ) : null}

      <CourtsManager courts={courts.map((c) => ({ id: c.id, number: c.number, state: c.state }))} />
    </div>
  );
}
