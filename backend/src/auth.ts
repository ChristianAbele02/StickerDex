/**
 * Optional single-password protection. When STICKERDEX_PASSWORD is set, all
 * mutating requests (non-GET) require a valid signed auth cookie obtained via
 * POST /api/auth/login. When unset, the instance is fully open (single-user
 * LAN mode) and the auth endpoints report `required: false`.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const COOKIE_NAME = 'sd_auth';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function authEnabled(): boolean {
  return Boolean(process.env.STICKERDEX_PASSWORD);
}

export function registerAuth(app: FastifyInstance): void {
  // Gate mutating requests behind the auth cookie when a password is configured.
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!authEnabled()) return;
    if (SAFE_METHODS.has(req.method)) return;
    if (req.url.startsWith('/api/auth')) return;

    const cookie = req.cookies[COOKIE_NAME];
    const unsigned = cookie ? app.unsignCookie(cookie) : { valid: false };
    if (!unsigned.valid) {
      reply.code(401).send({ error: 'Authentication required' });
    }
  });

  app.get('/api/auth/status', async () => ({
    required: authEnabled(),
  }));

  app.post('/api/auth/login', async (req, reply) => {
    if (!authEnabled()) return { ok: true, required: false };
    const body = (req.body ?? {}) as { password?: string };
    if (body.password !== process.env.STICKERDEX_PASSWORD) {
      return reply.code(401).send({ error: 'Invalid password' });
    }
    reply.setCookie(COOKIE_NAME, 'ok', {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return { ok: true };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  });
}
