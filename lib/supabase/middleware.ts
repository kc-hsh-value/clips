import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  console.log('=== MIDDLEWARE DEBUG ===');
  console.log('Pathname:', pathname);
  console.log('User:', user ? { id: user.id, email: user.email } : 'NO USER');

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/register', '/auth/callback'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // If not logged in and trying to access protected route
  if (!user && !isPublicRoute && pathname !== '/') {
    console.log('-> No user, redirecting to /login');
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If logged in, check profile and redirect accordingly
  if (user && !pathname.startsWith('/auth/callback')) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single();

    console.log('Profile query result:', { profile, error: error?.message });

    // If no profile exists yet, allow the pending page
    if (!profile) {
      console.log('-> No profile found');
      if (pathname.startsWith('/pending')) {
        console.log('-> Already on /pending, staying');
        // Let them stay on pending
        return supabaseResponse;
      }
      // Profile might not be created yet, redirect to pending
      console.log('-> Redirecting to /pending');
      const url = request.nextUrl.clone();
      url.pathname = '/pending';
      return NextResponse.redirect(url);
    }

    if (profile) {
      console.log('-> Profile found:', profile);
      // If pending approval, redirect to pending page
      if (profile.status === 'pending') {
        console.log('-> Status is pending');
        if (!pathname.startsWith('/pending')) {
          console.log('-> Redirecting to /pending');
          const url = request.nextUrl.clone();
          url.pathname = '/pending';
          return NextResponse.redirect(url);
        }
        // Already on /pending, let it through
        console.log('-> Already on /pending, staying');
        return supabaseResponse;
      }

      // If rejected, redirect to login with error
      if (profile.status === 'rejected') {
        if (!isPublicRoute) {
          const url = request.nextUrl.clone();
          url.pathname = '/login';
          url.searchParams.set('error', 'rejected');
          return NextResponse.redirect(url);
        }
        return supabaseResponse;
      }

      // Route protection based on role (user is approved)
      if (profile.status === 'approved') {
        // If approved user is on /pending, redirect them to their dashboard
        if (pathname.startsWith('/pending')) {
          const url = request.nextUrl.clone();
          url.pathname = profile.role === 'admin' ? '/admin' : '/dashboard';
          return NextResponse.redirect(url);
        }
        // Admin routes
        if (pathname.startsWith('/admin') && profile.role !== 'admin') {
          const url = request.nextUrl.clone();
          url.pathname = '/dashboard';
          return NextResponse.redirect(url);
        }

        // Clipper routes (dashboard)
        if (pathname.startsWith('/dashboard') && profile.role === 'admin') {
          const url = request.nextUrl.clone();
          url.pathname = '/admin';
          return NextResponse.redirect(url);
        }

        // Redirect from login/register if already authenticated
        if (isPublicRoute || pathname === '/') {
          const url = request.nextUrl.clone();
          url.pathname = profile.role === 'admin' ? '/admin' : '/dashboard';
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
