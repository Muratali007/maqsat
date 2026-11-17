import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/auth";

const PUBLIC = ["/login", "/healthz", "/auth"];

/** Optimistic check only (cookie present). Real verification happens in getSession(). */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (PUBLIC.some((p) => path === p || path.startsWith(p + "/")) || path.startsWith("/api")) return NextResponse.next();
  if (!request.cookies.has(COOKIE)) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
