import "reflect-metadata";
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Chat } from "@/src/entities/Chat";
import type { Player } from "@/src/entities/Player";

/**
 * Mensaje enviado por un jugador en la sala de chat de un partido abierto.
 * El remitente se guarda como relación al Player, pero al leer los mensajes
 * solo se expone su nombre y categoría (ver getChatMessages en
 * src/actions/chat.ts): el teléfono y el email nunca salen de la base.
 */
@Entity({ name: "messages" })
@Index("IDX_messages_chat_id", ["chat"])
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Chat", "messages", { onDelete: "CASCADE" })
  @JoinColumn({ name: "chat_id" })
  chat!: Chat;

  @ManyToOne("Player", { onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_id" })
  sender!: Player;

  @Column({ type: "text" })
  content!: string;

  @CreateDateColumn({ name: "sent_at" })
  sentAt!: Date;
}
