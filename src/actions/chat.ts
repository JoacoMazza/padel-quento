"use server";

import "reflect-metadata";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { Chat } from "@/src/entities/Chat";
import { Match } from "@/src/entities/Match";
import { MatchPlayer } from "@/src/entities/MatchPlayer";
import { Message } from "@/src/entities/Message";
import { Player } from "@/src/entities/Player";
import type { PlayerCategory } from "@/src/domain/enums";
import { CHAT_MESSAGE_MAX_LENGTH, JOIN_MATCH_LOCK_CLASS, OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { getChatClosureReason, type ChatClosureReason } from "@/src/domain/chat-closure";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { notifyPlayerJoined } from "@/src/lib/match-notifications";

/**
 * Único dato de un jugador que sale del chat hacia la UI (privacidad y anonimato):
 * nombre y categoría, más el id para distinguir "mis" mensajes. Nunca se devuelve
 * la entidad Player entera, que con su cuenta trae teléfono, email y el hash de
 * la contraseña.
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
  /** id del turno: arma el link del partido abierto para compartir (HU-40). */
  booking: { id: number; fromDateTime: Date; courtNumber: number | null };
  participants: ChatParticipant[];
  /** true cuando el turno ya finalizó o fue cancelado: la sala queda en solo lectura. */
  isClosed: boolean;
  closedReason: ChatClosureReason | null;
};

/** Cuántos mensajes se traen como máximo: los más recientes de la sala. */
const MESSAGES_PAGE_SIZE = 200;

const NOT_AUTHENTICATED_MESSAGE = "No estás autenticado.";
const NOT_PARTICIPANT_MESSAGE = "No tenés acceso a este chat.";
const BLOCKED_PLAYER_MESSAGE = "El usuario se encuentra bloqueado y no puede enviar mensajes.";
const CHAT_CLOSED_MESSAGES: Record<ChatClosureReason, string> = {
  finished: "El chat se cerró porque el turno ya finalizó. Podés leer la conversación, pero no enviar mensajes nuevos.",
  cancelled: "El chat se cerró porque el turno fue cancelado. Podés leer la conversación, pero no enviar mensajes nuevos.",
};
const EMPTY_MESSAGE_MESSAGE = "Escribí un mensaje para enviarlo.";
const MESSAGE_TOO_LONG_MESSAGE = `El mensaje no puede superar los ${CHAT_MESSAGE_MAX_LENGTH} caracteres.`;
const CHAT_CLOSED_FOR_JOINING_MESSAGE = "El chat está cerrado: ya no se pueden sumar jugadores.";
const EMPTY_IDENTIFIER_MESSAGE = "Ingresá el email o el teléfono del jugador.";
const BLOCKED_INVITER_MESSAGE = "El usuario se encuentra bloqueado y no puede sumar jugadores.";
const PLAYER_NOT_FOUND_MESSAGE = "No encontramos un jugador registrado con ese email o teléfono.";
const BLOCKED_TARGET_MESSAGE = "Ese jugador se encuentra bloqueado y no puede sumarse a partidos.";
const ALREADY_IN_MATCH_MESSAGE = "Ese jugador ya forma parte del partido.";
const NO_SPOTS_MESSAGE = "No quedan lugares libres en el partido.";

class AlreadyInMatchError extends Error {}
class NoSpotsError extends Error {}

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
    .findOne({ where: { account: { email: session.user.email } }, relations: { account: true } });
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

    const closedReason = getChatClosureReason(chat.match.booking);
    const room: ChatRoom = {
      id: chat.id,
      booking: {
        id: chat.match.booking.id,
        fromDateTime: chat.match.booking.fromDateTime,
        courtNumber: chat.match.booking.court?.number ?? null,
      },
      participants: chat.match.matchPlayers.map((matchPlayer) => toParticipant(matchPlayer.player)),
      isClosed: closedReason !== null,
      closedReason,
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
    if (participant.player.account.isBlocked) {
      return { success: false, error: BLOCKED_PLAYER_MESSAGE };
    }

    const dataSource = await getDataSource();
    const chat = await dataSource.getRepository<Chat>("Chat").findOne({
      where: { id: chatId },
      relations: { match: { booking: true } },
    });
    const closedReason = chat ? getChatClosureReason(chat.match.booking) : null;
    if (closedReason) {
      return { success: false, error: CHAT_CLOSED_MESSAGES[closedReason] };
    }

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

/**
 * Un participante de la sala agrega a un jugador ya registrado, buscándolo por
 * email o teléfono exactos (así no se expone la lista de jugadores) (HU-40). Si
 * quien agrega se había anotado con acompañantes sin cuenta, el agregado pasa a
 * ocupar el lugar de uno de ellos (el total no cambia); si no, ocupa un lugar
 * libre del partido. Solo se devuelve nombre y categoría del agregado.
 */
export async function addPlayerToChat(
  chatId: number,
  identifier: string,
): Promise<ActionResult<ChatParticipant>> {
  try {
    const trimmed = typeof identifier === "string" ? identifier.trim() : "";
    if (trimmed.length === 0) {
      return { success: false, error: EMPTY_IDENTIFIER_MESSAGE };
    }

    const participant = await resolveParticipant(chatId);
    if (!participant.ok) {
      return { success: false, error: participant.error };
    }
    const inviter = participant.player;
    if (inviter.account.isBlocked) {
      return { success: false, error: BLOCKED_INVITER_MESSAGE };
    }

    const dataSource = await getDataSource();
    const chat = await dataSource.getRepository<Chat>("Chat").findOne({
      where: { id: chatId },
      relations: { match: { booking: true } },
    });
    if (!chat || getChatClosureReason(chat.match.booking)) {
      return { success: false, error: CHAT_CLOSED_FOR_JOINING_MESSAGE };
    }

    // Mismo formato con el que se guardan al registrarse (ver register-validation).
    const target = await dataSource.getRepository<Player>("Player").findOne({
      where: trimmed.includes("@")
        ? { account: { email: trimmed.toLowerCase() } }
        : { phoneNumber: trimmed.replace(/[\s()-]/g, "") },
      relations: { account: true },
    });
    if (!target) {
      return { success: false, error: PLAYER_NOT_FOUND_MESSAGE };
    }
    if (target.account.isBlocked) {
      return { success: false, error: BLOCKED_TARGET_MESSAGE };
    }

    await dataSource.transaction(async (manager) => {
      // Mismo lock que joinOpenMatch: serializa las altas en este partido.
      await manager.query("SELECT pg_advisory_xact_lock($1, $2)", [
        JOIN_MATCH_LOCK_CLASS,
        chat.match.booking.id,
      ]);

      const matches = manager.getRepository<Match>("Match");
      const match = await matches.findOne({
        where: { id: chat.match.id },
        relations: { matchPlayers: true },
      });
      if (!match) {
        throw new NoSpotsError();
      }
      if (match.matchPlayers.some((mp) => mp.playerId === target.id)) {
        throw new AlreadyInMatchError();
      }

      const matchPlayers = manager.getRepository<MatchPlayer>("MatchPlayer");
      const inviterParticipation = match.matchPlayers.find((mp) => mp.playerId === inviter.id);
      if (inviterParticipation && inviterParticipation.playersCount > 1) {
        await matchPlayers.update(inviterParticipation.id, {
          playersCount: inviterParticipation.playersCount - 1,
        });
      } else {
        const confirmedPlayers = match.matchPlayers.reduce((sum, mp) => sum + (mp.playersCount ?? 1), 0);
        if (!match.needPlayers || confirmedPlayers >= OPEN_MATCH_MAX_PLAYERS) {
          throw new NoSpotsError();
        }
        // Update() en vez de save(match), igual que en joinOpenMatch: guardar el
        // match con su array matchPlayers precargado podría borrar filas.
        if (confirmedPlayers + 1 >= OPEN_MATCH_MAX_PLAYERS) {
          await matches.update(match.id, { needPlayers: false });
        }
      }

      await matchPlayers.save(
        matchPlayers.create({ match: { id: match.id }, player: { id: target.id }, playersCount: 1 }),
      );
    });

    // Fuera de la transacción, igual que en joinOpenMatch: solo se avisa si el alta se guardó.
    await notifyPlayerJoined(chat.match.booking.id, target.id);

    return { success: true, data: toPlain(toParticipant(target)) };
  } catch (error) {
    if (error instanceof AlreadyInMatchError) {
      return { success: false, error: ALREADY_IN_MATCH_MESSAGE };
    }
    if (error instanceof NoSpotsError) {
      return { success: false, error: NO_SPOTS_MESSAGE };
    }
    console.error("addPlayerToChat", error);
    return { success: false, error: "No se pudo agregar al jugador." };
  }
}
