/**
 * Resilient cross-origin fetching for the data sources that lack CORS headers
 * (KEGG, BioCyc, SMPDB, PANTHER). Public CORS proxies are individually flaky, so
 * we try the target directly first (works for CORS-enabled hosts such as
 * Reactome) and then fall back through an ordered list of proxies until one
 * returns a usable response.
 *
 * No API key, no backend — keeps the app fully standalone.
 */

// Ordered, browser-friendly CORS proxies. Each takes the target URL and returns
// a proxied URL. If one is down, the next is tried.
const PROXIES: Array<(url: string) => string> = [
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
];

const ACCEPT = 'application/json, application/xml, text/plain, */*';

/** Build the ordered list of URLs to try (direct first unless disabled). */
const attempts = (url: string, direct: boolean): string[] =>
  (direct ? [url] : []).concat(PROXIES.map((p) => p(url)));

/**
 * Fetch returning the first OK Response (direct, then proxies). Use when the
 * caller will read the body itself and status is a good enough signal.
 */
export async function corsFetch(url: string, opts: { direct?: boolean } = {}): Promise<Response> {
  let lastErr: unknown = null;
  for (const u of attempts(url, opts.direct !== false)) {
    try {
      const res = await fetch(u, { headers: { Accept: ACCEPT } });
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`All fetch attempts failed for ${url}`);
}

/**
 * Fetch text with content validation. A proxy that returns 200 with an error
 * page is rejected and the next proxy is tried — important for KGML/SBGN where
 * a wrong body would render as an empty/garbage map.
 */
export async function corsFetchText(url: string, validate?: (t: string) => boolean, opts: { direct?: boolean } = {}): Promise<string> {
  let lastErr: unknown = null;
  for (const u of attempts(url, opts.direct !== false)) {
    try {
      const res = await fetch(u, { headers: { Accept: ACCEPT } });
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
      const text = await res.text();
      if (!validate || validate(text)) return text;
      lastErr = new Error('response failed validation');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`All fetch attempts failed for ${url}`);
}

/** Fetch binary content (e.g. the KEGG pathway image) with proxy fallback. */
export async function corsFetchBlob(url: string, opts: { direct?: boolean } = {}): Promise<Blob> {
  const res = await corsFetch(url, opts);
  return res.blob();
}
