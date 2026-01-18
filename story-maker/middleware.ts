import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if the user is trying to access create pages
  if (request.nextUrl.pathname.startsWith('/create')) {
    // Check if user is authenticated (stored in localStorage, but we need to check via cookie or header)
    // Since we're using localStorage for auth, we'll handle this check on the client side
    // This middleware will just pass through, and we'll do the auth check in the layout
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/create/:path*'],
};
