// utils/fetchWithAuth.ts
import { getAuth } from '@clerk/nextjs/server';
import { NextApiRequest } from 'next';

/**
 * Adds authorization headers to an outgoing fetch request (from server-side context).
 * If you are calling from client-side, you can pass the token via frontend session.
 */
export async function fetchWithAuth(
  req: NextApiRequest,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { getToken } = getAuth(req);
  const token = await getToken();

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  return fetch(url, {
    ...options,
    headers,
  });
}
