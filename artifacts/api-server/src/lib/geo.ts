export type Pt = { lat: number; lng: number };

const R = 6371000;

export function haversineM(a: Pt, b: Pt): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Cumulative distance in meters at each route vertex. */
export function cumulativeDistances(route: Pt[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1]!;
    const cur = route[i]!;
    cum.push(cum[i - 1]! + haversineM(prev, cur));
  }
  return cum;
}

/**
 * Project a point onto the route polyline.
 * Returns progress along the route (m) and perpendicular distance to the route (m).
 */
export function projectOnRoute(
  route: Pt[],
  cum: number[],
  p: Pt,
): { progressM: number; distToRouteM: number } {
  if (route.length === 0) return { progressM: 0, distToRouteM: Infinity };
  if (route.length === 1) {
    return { progressM: 0, distToRouteM: haversineM(route[0]!, p) };
  }
  const cosLat = Math.cos((p.lat * Math.PI) / 180);
  const mx = (q: Pt) => (q.lng - p.lng) * cosLat * 111320;
  const my = (q: Pt) => (q.lat - p.lat) * 110540;

  let best = { progressM: 0, distToRouteM: Infinity };
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!;
    const b = route[i + 1]!;
    const ax = mx(a);
    const ay = my(a);
    const bx = mx(b);
    const by = my(b);
    const dx = bx - ax;
    const dy = by - ay;
    const segLen2 = dx * dx + dy * dy;
    let t = 0;
    if (segLen2 > 0) {
      // vector from a to p (p is origin in local coords)
      t = (-ax * dx - ay * dy) / segLen2;
      t = Math.max(0, Math.min(1, t));
    }
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const dist = Math.sqrt(cx * cx + cy * cy);
    if (dist < best.distToRouteM) {
      const segLenM = cum[i + 1]! - cum[i]!;
      best = { progressM: cum[i]! + t * segLenM, distToRouteM: dist };
    }
  }
  return best;
}

/** Downsample a polyline to at most maxPoints, always keeping first & last. */
export function downsample(route: Pt[], maxPoints: number): Pt[] {
  if (route.length <= maxPoints) return route;
  const step = (route.length - 1) / (maxPoints - 1);
  const out: Pt[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(route[Math.round(i * step)]!);
  }
  const last = route[route.length - 1]!;
  const outLast = out[out.length - 1]!;
  if (outLast.lat !== last.lat || outLast.lng !== last.lng) out.push(last);
  return out;
}
