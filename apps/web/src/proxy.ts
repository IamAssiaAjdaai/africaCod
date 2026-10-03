import { NextResponse, type NextRequest } from "next/server";
// Keep the proxy import graph Edge-compatible. PostgreSQL abuse enforcement
// belongs to Node route handlers/actions, not this cross-runtime boundary.
export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const forwarded = new Headers(request.headers);
  forwarded.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: forwarded } });
  response.headers.set("X-Request-ID", requestId);
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
