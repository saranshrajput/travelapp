import { logger } from "./logger";
import { downsample, type Pt } from "./geo";

const UA = "RallyTripApp/1.0 (group trip tracker)";

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`Upstream ${res.status} for ${url.split("?")[0]}`);
    }
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(t);
  }
}

export type PlaceResult = { label: string; lat: number; lng: number };

// ---------- Photon geocoder (komoot.io) — OSM data, no API key, generous limits ----------

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    county?: string;
  };
};

function photonLabel(f: PhotonFeature): string {
  const p = f.properties ?? {};
  const parts: string[] = [];
  if (p.name) parts.push(p.name);
  else if (p.street) parts.push(p.housenumber ? `${p.housenumber} ${p.street}` : p.street);
  if (p.district && p.district !== p.name) parts.push(p.district);
  if (p.city && p.city !== p.name) parts.push(p.city);
  if (p.state) parts.push(p.state);
  if (p.country) parts.push(p.country);
  return parts.filter(Boolean).slice(0, 4).join(", ") || "Unknown place";
}

// In-memory result cache (TTL 5 min) so repeated/slow typers don't hit upstream at all
const searchCache = new Map<string, { results: PlaceResult[]; expiresAt: number }>();
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

export async function searchPlaces(q: string): Promise<PlaceResult[]> {
  const key = q.toLowerCase().trim();
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`;
  const data = (await fetchJson(url, 8000)) as { features?: PhotonFeature[] };
  const features = data.features ?? [];
  const results: PlaceResult[] = features
    .filter((f) => f.geometry?.coordinates?.length === 2)
    .map((f) => ({
      label: photonLabel(f),
      lng: f.geometry!.coordinates![0],
      lat: f.geometry!.coordinates![1],
    }));

  searchCache.set(key, { results, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
  if (searchCache.size > 300) {
    const now = Date.now();
    for (const [k, v] of searchCache.entries()) {
      if (v.expiresAt < now) searchCache.delete(k);
    }
  }
  return results;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<PlaceResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`;
    const data = (await fetchJson(url, 4000)) as NominatimItem;
    return { label: shortLabel(data), lat, lng };
  } catch (err) {
    logger.warn({ err }, "reverse geocode failed");
    return null;
  }
}

export type RouteAlt = { geometry: Pt[]; distanceM: number; durationS: number };

type OsrmResponse = {
  code?: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
};

export async function routeAlternatives(
  from: Pt,
  to: Pt,
): Promise<RouteAlt[]> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?alternatives=3&overview=full&geometries=geojson`;
  const data = (await fetchJson(url, 12000)) as OsrmResponse;
  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    throw new Error(`OSRM returned ${data.code ?? "no routes"}`);
  }
  return data.routes.slice(0, 3).map((r) => ({
    geometry: downsample(
      r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      400,
    ),
    distanceM: r.distance,
    durationS: r.duration,
  }));
}
