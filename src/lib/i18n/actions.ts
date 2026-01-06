'use server';

import { cookies } from 'next/headers';
import { env } from '@/lib/env/server';
import type { Locale } from './config';

/**
 * Set the user's preferred locale via a cookie.
 * This is a server action that can be called from client components.
 */
export async function setLocale(locale: Locale): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set({
    name: 'locale',
    value: locale,
    path: '/',
    maxAge: 31536000, // 1 year
    sameSite: 'strict',
    secure: env.NODE_ENV === 'production',
  });
}
