import "reflect-metadata";
import { CreateDateColumn, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Match } from "@/src/entities/Match";
import type { Message } from "@/src/entities/Message";

/**
 * Sala de chat temporal de un partido abierto. Se crea y asocia automáticamente
 * junto con el partido (ver createBooking en src/actions/booking.ts), así quien
 * lo creó puede compartirla mediante un link o agregar jugadores registrados
 * desde el primer momento (ver joinChatMatch y addPlayerToChat en src/actions/chat.ts).
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
