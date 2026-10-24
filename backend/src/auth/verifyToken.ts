import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, JWTPayload } from 'jose';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Verifies a Supabase-issued access token. Shared by Express, Socket.IO and Hocuspocus.
 *
 * Production paths (no bypass of any kind):
 *  1. Asymmetric keys (ES256/RS256) via the project's JWKS endpoint.
 *  2. Legacy shared secret (HS256) when SUPABASE_JWT_SECRET is configured.
 *  3. Fallback to supabase.auth.getUser() when neither path applies.
 *
 * Tests sign HS256 tokens with a per-run random secret and go through path 2.
 */
export interface VerifiedUser {
  id: string;
  email?: string;
}

export class AuthError extends Error {}

// Placeholder committed in .env.example / test config; refusing it in production
// prevents a test secret from ever being used to sign real tokens.
export const TEST_SECRET_PLACEHOLDER = 'local-test-secret-do-not-use-in-production';

const ASYMMETRIC_ALGS = ['ES256', 'RS256'];

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let supabase: SupabaseClient | null = null;

const supabaseUrl = () => process.env.SUPABASE_URL?.replace(/\/$/, '');

export function assertSafeAuthConfig() {
  if (process.env.NODE_ENV === 'production' && process.env.SUPABASE_JWT_SECRET === TEST_SECRET_PLACEHOLDER) {
    throw new Error('Refusing to start: SUPABASE_JWT_SECRET is the test placeholder in production');
  }
}

function getJwks() {
  const base = supabaseUrl();
  if (!base) return null;
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`));
  return jwks;
}

function getSupabase() {
  const base = supabaseUrl();
  if (!base || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!supabase) supabase = createClient(base, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return supabase;
}

function verifyOptions() {
  const base = supabaseUrl();
  return {
    audience: 'authenticated',
    // Issuer is checked whenever the project URL is known (always true in production).
    ...(base ? { issuer: `${base}/auth/v1` } : {}),
  };
}

function toUser(payload: JWTPayload): VerifiedUser {
  if (!payload.sub) throw new AuthError('Token has no subject');
  return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
}

export async function verifyAccessToken(token: string | undefined | null): Promise<VerifiedUser> {
  if (!token) throw new AuthError('Missing token');

  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    throw new AuthError('Malformed token');
  }

  if (alg && ASYMMETRIC_ALGS.includes(alg)) {
    const keySet = getJwks();
    if (keySet) {
      try {
        const { payload } = await jwtVerify(token, keySet, { ...verifyOptions(), algorithms: ASYMMETRIC_ALGS });
        return toUser(payload);
      } catch (err) {
        throw new AuthError(`Invalid token: ${(err as Error).message}`);
      }
    }
  } else if (alg === 'HS256' && process.env.SUPABASE_JWT_SECRET) {
    try {
      const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, { ...verifyOptions(), algorithms: ['HS256'] });
      return toUser(payload);
    } catch (err) {
      throw new AuthError(`Invalid token: ${(err as Error).message}`);
    }
  } else if (alg !== 'HS256') {
    throw new AuthError(`Unsupported token algorithm: ${alg}`);
  }

  // Fallback: ask Supabase Auth directly (network call per verification).
  const client = getSupabase();
  if (!client) throw new AuthError('No token verification method configured');
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new AuthError('Invalid token');
  return { id: data.user.id, email: data.user.email };
}
