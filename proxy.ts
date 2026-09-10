import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@/src/domain/enums";

const publicPaths = new Set(["/login", "/register"]);

function isPublicPath(pathname: string) {
  if (publicPaths.has(pathname)) {
    return true;
  }
  return pathname.startsWith("/api/auth");
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

  if (!token && !isPublicPath(pathname)) {
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
