"use server";

import "reflect-metadata";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { Chat } from "@/src/entities/Chat";
import { MatchPlayer } from "@/src/entities/MatchPlayer";
import { Message } from "@/src/entities/Message";
import { Player } from "@/src/entities/Player";
import type { PlayerCategory } from "@/src/domain/enums";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";

/**
 * Único dato de un jugador que sale del chat hacia la UI (privacidad y anonimato):
 * nombre y categoría, más el id para distinguir "mis" mensajes. Nunca se devuelve
 * la entidad Player entera, que trae email, teléfono, dni y el hash de la contraseña.
 */
export type ChatParticipant = {
  id: number;
  names: string;
  lastnames: string;
  category: PlayerCategory;
};

export type ChatMessage = {
  id: number;
  content: string;
  sentAt: Date;
  sender: ChatParticipant;
};

export type ChatRoom = {
  id: number;
  booking: { fromDateTime: Date; courtNumber: number | null };
  participants: ChatParticipant[];
};

/** Cuántos mensajes se traen como máximo: los más recientes de la sala. */
const MESSAGES_PAGE_SIZE = 200;

const NOT_AUTHENTICATED_MESSAGE = "No estás autenticado.";
const NOT_PARTICIPANT_MESSAGE = "No tenés acceso a este chat.";
const BLOCKED_PLAYER_MESSAGE = "El usuario se encuentra bloqueado y no puede enviar mensajes.";
const EMPTY_MESSAGE_MESSAGE = "Escribí un mensaje para enviarlo.";
const MESSAGE_TOO_LONG_MESSAGE = `El mensaje no puede superar los ${CHAT_MESSAGE_MAX_LENGTH} caracteres.`;

function toParticipant(player: Player): ChatParticipant {
  return {
    id: player.id,
    names: player.names,
    lastnames: player.lastnames,
    category: player.category,
  };
}

/**
 * Resuelve al jugador de la sesión y verifica que participe del partido de la sala.
 * El remitente sale siempre de la sesión (nunca de un parámetro del cliente), así
 * nadie puede escribir ni leer haciéndose pasar por otro jugador.
 */
async function resolveParticipant(
  chatId: number,
): Promise<{ ok: true; player: Player } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { ok: false, error: NOT_AUTHENTICATED_MESSAGE };
  }

  const dataSource = await getDataSource();
  const player = await dataSource
    .getRepository<Player>("Player")
    .findOne({ where: { email: session.user.email } });
  if (!player) {
    return { ok: false, error: NOT_PARTICIPANT_MESSAGE };
  }

  const joined = await dataSource.getRepository<MatchPlayer>("MatchPlayer").count({
    where: { match: { chat: { id: chatId } }, player: { id: player.id } },
  });
  if (joined === 0) {
    return { ok: false, error: NOT_PARTICIPANT_MESSAGE };
  }

  return { ok: true, player };
}

export async function getChatById(id: number): Promise<ActionResult<ChatRoom | null>> {
  try {
    const dataSource = await getDataSource();
    const chats = dataSource.getRepository<Chat>("Chat");
    const chat = await chats.findOne({
      where: { id },
      relations: {
        match: { booking: { court: true }, matchPlayers: { player: true } },
      },
    });
    if (!chat) {
      return { success: true, data: null };
    }

    const room: ChatRoom = {
      id: chat.id,
      booking: {
        fromDateTime: chat.match.booking.fromDateTime,
        courtNumber: chat.match.booking.court?.number ?? null,
      },
      participants: chat.match.matchPlayers.map((matchPlayer) => toParticipant(matchPlayer.player)),
    };
    return { success: true, data: toPlain(room) };
  } catch (error) {
    console.error("getChatById", error);
    return { success: false, error: "No se pudo obtener el chat." };
  }
}

export async function getChatMessages(chatId: number): Promise<ActionResult<ChatMessage[]>> {
  try {
    const participant = await resolveParticipant(chatId);
    if (!participant.ok) {
      return { success: false, error: participant.error };
    }

    const dataSource = await getDataSource();
    const found = await dataSource.getRepository<Message>("Message").find({
      where: { chat: { id: chatId } },
      relations: { sender: true },
      order: { sentAt: "DESC", id: "DESC" },
      take: MESSAGES_PAGE_SIZE,
    });

    const data: ChatMessage[] = found.reverse().map((message) => ({
      id: message.id,
      content: message.content,
      sentAt: message.sentAt,
      sender: toParticipant(message.sender),
    }));
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getChatMessages", error);
    return { success: false, error: "No se pudieron obtener los mensajes." };
  }
}

export async function sendMessage(chatId: number, content: string): Promise<ActionResult<ChatMessage>> {
  try {
    const trimmed = typeof content === "string" ? content.trim() : "";
    if (trimmed.length === 0) {
      return { success: false, error: EMPTY_MESSAGE_MESSAGE };
    }
    if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
      return { success: false, error: MESSAGE_TOO_LONG_MESSAGE };
    }

    const participant = await resolveParticipant(chatId);
    if (!participant.ok) {
      return { success: false, error: participant.error };
    }
    if (participant.player.isBlocked) {
      return { success: false, error: BLOCKED_PLAYER_MESSAGE };
    }

    const dataSource = await getDataSource();
    const messages = dataSource.getRepository<Message>("Message");
    const saved = await messages.save(
      messages.create({
        chat: { id: chatId },
        sender: { id: participant.player.id },
        content: trimmed,
      }),
    );

    return {
      success: true,
      data: toPlain({
        id: saved.id,
        content: saved.content,
        sentAt: saved.sentAt,
        sender: toParticipant(participant.player),
      }),
    };
  } catch (error) {
    console.error("sendMessage", error);
    return { success: false, error: "No se pudo enviar el mensaje." };
  }
}
