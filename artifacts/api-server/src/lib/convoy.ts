import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  tripsTable,
  tripMembersTable,
  type TripRow,
  type TripMemberRow,
} from "@workspace/db";
import {
  cumulativeDistances,
  haversineM,
  projectOnRoute,
  type Pt,
} from "./geo";
import { reverseGeocode } from "./external";
import { logger } from "./logger";

export const MEMBER_COLORS = [
  "#4285F4", // maps blue
  "#EA4335", // maps red
  "#F9AB00", // maps amber
  "#34A853", // maps green
  "#A142F4", // violet
  "#F4511E", // deep orange
  "#00ACC1", // cyan
  "#D81B60", // pink
  "#7CB342", // light green
  "#5C6BC0", // indigo
  "#00897B", // teal
  "#C0CA33", // lime
] as const;

export const ACTIVE_STATUSES = ["joined", "invited"] as const;

const STOPPED_AFTER_S = 3 * 60;
const NOT_UPDATING_AFTER_S = 5 * 60;
const OFF_ROUTE_M = 500;
const AUTO_END_AFTER_S = 12 * 60 * 60;
const COMPLETED_WITHIN_M = 2000;

export function pickColor(existing: TripMemberRow[]): string {
  const used = new Set(existing.map((m) => m.color));
  for (const c of MEMBER_COLORS) {
    if (!used.has(c)) return c;
  }
  return MEMBER_COLORS[existing.length % MEMBER_COLORS.length]!;
}

export function initialOf(name: string): string {
  const trimmed = name.trim();
  return (trimmed.length > 0 ? trimmed[0]! : "?").toUpperCase();
}

export function tripToApi(trip: TripRow) {
  return {
    id: trip.id,
    name: trip.name,
    status: trip.status as "draft" | "active" | "ended",
    startLat: trip.startLat,
    startLng: trip.startLng,
    startLabel: trip.startLabel,
    destLat: trip.destLat,
    destLng: trip.destLng,
    destLabel: trip.destLabel,
    scheduledAt: trip.scheduledAt.toISOString(),
    routeDistanceM: trip.routeDistanceM,
    routeDurationS: trip.routeDurationS,
    joinCode: trip.joinCode,
    startedAt: trip.startedAt ? trip.startedAt.toISOString() : null,
    endedAt: trip.endedAt ? trip.endedAt.toISOString() : null,
  };
}

export function memberToApi(m: TripMemberRow, myUserId: number) {
  return {
    id: m.id,
    userId: m.userId,
    name: m.name,
    phone: m.phone,
    role: m.role as "leader" | "member",
    color: m.color,
    initial: m.initial,
    vehicleType: m.vehicleType,
    joinStatus: m.joinStatus as "joined" | "invited",
    isSelf: m.userId === myUserId,
  };
}

export async function getRoster(tripId: number): Promise<TripMemberRow[]> {
  return db
    .select()
    .from(tripMembersTable)
    .where(
      and(
        eq(tripMembersTable.tripId, tripId),
        inArray(tripMembersTable.joinStatus, [...ACTIVE_STATUSES]),
      ),
    )
    .orderBy(tripMembersTable.id);
}

export function findSelf(
  roster: TripMemberRow[],
  userId: number,
): TripMemberRow | undefined {
  return roster.find((m) => m.userId === userId);
}

export function buildTripDetail(
  trip: TripRow,
  roster: TripMemberRow[],
  myUserId: number,
) {
  const self = findSelf(roster, myUserId);
  return {
    trip: tripToApi(trip),
    members: roster.map((m) => memberToApi(m, myUserId)),
    routeGeometry: trip.routeGeometry,
    myMemberId: self?.id ?? 0,
    myRole: (self?.role ?? "member") as "leader" | "member",
  };
}

export type MemberStatus =
  | "moving"
  | "stopped"
  | "not_updating"
  | "not_sharing"
  | "not_joined";

export function statusOf(
  m: TripMemberRow,
  now: Date,
): { status: MemberStatus; statusSinceS: number | null } {
  if (m.joinStatus === "invited") return { status: "not_joined", statusSinceS: null };
  if (!m.sharing || !m.lastFixAt || m.lastLat == null || m.lastLng == null) {
    return { status: "not_sharing", statusSinceS: null };
  }
  const sinceFixS = (now.getTime() - m.lastFixAt.getTime()) / 1000;
  if (sinceFixS >= NOT_UPDATING_AFTER_S) {
    return { status: "not_updating", statusSinceS: Math.round(sinceFixS) };
  }
  const movedAt = m.lastMovedAt ?? m.lastFixAt;
  const sinceMovedS = (now.getTime() - movedAt.getTime()) / 1000;
  if (sinceMovedS >= STOPPED_AFTER_S) {
    return { status: "stopped", statusSinceS: Math.round(sinceMovedS) };
  }
  return { status: "moving", statusSinceS: null };
}

export function computeEndSummary(
  trip: TripRow,
  roster: TripMemberRow[],
  endedAt: Date,
): { totalDistanceM: number; durationS: number; completedNames: string[] } {
  const route = trip.routeGeometry;
  const cum = cumulativeDistances(route);
  const total = cum[cum.length - 1] ?? trip.routeDistanceM;
  const completedNames: string[] = [];
  for (const m of roster) {
    if (m.joinStatus !== "joined" || m.lastLat == null || m.lastLng == null)
      continue;
    const proj = projectOnRoute(route, cum, { lat: m.lastLat, lng: m.lastLng });
    const remaining = total - proj.progressM;
    const destDist = haversineM(
      { lat: m.lastLat, lng: m.lastLng },
      { lat: trip.destLat, lng: trip.destLng },
    );
    if (remaining <= COMPLETED_WITHIN_M || destDist <= COMPLETED_WITHIN_M) {
      completedNames.push(m.name);
    }
  }
  const durationS = trip.startedAt
    ? Math.max(0, (endedAt.getTime() - trip.startedAt.getTime()) / 1000)
    : 0;
  return {
    totalDistanceM: trip.routeDistanceM,
    durationS: Math.round(durationS),
    completedNames,
  };
}

export async function endTripNow(
  trip: TripRow,
  roster: TripMemberRow[],
): Promise<TripRow> {
  const endedAt = new Date();
  const summary = computeEndSummary(trip, roster, endedAt);
  const [updated] = await db
    .update(tripsTable)
    .set({ status: "ended", endedAt, endSummary: summary })
    .where(eq(tripsTable.id, trip.id))
    .returning();
  await db
    .update(tripMembersTable)
    .set({ sharing: false })
    .where(eq(tripMembersTable.tripId, trip.id));
  return updated!;
}

/** Auto-end an active trip after 12h of inactivity. Returns the (possibly updated) trip. */
export async function maybeAutoEnd(
  trip: TripRow,
  roster: TripMemberRow[],
): Promise<TripRow> {
  if (trip.status !== "active") return trip;
  const now = Date.now();
  let lastActivity = trip.startedAt ? trip.startedAt.getTime() : now;
  for (const m of roster) {
    if (m.lastFixAt && m.lastFixAt.getTime() > lastActivity) {
      lastActivity = m.lastFixAt.getTime();
    }
  }
  if ((now - lastActivity) / 1000 >= AUTO_END_AFTER_S) {
    logger.info({ tripId: trip.id }, "Auto-ending inactive trip");
    return endTripNow(trip, roster);
  }
  return trip;
}

const LABEL_STALE_S = 180;

/** Refresh at most one stale reverse-geocode label per call (Nominatim politeness). */
export async function refreshOneLastSeenLabel(
  roster: TripMemberRow[],
): Promise<void> {
  const now = Date.now();
  const candidate = roster.find(
    (m) =>
      m.lastLat != null &&
      m.lastLng != null &&
      (!m.lastSeenLabelAt ||
        (now - m.lastSeenLabelAt.getTime()) / 1000 > LABEL_STALE_S),
  );
  if (!candidate) return;
  // Mark attempt time first so failures don't hammer the geocoder.
  await db
    .update(tripMembersTable)
    .set({ lastSeenLabelAt: new Date() })
    .where(eq(tripMembersTable.id, candidate.id));
  const place = await reverseGeocode(candidate.lastLat!, candidate.lastLng!);
  if (place) {
    candidate.lastSeenLabel = place.label;
    await db
      .update(tripMembersTable)
      .set({ lastSeenLabel: place.label })
      .where(eq(tripMembersTable.id, candidate.id));
  }
}

export type MemberStateApi = {
  memberId: number;
  name: string;
  phone: string;
  role: "leader" | "member";
  color: string;
  initial: string;
  vehicleType: string | null;
  isSelf: boolean;
  status: MemberStatus;
  statusSinceS: number | null;
  lat: number | null;
  lng: number | null;
  lastFixAt: string | null;
  lastSeenLabel: string | null;
  progressM: number | null;
  remainingM: number | null;
  offRoute: boolean;
  gapM: number | null;
  gapS: number | null;
  speedMps: number | null;
  sortIndex: number;
  recordHistory: boolean;
};

export function computeMemberStates(
  trip: TripRow,
  roster: TripMemberRow[],
  myUserId: number,
  now: Date,
): MemberStateApi[] {
  const route = trip.routeGeometry;
  const cum = cumulativeDistances(route);
  const totalM = cum[cum.length - 1] ?? trip.routeDistanceM;

  type Enriched = {
    m: TripMemberRow;
    status: MemberStatus;
    statusSinceS: number | null;
    hasPos: boolean;
    progressM: number | null;
    remainingM: number | null;
    offRoute: boolean;
  };

  const enriched: Enriched[] = roster.map((m) => {
    const { status, statusSinceS } = statusOf(m, now);
    const hasPos = m.lastLat != null && m.lastLng != null;
    let progressM: number | null = null;
    let remainingM: number | null = null;
    let offRoute = false;
    if (hasPos) {
      const proj = projectOnRoute(route, cum, {
        lat: m.lastLat!,
        lng: m.lastLng!,
      });
      offRoute = proj.distToRouteM > OFF_ROUTE_M;
      if (!offRoute) {
        progressM = proj.progressM;
        remainingM = Math.max(0, totalM - proj.progressM);
      } else {
        remainingM = haversineM(
          { lat: m.lastLat!, lng: m.lastLng! },
          { lat: trip.destLat, lng: trip.destLng },
        );
      }
    }
    return { m, status, statusSinceS, hasPos, progressM, remainingM, offRoute };
  });

  // Group average speed from members currently moving
  const movingSpeeds = enriched
    .filter((e) => e.status === "moving" && (e.m.avgSpeedMps ?? 0) > 0.5)
    .map((e) => e.m.avgSpeedMps!);
  const groupAvgSpeed =
    movingSpeeds.length > 0
      ? movingSpeeds.reduce((a, b) => a + b, 0) / movingSpeeds.length
      : null;

  const self = enriched.find((e) => e.m.userId === myUserId);

  // Sort: on-route by progress desc (front first), then off-route with position, then no position
  const sorted = [...enriched].sort((a, b) => {
    const pa = a.progressM;
    const pb = b.progressM;
    if (pa != null && pb != null) return pb - pa;
    if (pa != null) return -1;
    if (pb != null) return 1;
    if (a.hasPos && !b.hasPos) return -1;
    if (!a.hasPos && b.hasPos) return 1;
    return a.m.name.localeCompare(b.m.name);
  });
  const sortIndexById = new Map<number, number>();
  sorted.forEach((e, i) => sortIndexById.set(e.m.id, i));

  return enriched.map((e) => {
    let gapM: number | null = null;
    let gapS: number | null = null;
    if (self && self.m.id !== e.m.id && self.hasPos && e.hasPos) {
      if (!self.offRoute && !e.offRoute && self.progressM != null && e.progressM != null) {
        gapM = e.progressM - self.progressM; // positive = ahead of viewer
        const absGap = Math.abs(gapM);
        let speedRef = e.m.avgSpeedMps ?? null;
        if (e.status !== "moving" || speedRef == null || speedRef <= 0.5) {
          speedRef = groupAvgSpeed;
        }
        if (speedRef != null && speedRef > 0.5) {
          gapS = Math.round(absGap / speedRef);
        }
      } else {
        // Off-route (either side): honest straight-line distance, no route ETA
        gapM = haversineM(
          { lat: self.m.lastLat!, lng: self.m.lastLng! },
          { lat: e.m.lastLat!, lng: e.m.lastLng! },
        );
        gapS = null;
      }
    }
    return {
      memberId: e.m.id,
      name: e.m.name,
      phone: e.m.phone,
      role: e.m.role as "leader" | "member",
      color: e.m.color,
      initial: e.m.initial,
      vehicleType: e.m.vehicleType,
      isSelf: e.m.userId === myUserId,
      status: e.status,
      statusSinceS: e.statusSinceS,
      lat: e.m.lastLat,
      lng: e.m.lastLng,
      lastFixAt: e.m.lastFixAt ? e.m.lastFixAt.toISOString() : null,
      lastSeenLabel: e.m.lastSeenLabel,
      progressM: e.progressM,
      remainingM: e.remainingM,
      offRoute: e.offRoute,
      gapM,
      gapS,
      speedMps: e.m.avgSpeedMps,
      sortIndex: sortIndexById.get(e.m.id) ?? 0,
      recordHistory: e.m.recordHistory,
    };
  });
}
