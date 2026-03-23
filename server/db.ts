import { eq, and, desc, lt, inArray, isNull, or, like } from "drizzle-orm";
import {
  parseJsonColumn, serializeJsonColumn,
  PollOption, pollOptionsSchema,
  Passenger, passengersSchema,
  Reaction, reactionsSchema,
} from "./utils/json-columns";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  groups, InsertGroup,
  groupMembers, InsertGroupMember,
  chatMessages, InsertChatMessage,
  pushTokens, InsertPushToken,
  shoppingItems, InsertShoppingItem,
  expenses, InsertExpense,
  tasks, InsertTask,
  polls, InsertPoll,
  carpoolRides, InsertCarpoolRide,
  photos, InsertPhoto,
  friendships, InsertFriendship,
  authCredentials,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== USERS =====

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, data: { name?: string; username?: string; bio?: string; avatar?: string; status?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function requestAccountDeletion(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ deletionRequestedAt: new Date() }).where(eq(users.id, userId));
}

export async function cancelAccountDeletion(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ deletionRequestedAt: null }).where(eq(users.id, userId));
}

export async function deleteUserAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Cascade deletes handle related data (groupMembers, pushTokens, etc.)
  await db.delete(users).where(eq(users.id, userId));
}

// ===== LOCAL AUTH CREDENTIALS =====

export async function getCredentialsByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(authCredentials).where(eq(authCredentials.email, email.toLowerCase())).limit(1);
  return rows[0] ?? undefined;
}

export async function createLocalUser(data: { name: string; email: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const openId = `local:${data.email.toLowerCase()}`;
  await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email.toLowerCase(),
    loginMethod: "email",
    lastSignedIn: new Date(),
  });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Failed to create user");
  await db.insert(authCredentials).values({
    userId: user.id,
    email: data.email.toLowerCase(),
    passwordHash: data.passwordHash,
  });
  return user;
}

// ===== GROUPS =====

export async function createGroup(data: InsertGroup) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(groups).values(data);
  return result[0].insertId;
}

export async function updateGroupCover(groupId: number, coverImage: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(groups).set({ coverImage }).where(eq(groups.id, groupId));
}

export async function updateGroup(groupId: number, data: { name?: string; description?: string; date?: string; time?: string; location?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(groups).set(data).where(eq(groups.id, groupId));
}

export async function searchUsers(query: string, excludeUserId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const cleanQuery = query.startsWith('@') ? query.slice(1) : query;
const pattern = `%${cleanQuery}%`;
  return db
    .select({ id: users.id, name: users.name, username: users.username, avatar: users.avatar, status: users.status })
    .from(users)
    .where(and(or(like(users.name, pattern), like(users.username, pattern))))
    .limit(limit);
}

export async function getGroupByExternalId(externalId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(groups).where(eq(groups.externalId, externalId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function fixGroupsShareCodes(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ id: groups.id }).from(groups).where(isNull(groups.shareCode));
  for (const row of rows) {
    const code = (Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 6))
      .toUpperCase()
      .substring(0, 10);
    await db.update(groups).set({ shareCode: code }).where(eq(groups.id, row.id));
  }
  return rows.length;
}

export async function getGroupByShareCode(shareCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(groups).where(eq(groups.shareCode, shareCode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserGroups(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const memberships = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, userId));
  if (memberships.length === 0) return [];
  const groupIds = memberships.map((m) => m.groupId);
  return db.select().from(groups).where(inArray(groups.id, groupIds));
}

export async function deleteGroup(groupId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await tx.delete(shoppingItems).where(eq(shoppingItems.groupId, groupId));
    await tx.delete(expenses).where(eq(expenses.groupId, groupId));
    await tx.delete(tasks).where(eq(tasks.groupId, groupId));
    await tx.delete(polls).where(eq(polls.groupId, groupId));
    await tx.delete(carpoolRides).where(eq(carpoolRides.groupId, groupId));
    await tx.delete(photos).where(eq(photos.groupId, groupId));
    await tx.delete(chatMessages).where(eq(chatMessages.groupId, groupId));
    await tx.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
    await tx.delete(groups).where(eq(groups.id, groupId));
  });
}

export async function leaveGroup(groupId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
}

// ===== GROUP MEMBERS =====

export async function getGroupsMembersBatch(groupIds: number[]) {
  if (groupIds.length === 0) return new Map<number, any[]>();
  const db = await getDb();
  if (!db) return new Map<number, any[]>();
  const allMembers = await db.select().from(groupMembers).where(inArray(groupMembers.groupId, groupIds));
  if (allMembers.length === 0) return new Map<number, any[]>();
  const userIds = [...new Set(allMembers.map((m) => m.userId))];
  const userList = await db.select().from(users).where(inArray(users.id, userIds));
  const userMap = new Map(userList.map((u) => [u.id, u]));
  const result = new Map<number, any[]>();
  for (const m of allMembers) {
    const user = userMap.get(m.userId);
    if (!user) continue;
    const entry = { ...m, name: user.name, username: user.username, avatar: user.avatar };
    if (!result.has(m.groupId)) result.set(m.groupId, []);
    result.get(m.groupId)!.push(entry);
  }
  return result;
}

export async function getGroupMember(groupId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function addGroupMember(data: InsertGroupMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(groupMembers).values(data);
}

export async function getGroupMembers(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  const members = await db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
  if (members.length === 0) return [];
  const userIds = members.map((m) => m.userId);
  const userList = await db.select().from(users).where(inArray(users.id, userIds));
  const userMap = new Map(userList.map((u) => [u.id, u]));
  return members
    .map((m) => {
      const user = userMap.get(m.userId);
      if (!user) return null;
      return { ...m, name: user.name, username: user.username, avatar: user.avatar };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
}

export async function updateMemberRsvp(groupId: number, userId: number, rsvp: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(groupMembers)
    .set({ rsvp: rsvp as any })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
}

// ===== CHAT MESSAGES =====

export async function addChatMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(chatMessages).values(data);
}

export async function getGroupMessages(groupId: number, limit = 50, cursor?: number) {
  const db = await getDb();
  if (!db) return { messages: [], nextCursor: null };
  const condition = cursor
    ? and(eq(chatMessages.groupId, groupId), lt(chatMessages.id, cursor))
    : eq(chatMessages.groupId, groupId);
  const msgs = await db.select().from(chatMessages)
    .where(condition)
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit + 1);
  const hasMore = msgs.length > limit;
  const sliced = hasMore ? msgs.slice(0, limit) : msgs;
  if (sliced.length === 0) return { messages: [], nextCursor: null };
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;
  const senderIds = [...new Set(sliced.map((m) => m.senderId).filter((id): id is number => id !== null))];
  const senderList = senderIds.length > 0 ? await db.select().from(users).where(inArray(users.id, senderIds)) : [];
  const senderMap = new Map(senderList.map((u) => [u.id, u]));
  const messages = sliced.reverse().map((msg) => {
    const sender = msg.senderId != null ? senderMap.get(msg.senderId) : undefined;
    return {
      ...msg,
      senderName: sender?.name || "Inconnu",
      senderAvatar: sender?.avatar || "",
      reactions: parseJsonColumn<Reaction[]>(msg.reactions, [], reactionsSchema),
    };
  });
  return { messages, nextCursor };
}

export async function getChatMessageById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(chatMessages).where(eq(chatMessages.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function pinMessage(messageId: number, pinned: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(chatMessages).set({ isPinned: pinned }).where(eq(chatMessages.id, messageId));
}

// ===== PUSH TOKENS =====

export async function savePushToken(data: InsertPushToken) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Upsert: delete old token for this user, insert new
  await db.delete(pushTokens).where(eq(pushTokens.userId, data.userId));
  await db.insert(pushTokens).values(data);
}

export async function getPushTokensForGroup(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  const members = await db.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
  if (members.length === 0) return [];
  const memberIds = members.map((m) => m.userId);
  return db.select().from(pushTokens).where(inArray(pushTokens.userId, memberIds));
}

export async function getUserPushTokens(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
}

export async function deletePushTokenByToken(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushTokens).where(eq(pushTokens.token, token));
}

// ===== SHOPPING ITEMS =====

export async function addShoppingItem(data: InsertShoppingItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(shoppingItems).values(data);
}

export async function getGroupShoppingItems(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shoppingItems).where(eq(shoppingItems.groupId, groupId));
}

export async function updateShoppingItem(id: number, data: Partial<InsertShoppingItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(shoppingItems).set(data).where(eq(shoppingItems.id, id));
}

export async function getShoppingItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shoppingItems).where(eq(shoppingItems.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteShoppingItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(shoppingItems).where(eq(shoppingItems.id, id));
}

// ===== EXPENSES =====

export async function addExpense(data: InsertExpense) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(expenses).values(data);
}

export async function getGroupExpenses(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenses).where(eq(expenses.groupId, groupId));
}

export async function getExpenseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteExpense(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(expenses).where(eq(expenses.id, id));
}

// ===== TASKS =====

export async function addTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(tasks).values(data);
}

export async function getGroupTasks(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.groupId, groupId));
}

export async function updateTask(id: number, data: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}

export async function getTaskById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteTask(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tasks).where(eq(tasks.id, id));
}

/**
 * Atomically claims a task for a user — first come, first served.
 * Returns true if the claim succeeded, false if the task was already assigned.
 */
export async function atomicClaimTask(id: number, userId: string, userName: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(tasks)
    .set({ assignedTo: userId, assignedToName: userName })
    .where(and(eq(tasks.id, id), or(isNull(tasks.assignedTo), eq(tasks.assignedTo, ""))));
  return (result[0] as any).affectedRows > 0;
}

// ===== POLLS =====

export async function addPoll(data: InsertPoll) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(polls).values(data);
}

export async function getGroupPolls(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(polls).where(eq(polls.groupId, groupId));
}

export async function getPollById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(polls).where(eq(polls.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updatePollOptions(id: number, options: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(polls).set({ options }).where(eq(polls.id, id));
}

export async function deletePoll(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(polls).where(eq(polls.id, id));
}

// ===== CARPOOL RIDES =====

export async function addCarpoolRide(data: InsertCarpoolRide) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(carpoolRides).values(data);
}

export async function getGroupCarpoolRides(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(carpoolRides).where(eq(carpoolRides.groupId, groupId));
}

export async function joinCarpoolRide(
  externalId: string,
  userId: number,
  passenger: { id: string; name: string; avatar: string }
): Promise<{ success: true } | { success: false; reason: "not_found" | "not_member" | "already_in" | "full" }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (tx) => {
    // Verrouille la ligne pour éviter les réservations concurrentes
    const rows = await tx
      .select()
      .from(carpoolRides)
      .where(eq(carpoolRides.externalId, externalId))
      .for("update")
      .limit(1);

    if (rows.length === 0) return { success: false, reason: "not_found" as const };
    const ride = rows[0];

    // Vérifie que l'utilisateur est membre du groupe
    const memberRows = await tx
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, ride.groupId), eq(groupMembers.userId, userId)))
      .limit(1);
    if (memberRows.length === 0) return { success: false, reason: "not_member" as const };

    const passengers = parseJsonColumn<Passenger[]>(ride.passengers, [], passengersSchema);

    if (passengers.some((p) => p.id === passenger.id)) {
      return { success: false, reason: "already_in" as const };
    }

    if ((ride.availableSeats ?? 0) <= 0) {
      return { success: false, reason: "full" as const };
    }

    // Mise à jour atomique : passagers + places disponibles dans le même UPDATE
    await tx
      .update(carpoolRides)
      .set({
        passengers: serializeJsonColumn<Passenger[]>([...passengers, passenger]),
        availableSeats: (ride.availableSeats ?? 0) - 1,
      })
      .where(eq(carpoolRides.externalId, externalId));

    return { success: true as const };
  });
}

export async function leaveCarpoolRide(externalId: string, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(carpoolRides)
      .where(eq(carpoolRides.externalId, externalId))
      .for("update")
      .limit(1);

    if (rows.length === 0) return;
    const ride = rows[0];

    const passengerId = String(userId);
    const passengers = parseJsonColumn<Passenger[]>(ride.passengers, [], passengersSchema);

    if (!passengers.some((p) => p.id === passengerId)) return;

    const updatedPassengers = passengers.filter((p) => p.id !== passengerId);

    await tx
      .update(carpoolRides)
      .set({
        passengers: serializeJsonColumn<Passenger[]>(updatedPassengers),
        availableSeats: Math.min((ride.availableSeats ?? 0) + 1, ride.totalSeats ?? 4),
      })
      .where(eq(carpoolRides.externalId, externalId));
  });
}

export async function updateCarpoolRide(id: number, data: Partial<InsertCarpoolRide>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(carpoolRides).set(data).where(eq(carpoolRides.id, id));
}

export async function getCarpoolRideById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(carpoolRides).where(eq(carpoolRides.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCarpoolRideByExternalId(externalId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(carpoolRides).where(eq(carpoolRides.externalId, externalId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteCarpoolRide(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(carpoolRides).where(eq(carpoolRides.id, id));
}

// ===== PHOTOS =====

export async function addPhoto(data: InsertPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(photos).values(data);
}

export async function getGroupPhotos(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(photos).where(eq(photos.groupId, groupId));
}

export async function getPhotoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deletePhoto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(photos).where(eq(photos.id, id));
}

// ===== FRIENDSHIPS =====

export async function addFriendship(data: InsertFriendship) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(friendships).values(data);
}

export async function getUserFriends(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(friendships)
    .where(
      and(
        or(eq(friendships.userId, userId), eq(friendships.friendId, userId)),
        eq(friendships.status, "accepted"),
      )
    );
  if (rows.length === 0) return [];
  const otherIds = rows.map((f) => f.userId === userId ? f.friendId : f.userId);
  return db.select().from(users).where(inArray(users.id, otherIds));
}

export async function deleteFriendship(userId: number, friendId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(friendships)
    .where(
      or(
        and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)),
        and(eq(friendships.userId, friendId), eq(friendships.friendId, userId)),
      )
    );
}
