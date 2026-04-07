import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/signup', '/signup/completion', '/reset-password'];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip middleware for API routes and static files
    if (
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Next.js middleware doesn't have direct access to localStorage.
    // We'll rely on a cookie 'access' or pass auth state differently.
    // Since the user rule says "access" token is in localStorage,
    // we can't fully block in server middleware using localStorage.
    // However, we can check for a cookie if we set one, OR we handle auth guard mostly on client side.
    // But requirement says: "애플리케이션 진입 시 미인증 사용자는 무조건 로그인 페이지(/login)로 리다이렉트 시키고, 로그인을 완료한 사용자는 무조건 메인 페이지(/)로 리다이렉트 되는 강력한 미들웨어(middleware.ts) 로직"

    // Next.js Middleware runs on Edge. We must use cookies for server-side auth check.
    const hasToken = request.cookies.has('access');
    const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));

    if (!hasToken && !isPublicRoute) {
        // Redirect unauthenticated users to login
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (hasToken && isPublicRoute) {
        // Redirect authenticated users away from public auth pages to main
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
