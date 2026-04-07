import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  username: varchar("username", { length: 64 }),
  bio: text("bio"),
  avatar: text("avatar"),
  status: varchar("status", { length: 20 }).default("available"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  deletionRequestedAt: timestamp("deletionRequestedAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Local email/password credentials (alternative to OAuth).
 * One row per user who registered via email+password.
 */
export const authCredentials = mysqlTable("auth_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuthCredential = typeof authCredentials.$inferSelect;
export type InsertAuthCredential = typeof authCredentials.$inferInsert;

/**
 * Groups / Events
 */
export const groups = mysqlTable("groups", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("groupType", ["classic", "auto-destruct"]).default("classic").notNull(),
  coverImage: text("coverImage"),
  date: varchar("date", { length: 32 }),
  time: varchar("time", { length: 16 }),
  location: text("location"),
  shareCode: varchar("shareCode", { length: 16 }),
  template: varchar("template", { length: 32 }),
  createdBy: int("createdBy").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("groups_shareCode_idx").on(t.shareCode),
  index("groups_createdBy_idx").on(t.createdBy),
]);

export type Group = typeof groups.$inferSelect;
export type InsertGroup = typeof groups.$inferInsert;

/**
 * Group Members
 */
export const groupMembers = mysqlTable("group_members", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  rsvp: mysqlEnum("rsvp", ["present", "absent", "maybe", "pending"]).default("pending").notNull(),
  role: mysqlEnum("memberRole", ["admin", "member"]).default("member").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  lastReadAt: timestamp("lastReadAt"),
}, (t) => [
  uniqueIndex("group_members_groupId_userId_uniq").on(t.groupId, t.userId),
]);

export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = typeof groupMembers.$inferInsert;

/**
 * Chat Messages
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 64 }).notNull().unique(),
  groupId: int("groupId").notNull().references(() => groups.id, { onDelete: "cascade" }),
  // nullable pour supporter ON DELETE SET NULL (l'expéditeur peut être supprimé)
  senderId: int("senderId").references(() => users.id, { onDelete: "set null" }),
  text: text("text"),
  type: mysqlEnum("msgType", ["text", "image", "location"]).default("text").notNull(),
  imageUrl: text("imageUrl"),
  isPinned: boolean("isPinned").default(false).notNull(),
  reactions: text("reactions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("chat_messages_groupId_idx").on(t.groupId),
  index("chat_messages_senderId_idx").on(t.senderId),
  index("chat_messages_createdAt_idx").on(t.createdAt),
]);

export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Shopping Items
 */
export const shoppingItems = mysqlTable("shopping_items", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 64 }).notNull().unique(),
  groupId: int("groupId").notNull().references(() => groups.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: int("quantity").default(1),
  price: decimal("price", { precision: 10, scale: 2 }),
  assignedTo: varchar("assignedTo", { length: 128 }),
  assignedToName: varchar("assignedToName", { length: 128 }),
  checked: boolean("checked").default(false).notNull(),
  addedBy: int("addedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("shopping_items_groupId_idx").on(t.groupId),
]);

export type ShoppingItemRow = typeof shoppingItems.$inferSelect;
export type InsertShoppingItem = typeof shoppingItems.$inferInsert;

/**
 * Expenses (Tricount)
 */
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 64 }).notNull().unique(),
  groupId: int("groupId").notNull().references(() => groups.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paidBy: varchar("paidBy", { length: 128 }).notNull(),
  paidByName: varchar("paidByName", { length: 128 }),
  splitBetween: text("splitBetween"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("expenses_groupId_idx").on(t.groupId),
]);

export type ExpenseRow = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

/**
 * Tasks
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 64 }).notNull().unique(),
  groupId: int("groupId").notNull().references(() => groups.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  assignedTo: varchar("assignedTo", { length: 128 }),
  assignedToName: varchar("assignedToName", { length: 128 }),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  completed: boolean("completed").default(false).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("tasks_groupId_idx").on(t.groupId),
]);

export type TaskRow = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Polls
 */
export const polls = mysqlTable("polls", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 64 }).notNull().unique(),
  groupId: int("groupId").notNull().references(() => groups.id, { onDelete: "cascade" }),
  question: varchar("question", { length: 500 }).notNull(),
  options: text("options"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("polls_groupId_idx").on(t.groupId),
]);

export type PollRow = typeof polls.$inferSelect;
export type InsertPoll = typeof polls.$inferInsert;

/**
 * Carpool Rides
 */
export const carpoolRides = mysqlTable("carpool_rides", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 64 }).notNull().unique(),
  groupId: int("groupId").notNull().references(() => groups.id, { onDelete: "cascade" }),
  driverName: varchar("driverName", { length: 128 }).notNull(),
  driverId: varchar("driverId", { length: 128 }).notNull(),
  departure: varchar("departure", { length: 255 }),
  departureTime: varchar("departureTime", { length: 32 }),
  totalSeats: int("totalSeats").default(4),
  availableSeats: int("availableSeats").default(3),
  passengers: text("passengers"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("carpool_rides_groupId_idx").on(t.groupId),
]);

export type CarpoolRideRow = typeof carpoolRides.$inferSelect;
export type InsertCarpoolRide = typeof carpoolRides.$inferInsert;

/**
 * Photos
 */
export const photos = mysqlTable("photos", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 64 }).notNull().unique(),
  groupId: int("groupId").notNull().references(() => groups.id, { onDelete: "cascade" }),
  uri: text("uri").notNull(),
  uploadedBy: varchar("uploadedBy", { length: 128 }),
  uploadedByName: varchar("uploadedByName", { length: 128 }),
  caption: text("caption"),
  likes: int("likes").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("photos_groupId_idx").on(t.groupId),
]);

export type PhotoRow = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;

/**
 * Push notification tokens
 */
export const pushTokens = mysqlTable("push_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 512 }).notNull(),
  platform: varchar("platform", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("push_tokens_userId_idx").on(t.userId),
]);

export type PushToken = typeof pushTokens.$inferSelect;
export type InsertPushToken = typeof pushTokens.$inferInsert;

/**
 * Friendships
 */
export const friendships = mysqlTable("friendships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  friendId: int("friendId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("friendStatus", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("friendships_userId_idx").on(t.userId),
  index("friendships_friendId_idx").on(t.friendId),
  // NOTE: a functional UNIQUE INDEX on (LEAST(userId,friendId), GREATEST(userId,friendId))
  // is managed via raw SQL migration (0005) — not expressible in Drizzle's schema DSL.
]);

export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = typeof friendships.$inferInsert;
