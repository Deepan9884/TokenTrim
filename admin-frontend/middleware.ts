import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/users', '/events', '/security'];

/**
 * Admin Frontend Middleware:
 * Protects admin dashboard pages, redirecting unauthenticated users to /login.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const session = req.cookies.get('tt_session')?.value;
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/users/:path*', '/events/:path*', '/security/:path*']
};
