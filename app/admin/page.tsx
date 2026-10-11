import { AdminPanel } from "@/app/admin/admin-panel";
import { pageMetadata } from "@/app/site-metadata";

export const metadata = pageMetadata("Panel de administración", "/admin");

// Sin precarga en el servidor: cada sección del panel pide sus datos recién
// cuando el admin la abre (ver AdminPanel).
export default function AdminPage() {
  return <AdminPanel />;
}
