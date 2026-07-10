// Refresh session cookie + chặn truy cập /admin khi chưa đăng nhập.
// Lưu ý: đây chỉ là hàng rào tiện dụng. Chốt chặn thật là RLS ở database (mục 2).
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Chưa đăng nhập mà vào /admin → về /login
  if (path.startsWith('/admin') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Đã đăng nhập mà vào /login → sang /admin
  if (path === '/login' && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Bỏ qua static assets & route sale (/s/... tự bảo vệ bằng token qua Edge Function).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|s/|availability|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
