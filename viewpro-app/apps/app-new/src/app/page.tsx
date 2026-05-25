import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const DEFAULT_API_URL = 'http://localhost:3001/api';
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
const AUTH_ME_TIMEOUT_MS = 3_000;

export default async function Page() {
  const cookieStore = await cookies();
  const response = await getSessionResponse(cookieStore.toString());

  if (!response?.ok) {
    return redirect('/auth/sign-in');
  }

  redirect('/dashboard');
}

async function getSessionResponse(cookieHeader: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_ME_TIMEOUT_MS);

  try {
    return await fetch(`${API_URL}/auth/me`, {
      cache: 'no-store',
      credentials: 'include',
      headers: {
        cookie: cookieHeader
      },
      signal: controller.signal
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
