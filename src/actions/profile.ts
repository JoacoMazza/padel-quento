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
  phoneNumber: string;
  category: string;
  scoring: number;
  isBlocked: boolean;
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

  const player = await playerRepo.findOne({
    where: { account: { email: userEmail } },
    relations: { account: true },
  });
  if (!player) {
    return null;
  }

  const penalties = await penaltyRepo.find({
    where: { player: { id: player.id } },
    order: { createdAt: "DESC" },
  });

  // Saldo neto calculado por el sistema (suma de penalizaciones/bonificaciones registradas)
  const netScoring = penalties.length > 0
    ? penalties.reduce((acc, p) => acc + Number(p.penalizedScoring), 0)
    : Number(player.scoring || 0);

  // Sincronizar el atributo scoring de la entidad Player
  if (player.scoring !== netScoring) {
    player.scoring = netScoring;
    await playerRepo.update(player.id, { scoring: netScoring });
  }

  return {
    id: player.id,
    email: player.account.email,
    names: player.names,
    lastnames: player.lastnames,
    phoneNumber: player.phoneNumber,
    category: player.category,
    scoring: netScoring,
    isBlocked: player.account.isBlocked,
    movements: penalties.map((p) => ({
      id: p.id,
      amount: Number(p.penalizedScoring),
      // Una penalización sin saldo para descontar se registra por 0 puntos.
      type: Number(p.penalizedScoring) > 0 ? "bonus" : "penalty",
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

  const { names, lastnames, category } = parsed.data;

  try {
    const dataSource = await getDataSource();
    const playerRepo = dataSource.getRepository<Player>("Player");

    const player = await playerRepo.findOne({
      where: { account: { email: session.user.email } },
      relations: { account: true },
    });
    if (!player) {
      return { message: "No se encontró el perfil de jugador." };
    }

    await playerRepo.update(player.id, { names, lastnames, category });
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
    let signedAmount = type === "penalty" && amount > 0 ? -amount : amount;

    const previousPenalties = await penaltyRepo.find({ where: { player: { id: playerId } } });
    const previousScoring = previousPenalties.reduce((sum, p) => sum + Number(p.penalizedScoring), 0);

    // El saldo nunca baja de 0: una penalización solo descuenta lo que el
    // jugador tiene, y se registra ese monto real para que el historial sume
    // igual que el saldo. Sin saldo se registra igual, por 0 puntos, para que
    // la falta quede en el historial (la usa el reporte de asistencia).
    if (signedAmount < 0) {
      signedAmount = -Math.min(-signedAmount, Math.max(previousScoring, 0));
    }

    if (signedAmount !== 0 || type === "penalty") {
      const penaltyRecord = penaltyRepo.create({
        player,
        penalizedScoring: signedAmount,
        reason: description,
      });
      await penaltyRepo.save(penaltyRecord);
    }

    // Recalcular saldo total de puntos en el jugador
    player.scoring = previousScoring + signedAmount;
    await playerRepo.save(player);

    revalidatePath("/profile");
    return true;
  } catch (error) {
    console.error("recordPointsMovement error:", error);
    return false;
  }
}
