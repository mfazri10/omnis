import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

// better-auth menambahkan prefiks __Secure- saat HTTPS/production, jadi dua
// nama harus dicek; kalau tidak, sesi valid tetap dianggap tamu di produksi.
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  // Presence check saja; API menegakkan validitas sesi yang sebenarnya.
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (pathname !== "/" && !isPublic && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
