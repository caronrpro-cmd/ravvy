import { relations } from "drizzle-orm";
import {
  users,
  authCredentials,
  groups,
  groupMembers,
  chatMessages,
  shoppingItems,
  expenses,
  tasks,
  polls,
  carpoolRides,
  photos,
  pushTokens,
  friendships,
} from "./schema";

// ===== USERS =====

export const usersRelations = relations(users, ({ one, many }) => ({
  // Credentials locaux (1-to-1)
  authCredential: one(authCredentials, {
    fields: [users.id],
    references: [authCredentials.userId],
  }),
  // Appartenance aux groupes
  groupMembers: many(groupMembers),
  // Messages envoyés
  chatMessages: many(chatMessages),
  // Tokens push
  pushTokens: many(pushTokens),
  // Amitiés initiées par cet utilisateur
  sentFriendships: many(friendships, { relationName: "sentFriendships" }),
  // Amitiés reçues par cet utilisateur
  receivedFriendships: many(friendships, { relationName: "receivedFriendships" }),
}));

// ===== AUTH CREDENTIALS =====

export const authCredentialsRelations = relations(authCredentials, ({ one }) => ({
  user: one(users, {
    fields: [authCredentials.userId],
    references: [users.id],
  }),
}));

// ===== GROUPS =====

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  chatMessages: many(chatMessages),
  shoppingItems: many(shoppingItems),
  expenses: many(expenses),
  tasks: many(tasks),
  polls: many(polls),
  carpoolRides: many(carpoolRides),
  photos: many(photos),
}));

// ===== GROUP MEMBERS =====

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

// ===== CHAT MESSAGES =====

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  group: one(groups, {
    fields: [chatMessages.groupId],
    references: [groups.id],
  }),
  // senderId peut être null si l'utilisateur a été supprimé (ON DELETE SET NULL)
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

// ===== SHOPPING ITEMS =====

export const shoppingItemsRelations = relations(shoppingItems, ({ one }) => ({
  group: one(groups, {
    fields: [shoppingItems.groupId],
    references: [groups.id],
  }),
}));

// ===== EXPENSES =====

export const expensesRelations = relations(expenses, ({ one }) => ({
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
}));

// ===== TASKS =====

export const tasksRelations = relations(tasks, ({ one }) => ({
  group: one(groups, {
    fields: [tasks.groupId],
    references: [groups.id],
  }),
}));

// ===== POLLS =====

export const pollsRelations = relations(polls, ({ one }) => ({
  group: one(groups, {
    fields: [polls.groupId],
    references: [groups.id],
  }),
}));

// ===== CARPOOL RIDES =====

export const carpoolRidesRelations = relations(carpoolRides, ({ one }) => ({
  group: one(groups, {
    fields: [carpoolRides.groupId],
    references: [groups.id],
  }),
}));

// ===== PHOTOS =====

export const photosRelations = relations(photos, ({ one }) => ({
  group: one(groups, {
    fields: [photos.groupId],
    references: [groups.id],
  }),
}));

// ===== PUSH TOKENS =====

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, {
    fields: [pushTokens.userId],
    references: [users.id],
  }),
}));

// ===== FRIENDSHIPS =====

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  // L'utilisateur qui a envoyé la demande
  user: one(users, {
    fields: [friendships.userId],
    references: [users.id],
    relationName: "sentFriendships",
  }),
  // L'utilisateur qui a reçu la demande
  friend: one(users, {
    fields: [friendships.friendId],
    references: [users.id],
    relationName: "receivedFriendships",
  }),
}));
