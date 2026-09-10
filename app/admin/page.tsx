import { getCourts } from "@/src/actions/court";
import { AdminPanel } from "@/app/admin/admin-panel";

export default async function AdminPage() {
  const result = await getCourts();
  const courts = result.success ? result.data : [];

  return (
    <AdminPanel
      courts={courts.map((c) => ({ id: c.id, number: c.number, state: c.state }))}
      courtsError={!result.success ? result.error : null}
    />
  );
}
