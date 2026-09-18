"use server";

import "reflect-metadata";
import { Chat } from "@/src/entities/Chat";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";

export async function getChatById(id: number): Promise<ActionResult<Chat | null>> {
  try {
    const dataSource = await getDataSource();
    const chats = dataSource.getRepository<Chat>("Chat");
    const data = await chats.findOne({
      where: { id },
      relations: {
        match: { booking: { court: true }, matchPlayers: { player: true } },
      },
    });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getChatById", error);
    return { success: false, error: "No se pudo obtener el chat." };
  }
}
