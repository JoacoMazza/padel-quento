import { AdminPanel } from "@/app/admin/admin-panel";

// Sin precarga en el servidor: cada sección del panel pide sus datos recién
// cuando el admin la abre (ver AdminPanel).
export default function AdminPage() {
  return <AdminPanel />;
}
