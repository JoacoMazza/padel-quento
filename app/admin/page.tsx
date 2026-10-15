import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { AdminPanel } from "@/app/admin/admin-panel";
import { pageMetadata } from "@/app/site-metadata";

export const metadata = pageMetadata("Panel de administración", "/admin");

// Sin precarga en el servidor: cada sección del panel pide sus datos recién
// cuando el admin la abre (ver AdminPanel).
export default async function AdminPage() {
  // El layout ya exige ser admin; acá solo importa si es el dueño.
  const session = await getServerSession(authOptions);
  return <AdminPanel isOwner={session?.user?.isOwner ?? false} />;
}
