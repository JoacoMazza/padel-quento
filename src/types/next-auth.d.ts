import { Role } from "@/src/domain/enums";
import { DefaultSession, DefaultUser } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: Role;
      /** Admin dueño del complejo (ver AdminAccessLevel). */
      isOwner?: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    role?: Role;
    isOwner?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    isOwner?: boolean;
  }
}
