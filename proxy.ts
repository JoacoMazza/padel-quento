import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = new Set(["/login", "/register"]);

function isPublicPath(pathname: string) {
  if (publicPaths.has(pathname)) {
    return true;
  }
  return pathname.startsWith("/api/auth");
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
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
