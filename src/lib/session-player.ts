import "reflect-metadata";
import { getServerSession } from "next-auth/next";
import type { Player } from "@/src/entities/Player";
import { authOptions } from "@/src/lib/auth";
import { getDataSource } from "@/src/lib/db";

/**
 * Id del jugador con sesión iniciada, o null si no hay sesión o la cuenta no
 * es de un jugador. Las acciones que operan a nombre de alguien lo toman de acá
 * y nunca del id que manda el cliente.
 */
export async function getSessionPlayerId(): Promise<number | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;

  const dataSource = await getDataSource();
  const player = await dataSource.getRepository<Player>("Player").findOne({ where: { account: { email } } });
  return player?.id ?? null;
}
