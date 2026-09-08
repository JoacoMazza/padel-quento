import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/src/lib/auth";
import { getProfileData } from "@/src/actions/profile";
import { AppHeader } from "@/app/components/app-header";
import { ProfileForm } from "@/app/profile/profile-form";
import { PointsHistory } from "@/app/profile/points-history";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const profile = await getProfileData(session.user.email);

  return (
    <div className="flex flex-1 flex-col bg-background min-h-screen">
      <AppHeader active="/profile" userName={session.user.name} userEmail={session.user.email} />

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Mi Perfil de Jugador
          </h1>
          <p className="mt-2 text-sm text-foreground/70">
            Mantené tus datos actualizados y conocé tu saldo de puntos acumulados.
          </p>
        </div>

        {!profile ? (
          <div className="rounded-2xl border border-line bg-card p-8 text-center text-foreground/70">
            No se encontró información de perfil de jugador asociada a tu cuenta ({session.user.email}).
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Formulario de Edición de Perfil */}
            <div className="lg:col-span-7 rounded-2xl border border-line bg-card p-6 shadow-sm">
              <h2 className="text-lg font-bold text-foreground mb-4">
                Información Personal
              </h2>
              <ProfileForm
                initialData={{
                  names: profile.names,
                  lastnames: profile.lastnames,
                  category: profile.category,
                  photoUrl: profile.photoUrl,
                }}
              />
            </div>

            {/* Visualización de Puntos e Historial */}
            <div className="lg:col-span-5">
              <PointsHistory
                scoring={profile.scoring}
                movements={profile.movements}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

