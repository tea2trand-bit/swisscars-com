import type { Config, Context } from '@netlify/functions';
import reference from '../../assets/js/fx-reference.js';

const TIMEOUT_MS = 6000;
type Options = { fetchFn?: typeof fetch; now?: () => number; timeoutMs?: number };
function json(body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=300, must-revalidate' : 'no-store',
      ...(status === 200 ? { 'Netlify-CDN-Cache-Control': 'public, max-age=3600, must-revalidate' } : {}),
      ...extra }
  });
}
function failure(code: string): never { throw Object.assign(new Error(code), { code }); }
async function limitedText(response: Response): Promise<string> {
  const declared = response.headers.get('content-length');
  if (declared && /^\d+$/.test(declared) && Number(declared) > reference.MAX_BYTES) {
    await response.body?.cancel(); failure('source_too_large');
  }
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!['text/xml', 'application/xml'].includes(type) || !response.body) {
    await response.body?.cancel(); failure('invalid_source');
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > reference.MAX_BYTES) failure('source_too_large');
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch (_) { /* preserve the sanitized source failure */ }
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
export function createHandler({ fetchFn = fetch, now = () => Date.now(), timeoutMs = TIMEOUT_MS }: Options = {}) {
  return async function (req: Request, _context?: Context): Promise<Response> {
    if (req.method !== 'GET') return json({ version: 1, source: 'ECB', status: 'unavailable', reason: 'method' }, 405, { Allow: 'GET' });
    try {
      const response = await fetchFn(reference.SOURCE_URL, { method: 'GET', redirect: 'error',
        headers: { Accept: 'application/xml, text/xml;q=0.9' }, signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) { await response.body?.cancel(); failure('source_unavailable'); }
      if (response.url && response.url !== reference.SOURCE_URL) { await response.body?.cancel(); failure('invalid_source'); }
      return json(reference.parse(await limitedText(response), { now: now() }));
    } catch (error) {
      const caught = error as { name?: string; code?: string };
      const reason = caught?.name === 'TimeoutError' || caught?.name === 'AbortError' ? 'source_timeout'
        : ['source_stale', 'source_too_large', 'source_unavailable'].includes(caught?.code || '') ? caught.code : 'invalid_source';
      return json({ version: 1, pair: 'CHF/EUR', source: 'ECB', status: 'unavailable', reason }, 503);
    }
  };
}
// Invocation setup happens here, never at module load. CDN/browser caching is
// explicit; there is no persistent store, process cache or background schedule.
export default async function (req: Request, context: Context): Promise<Response> {
  return createHandler()(req, context);
}
export const config: Config = { path: '/api/fx-reference' };
