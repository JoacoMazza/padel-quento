import "reflect-metadata";
import { CreateDateColumn, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Match } from "@/src/entities/Match";
import type { Message } from "@/src/entities/Message";

/**
 * Sala de chat temporal de un partido abierto. Se crea y asocia automáticamente
 * al partido (ver joinOpenMatch en src/actions/booking.ts) recién cuando se suma
 * un segundo jugador con cuenta propia: antes de eso quien reservó no tendría
 * con quién hablar, y si nadie llega a sumarse el partido nunca llega a tener chat.
 */
@Entity({ name: "chats" })
export class Chat {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne("Match", "chat", { onDelete: "CASCADE" })
  @JoinColumn({ name: "match_id" })
  match!: Match;

  @OneToMany("Message", "chat")
  messages!: Message[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
