import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  doublePrecision,
  jsonb,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tripsTable = pgTable("trips", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"), // draft | active | ended
  startLat: doublePrecision("start_lat").notNull(),
  startLng: doublePrecision("start_lng").notNull(),
  startLabel: text("start_label").notNull(),
  destLat: doublePrecision("dest_lat").notNull(),
  destLng: doublePrecision("dest_lng").notNull(),
  destLabel: text("dest_label").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  routeGeometry: jsonb("route_geometry")
    .$type<{ lat: number; lng: number }[]>()
    .notNull(),
  routeDistanceM: doublePrecision("route_distance_m").notNull(),
  routeDurationS: doublePrecision("route_duration_s").notNull(),
  joinCode: text("join_code").notNull().unique(),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endSummary: jsonb("end_summary").$type<{
    totalDistanceM: number;
    durationS: number;
    completedNames: string[];
  } | null>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tripMembersTable = pgTable("trip_members", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id")
    .notNull()
    .references(() => tripsTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: text("role").notNull().default("member"), // leader | member
  color: text("color").notNull(),
  initial: text("initial").notNull(),
  vehicleType: text("vehicle_type"),
  joinStatus: text("join_status").notNull().default("joined"), // joined | invited
  sharing: boolean("sharing").notNull().default(false),
  // opt-in per trip: when true, location fixes are also appended to
  // location_history for post-trip breadcrumb replay (default off to
  // preserve the minimal-retention design for everyone else)
  recordHistory: boolean("record_history").notNull().default(false),
  // latest fix
  lastLat: doublePrecision("last_lat"),
  lastLng: doublePrecision("last_lng"),
  lastFixAt: timestamp("last_fix_at", { withTimezone: true }),
  // previous fix (for speed / movement detection)
  prevLat: doublePrecision("prev_lat"),
  prevLng: doublePrecision("prev_lng"),
  prevFixAt: timestamp("prev_fix_at", { withTimezone: true }),
  // smoothed speed m/s over recent fixes
  avgSpeedMps: doublePrecision("avg_speed_mps"),
  // when the member last moved more than the stationary threshold
  lastMovedAt: timestamp("last_moved_at", { withTimezone: true }),
  // cached reverse geocode label for last position
  lastSeenLabel: text("last_seen_label"),
  lastSeenLabelAt: timestamp("last_seen_label_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id")
    .notNull()
    .references(() => tripsTable.id),
  senderMemberId: integer("sender_member_id")
    .notNull()
    .references(() => tripMembersTable.id),
  recipientMemberId: integer("recipient_member_id").references(
    () => tripMembersTable.id,
  ),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("text"), // text | sos
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const locationHistoryTable = pgTable("location_history", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id")
    .notNull()
    .references(() => tripsTable.id),
  tripMemberId: integer("trip_member_id")
    .notNull()
    .references(() => tripMembersTable.id),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pitstopsTable = pgTable("pitstops", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id")
    .notNull()
    .references(() => tripsTable.id),
  droppedByMemberId: integer("dropped_by_member_id")
    .notNull()
    .references(() => tripMembersTable.id),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  label: text("label"),
  status: text("status").notNull().default("active"), // active | cancelled
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pitstopResponsesTable = pgTable(
  "pitstop_responses",
  {
    id: serial("id").primaryKey(),
    pitstopId: integer("pitstop_id")
      .notNull()
      .references(() => pitstopsTable.id),
    memberId: integer("member_id")
      .notNull()
      .references(() => tripMembersTable.id),
    response: text("response").notNull(), // on_my_way | already_there
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("pitstop_responses_pitstop_id_member_id_unique").on(t.pitstopId, t.memberId)],
);

export const safeZonesTable = pgTable("safe_zones", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id")
    .notNull()
    .references(() => tripsTable.id),
  createdByMemberId: integer("created_by_member_id")
    .notNull()
    .references(() => tripMembersTable.id),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  radiusM: doublePrecision("radius_m").notNull(),
  label: text("label"),
  status: text("status").notNull().default("active"), // active | removed
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSafeZoneSchema = createInsertSchema(safeZonesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSafeZone = z.infer<typeof insertSafeZoneSchema>;
export type SafeZoneRow = typeof safeZonesTable.$inferSelect;

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserRow = typeof usersTable.$inferSelect;

export const insertTripSchema = createInsertSchema(tripsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type TripRow = typeof tripsTable.$inferSelect;

export const insertTripMemberSchema = createInsertSchema(
  tripMembersTable,
).omit({ id: true, createdAt: true });
export type InsertTripMember = z.infer<typeof insertTripMemberSchema>;
export type TripMemberRow = typeof tripMembersTable.$inferSelect;

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type MessageRow = typeof messagesTable.$inferSelect;

export const insertLocationHistorySchema = createInsertSchema(
  locationHistoryTable,
).omit({ id: true });
export type InsertLocationHistory = z.infer<typeof insertLocationHistorySchema>;
export type LocationHistoryRow = typeof locationHistoryTable.$inferSelect;
