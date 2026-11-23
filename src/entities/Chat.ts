import "reflect-metadata";
import { Column, CreateDateColumn, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Match } from "@/src/entities/Match";
import type { Message } from "@/src/entities/Message";

/**
 * Sala de chat temporal de un partido abierto. Se crea y asocia automáticamente
 * al partido (ver joinOpenMatch en src/actions/booking.ts) recién cuando se suma
 * un segundo jugador con cuenta propia: antes de eso quien reservó no tendría
 * con quién hablar, y si nadie llega a sumarse el partido nunca llega a tener chat.
 * Se crea abierta y la cierra closeFinishedChats (src/actions/chat.ts) una vez
 * terminado o cancelado el turno del partido.
 */
@Entity({ name: "chats" })
export class Chat {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne("Match", "chat", { onDelete: "CASCADE" })
  @JoinColumn({ name: "match_id", foreignKeyConstraintName: "FK_chats_match_id" })
  match!: Match;

  @OneToMany("Message", "chat")
  messages!: Message[];

  @Column({ type: "boolean", default: true, name: "is_open" })
  isOpen!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
