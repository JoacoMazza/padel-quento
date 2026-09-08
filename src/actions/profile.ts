"use server";

import "reflect-metadata";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/src/lib/auth";
import { getDataSource } from "@/src/lib/db";
import { Player } from "@/src/entities/Player";
import { Penalty } from "@/src/entities/Penalty";
import {
  parseProfileForm,
  type ProfileFieldErrors,
} from "@/src/lib/profile-validation";

export type ProfileState = {
  success?: boolean;
  message?: string;
  errors?: ProfileFieldErrors;
};

export type PlayerProfileData = {
  id: number;
  email: string;
  names: string;
  lastnames: string;
  category: string;
  scoring: number;
  photoUrl: string | null;
  movements: Array<{
    id: number;
    amount: number;
    type: "bonus" | "penalty";
    description: string;
    createdAt: string;
  }>;
};

export async function getProfileData(userEmail: string): Promise<PlayerProfileData | null> {
  const dataSource = await getDataSource();
  const playerRepo = dataSource.getRepository<Player>("Player");
  const penaltyRepo = dataSource.getRepository<Penalty>("Penalty");

  const player = await playerRepo.findOne({ where: { email: userEmail } });
  if (!player) {
    return null;
  }

  const penalties = await penaltyRepo.find({
    where: { playerId: player.id },
    order: { createdAt: "DESC" },
  });

  // Saldo neto calculado por el sistema (suma de penalizaciones/bonificaciones registradas)
  const netScoring = penalties.length > 0
    ? penalties.reduce((acc, p) => acc + Number(p.penalizedScoring), 0)
    : Number(player.scoring || 0);

  // Sincronizar el atributo scoring de la entidad Player
  if (player.scoring !== netScoring) {
    player.scoring = netScoring;
    await playerRepo.save(player);
  }

  return {
    id: player.id,
    email: player.email,
    names: player.names,
    lastnames: player.lastnames,
    category: player.category,
    scoring: netScoring,
    photoUrl: player.photoUrl,
    movements: penalties.map((p) => ({
      id: p.id,
      amount: Number(p.penalizedScoring),
      type: Number(p.penalizedScoring) >= 0 ? "bonus" : "penalty",
      description: p.reason,
      createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
    })),
  };
}

export async function updatePlayerProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { message: "No estás autenticado." };
  }

  const parsed = parseProfileForm(formData);
  if (parsed.errors || !parsed.data) {
    return { errors: parsed.errors };
  }

  const { names, lastnames, category, photoUrl } = parsed.data;

  try {
    const dataSource = await getDataSource();
    const playerRepo = dataSource.getRepository<Player>("Player");

    const player = await playerRepo.findOne({ where: { email: session.user.email } });
    if (!player) {
      return { message: "No se encontró el perfil de jugador." };
    }

    player.names = names;
    player.lastnames = lastnames;
    player.category = category;
    player.photoUrl = photoUrl;

    await playerRepo.save(player);
    console.log(`[Profile] Perfil actualizado exitosamente para: ${session.user.email}`);

    revalidatePath("/profile");
    return {
      success: true,
      message: "¡Perfil actualizado con éxito!",
    };
  } catch (error) {
    console.error("updatePlayerProfile error:", error);
    return {
      message: "Error al actualizar el perfil. Intentá de nuevo más tarde.",
    };
  }
}

export async function recordPointsMovement(
  playerId: number,
  amount: number,
  type: "bonus" | "penalty",
  description: string,
): Promise<boolean> {
  try {
    const dataSource = await getDataSource();
    const playerRepo = dataSource.getRepository<Player>("Player");
    const penaltyRepo = dataSource.getRepository<Penalty>("Penalty");

    const player = await playerRepo.findOne({ where: { id: playerId } });
    if (!player) return false;

    // Asegurar que penalización sea negativa y bonificación positiva si fuera necesario
    const signedAmount = type === "penalty" && amount > 0 ? -amount : amount;

    const penaltyRecord = penaltyRepo.create({
      playerId,
      player,
      penalizedScoring: signedAmount,
      reason: description,
    });
    await penaltyRepo.save(penaltyRecord);

    // Recalcular saldo total de puntos en el jugador
    const allPenalties = await penaltyRepo.find({ where: { playerId } });
    const netScoring = allPenalties.reduce((sum, p) => sum + Number(p.penalizedScoring), 0);
    player.scoring = netScoring;
    await playerRepo.save(player);

    revalidatePath("/profile");
    return true;
  } catch (error) {
    console.error("recordPointsMovement error:", error);
    return false;
  }
}
