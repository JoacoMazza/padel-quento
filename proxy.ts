import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@/src/domain/enums";

const publicPaths = new Set(["/login", "/register"]);

function isPublicPath(pathname: string) {
  if (publicPaths.has(pathname)) {
    return true;
  }
  // El navegador pide el manifest y recursos estáticos sin cookies de sesión.
  return (
    pathname.startsWith("/api/auth") ||
    // Los procesos en segundo plano los llama un programador sin sesión: el endpoint
    // se protege con CRON_SECRET (ver src/lib/cron.ts).
    pathname.startsWith("/api/cron/") ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/material_landing/") ||
    pathname === "/favicon.ico" ||
    /\.(mp4|jpg|jpeg|png|gif|webp|svg|ico)$/i.test(pathname)
  );
}

/**
 * Pantallas que se pueden ver sin sesión (landing, turnos y partidos abiertos):
 * el login se pide recién al reservar o sumarse a un partido. A diferencia de
 * las rutas de autenticación, el admin con sesión igual vuelve a su panel.
 */
function isGuestVisiblePath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/bookings" ||
    pathname === "/open-matches" ||
    pathname.startsWith("/open-matches/")
  );
}

function isTeacherPath(pathname: string) {
  return pathname === "/teacher" || pathname.startsWith("/teacher/");
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token && !isPublicPath(pathname) && !isGuestVisiblePath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && publicPaths.has(pathname)) {
    const destination = token.role === Role.ADMIN ? "/admin" : "/";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Criterio de aceptación: Si un usuario con rol "Jugador" intenta acceder a rutas administrativas, denegar HTTP 403
  if (isAdminPath(pathname)) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (token.role !== Role.ADMIN) {
      return new NextResponse("Acceso denegado: Se requieren permisos de Administrador", {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  }

  // HU-42: la sección del profesor es solo para profesores activos. El permiso
  // real lo verifica el servidor contra la base (requireTeacher).
  if (isTeacherPath(pathname) && !token?.isTeacher) {
    return new NextResponse("Acceso denegado: Se requiere el rol de Profesor", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // El administrador queda encapsulado dentro del panel: cualquier ruta pública
  // fuera de /admin lo redirige de vuelta, salvo endpoints de auth (login/logout).
  if (token && token.role === Role.ADMIN && !isAdminPath(pathname) && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
