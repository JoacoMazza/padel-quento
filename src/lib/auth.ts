import "reflect-metadata";
import bcrypt from "bcrypt";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { User } from "@/src/entities/User";
import { getDataSource } from "@/src/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) {
          console.warn("[Auth] Intento de login con email o contraseña vacíos.");
          return null;
        }

        try {
          const dataSource = await getDataSource();
          const users = dataSource.getRepository<User>("User");
          const user = await users.findOne({ where: { email } });

          if (!user) {
            console.warn(`[Auth] No se encontró usuario con el email: ${email}`);
            return null;
          }

          const matches = await bcrypt.compare(password, user.passwordHash);
          if (!matches) {
            console.warn(`[Auth] Contraseña incorrecta para el email: ${email}`);
            return null;
          }

          console.log(`[Auth] Login exitoso para el usuario: ${user.email}`);
          return {
            id: String(user.id),
            email: user.email,
            name: `${user.names} ${user.lastnames}`,
          };
        } catch (error) {
          console.error("[Auth Error] Fallo en conexión a BD o verificación de credenciales:", error);
          return null;
        }
      },

    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
