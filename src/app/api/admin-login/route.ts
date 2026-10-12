import { verifyLegacyAdmin } from '@/lib/server/legacyAdmin';

export const runtime = 'nodejs';

const responseHeaders = { 'Cache-Control': 'no-store' };

/** Preserve legacy tree login without shipping its password in browser JavaScript. */
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ authenticated: false }, { status: 403, headers: responseHeaders });
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json({ authenticated: false }, { status: 415, headers: responseHeaders });
  }
  try {
    const raw = await request.text();
    if (raw.length > 4096) {
      return Response.json({ authenticated: false }, { status: 413, headers: responseHeaders });
    }
    const data: unknown = JSON.parse(raw);
    if (
      !data ||
      typeof data !== 'object' ||
      !('username' in data) ||
      typeof data.username !== 'string' ||
      !('password' in data) ||
      typeof data.password !== 'string'
    ) {
      return Response.json({ authenticated: false }, { status: 400, headers: responseHeaders });
    }
    const authenticated = await verifyLegacyAdmin(data.username, data.password);
    return Response.json(
      { authenticated },
      { status: authenticated ? 200 : 401, headers: responseHeaders }
    );
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 503;
    return Response.json({ authenticated: false }, { status, headers: responseHeaders });
  }
}
