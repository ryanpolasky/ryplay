/**
 * Centralized artwork loader.
 *
 * Multiple parts of the UI need the same artwork image: ``useArtworkPalette``
 * loads it for color extraction, ``VinylView`` waits for it before starting
 * the disc-flip animation, and the various ``<img>`` tags around the page
 * eventually render it. Without coordination, the same URL can end up
 * hitting the network 2–3 times on a cold load.
 *
 * This module wraps the proxy URL in a single in-flight Promise per URL,
 * so any concurrent caller gets the same loaded ``HTMLImageElement``. The
 * proxy itself returns ``Cache-Control: immutable``, so subsequent
 * ``<img src={artworkProxyUrl(...)}>`` renders are served from the disk
 * cache.
 */

const inflight = new Map<string, Promise<HTMLImageElement>>();

/** Resolve the artwork proxy URL for a given upstream image URL. */
export function artworkProxyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return `/api/artwork?url=${encodeURIComponent(url)}`;
}

/** Load an image once, sharing the same promise across concurrent callers. */
export function loadArtworkImage(proxyUrl: string): Promise<HTMLImageElement> {
  const existing = inflight.get(proxyUrl);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => {
      // Drop the failed promise so a future caller can retry.
      inflight.delete(proxyUrl);
      reject(e);
    };
    img.src = proxyUrl;
  });

  inflight.set(proxyUrl, promise);
  return promise;
}
