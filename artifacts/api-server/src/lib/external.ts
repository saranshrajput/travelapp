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

type NominatimItem = {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
};

function shortLabel(item: NominatimItem): string {
  const a = item.address ?? {};
  const locality =
    a["suburb"] ??
    a["neighbourhood"] ??
    a["village"] ??
    a["town"] ??
    a["city_district"] ??
    a["city"] ??
    a["county"] ??
    "";
  const region = a["state"] ?? a["city"] ?? "";
  const head = item.name && item.name.length > 0 ? item.name : a["road"] ?? "";
  const parts = [head, locality, region].filter(
    (p, i, arr) => p && p.length > 0 && arr.indexOf(p) === i,
  );
  if (parts.length > 0) return parts.slice(0, 3).join(", ");
  return (item.display_name ?? "Unknown place").split(",").slice(0, 3).join(",");
}

export async function searchPlaces(q: string): Promise<PlaceResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;
  const data = (await fetchJson(url, 8000)) as NominatimItem[];
  return data
    .filter((d) => d.lat && d.lon)
    .map((d) => ({
      label: (d.display_name ?? shortLabel(d)).split(",").slice(0, 4).join(","),
      lat: Number(d.lat),
      lng: Number(d.lon),
    }));
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
