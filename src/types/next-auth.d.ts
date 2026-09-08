import { Role } from "@/src/domain/enums";
import { DefaultSession, DefaultUser } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: Role;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    role?: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}
