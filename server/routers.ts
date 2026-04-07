import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { broadcastChatMessage, broadcastLocationUpdate, broadcastRefresh, broadcastRefreshWithPayload, storeLocation, getGroupLocations } from "./_core/sse";
import {
  parseJsonColumn, serializeJsonColumn,
  PollOption, pollOptionsSchema,
  Passenger, passengersSchema,
  validateJsonString,
} from "./utils/json-columns";
import * as push from "./services/push";

// ===== SOS RATE LIMIT (in-memory, per userId+groupId) =====
// Prevents the same user from sending more than one SOS per group within 5 minutes.
const sosLastSent = new Map<string, number>();
const SOS_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// ===== AUTH HELPERS =====

async function requireMember(groupId: number, userId: number) {
  const member = await db.getGroupMember(groupId, userId);
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous n'êtes pas membre de ce groupe",
    });
  }
  return member;
}

async function requireGroupAdmin(groupId: number, userId: number) {
  const member = await requireMember(groupId, userId);
  if (member.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Action réservée aux administrateurs du groupe",
    });
  }
  return member;
}

// ===== ROUTER =====

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // User profile
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const fullUser = await db.getUserById(ctx.user.id);
      if (!fullUser) throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" });
      return {
        id: fullUser.id,
        openId: fullUser.openId,
        name: fullUser.name,
        email: fullUser.email,
        loginMethod: fullUser.loginMethod,
        username: fullUser.username,
        bio: fullUser.bio,
        avatar: fullUser.avatar,
        status: fullUser.status ?? "available",
        createdAt: fullUser.createdAt.toISOString(),
      };
    }),
    update: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100).optional(),
        username: z.string().min(1).max(64).optional(),
        bio: z.string().max(500).optional(),
        avatar: z.string().optional(),
        status: z.enum(["available", "busy", "away", "dnd"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
    requestDeletion: protectedProcedure.mutation(async ({ ctx }) => {
      await db.requestAccountDeletion(ctx.user.id);
      return { success: true };
    }),
    cancelDeletion: protectedProcedure.mutation(async ({ ctx }) => {
      await db.cancelAccountDeletion(ctx.user.id);
      return { success: true };
    }),
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteUserAccount(ctx.user.id);
      return { success: true };
    }),
  }),

  // Groups
  groups: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userGroups = await db.getUserGroups(ctx.user.id);
      if (userGroups.length === 0) return [];
      const groupIds = userGroups.map((g) => g.id);
      const membersMap = await db.getGroupsMembersBatch(groupIds);
      return userGroups.map((g) => ({
        ...g,
        members: membersMap.get(g.id) ?? [],
      }));
    }),
    create: protectedProcedure
      .input(z.object({
        externalId: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        type: z.enum(["classic", "auto-destruct"]).default("classic"),
        coverImage: z.string().optional(),
        date: z.string().optional(),
        time: z.string().optional(),
        location: z.string().optional(),
        shareCode: z.string().max(16).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const groupId = await db.createGroup({
          ...input,
          description: input.description ?? null,
          coverImage: input.coverImage ?? null,
          date: input.date ?? null,
          time: input.time ?? null,
          location: input.location ?? null,
          shareCode: input.shareCode ?? null,
          createdBy: ctx.user.id,
        });
        // Add creator as admin member
        await db.addGroupMember({
          groupId,
          userId: ctx.user.id,
          role: "admin",
          rsvp: "present",
        });
        return { id: groupId, externalId: input.externalId };
      }),
    joinByCode: protectedProcedure
      .input(z.object({ shareCode: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const group = await db.getGroupByShareCode(input.shareCode.toUpperCase());
        if (!group) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Code d'invitation invalide ou expiré" });
        }
        const existingMember = await db.getGroupMember(group.id, ctx.user.id);
        if (existingMember) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Vous êtes déjà membre de ce groupe" });
        }
        await db.addGroupMember({
          groupId: group.id,
          userId: ctx.user.id,
          role: "member",
          rsvp: "pending",
        });
        // Notify existing members that someone joined
        push.sendToGroup(
          group.id,
          {
            title: "Nouveau membre",
            body: `${ctx.user.name || "Quelqu'un"} a rejoint "${group.name}"`,
            data: { type: "friend", groupId: String(group.id) },
          },
          ctx.user.id
        ).catch(() => {});
        const members = await db.getGroupMembers(group.id);
        return { ...group, members };
      }),
    get: protectedProcedure
      .input(z.object({ externalId: z.string() }))
      .query(async ({ ctx, input }) => {
        const group = await db.getGroupByExternalId(input.externalId);
        if (!group) return null;
        await requireMember(group.id, ctx.user.id);
        return group;
      }),
    members: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        return db.getGroupMembers(input.groupId);
      }),
    updateRsvp: protectedProcedure
      .input(z.object({
        groupId: z.number(),
        rsvp: z.enum(["present", "absent", "maybe", "pending"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        await db.updateMemberRsvp(input.groupId, ctx.user.id, input.rsvp);
        if (input.rsvp === "present" || input.rsvp === "absent") {
          const rsvpLabel = input.rsvp === "present" ? "sera présent(e)" : "ne viendra pas";
          push.sendToGroup(
            input.groupId,
            {
              title: "Mise à jour RSVP",
              body: `${ctx.user.name || "Un membre"} ${rsvpLabel}`,
              data: { type: "rsvp", groupId: String(input.groupId) },
            },
            ctx.user.id
          ).catch(() => {});
        }
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireGroupAdmin(input.groupId, ctx.user.id);
        // Broadcast avant suppression pour que les clients connectés reçoivent l'événement
        broadcastRefresh(input.groupId, "group_deleted");
        // Délai pour laisser le temps aux clients de recevoir le broadcast avant la suppression
        await new Promise((resolve) => setTimeout(resolve, 500));
        // Push-notify all other members before deleting
        push.sendToGroup(
          input.groupId,
          {
            title: "Soirée annulée",
            body: `${ctx.user.name || "L'organisateur"} a annulé la soirée`,
            data: { type: "group_cancelled", groupId: String(input.groupId) },
            priority: "high",
          },
          ctx.user.id
        );
        await db.deleteGroup(input.groupId);
        return { success: true };
      }),
    leave: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        await db.leaveGroup(input.groupId, ctx.user.id);
        broadcastRefresh(input.groupId, "members");
        return { success: true };
      }),
    updateCover: protectedProcedure
      .input(z.object({ groupId: z.number(), coverImage: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await requireGroupAdmin(input.groupId, ctx.user.id);
        await db.updateGroupCover(input.groupId, input.coverImage);
        broadcastRefresh(input.groupId, "group_updated");
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        groupId: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        date: z.string().optional(),
        time: z.string().optional(),
        location: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireGroupAdmin(input.groupId, ctx.user.id);
        const { groupId, ...data } = input;
        await db.updateGroup(groupId, data);
        broadcastRefresh(groupId, "group_updated");
        return { success: true };
      }),
    fixShareCodes: adminProcedure
      .mutation(async () => {
        const updated = await db.fixGroupsShareCodes();
        return { updated };
      }),
  }),

  // Chat
  chat: router({
    messages: protectedProcedure
      .input(z.object({
        groupId: z.number(),
        limit: z.number().default(50),
        cursor: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        return db.getGroupMessages(input.groupId, input.limit, input.cursor);
      }),
    send: protectedProcedure
      .input(z.object({
        externalId: z.string(),
        groupId: z.number(),
        text: z.string().max(2000).optional(),
        type: z.enum(["text", "image", "location"]).default("text"),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        await db.addChatMessage({
          externalId: input.externalId,
          groupId: input.groupId,
          senderId: ctx.user.id,
          text: input.text ?? null,
          type: input.type,
          imageUrl: input.imageUrl ?? null,
        });
        // Diffuse le message à tous les clients SSE connectés au groupe
        broadcastChatMessage(input.groupId, {
          externalId: input.externalId,
          groupId: input.groupId,
          senderId: ctx.user.id,
          senderName: ctx.user.name || "Inconnu",
          senderAvatar: ctx.user.avatar || "",
          text: input.text ?? null,
          type: input.type,
          imageUrl: input.imageUrl ?? null,
          isPinned: false,
          reactions: [],
          createdAt: new Date().toISOString(),
        });
        broadcastRefresh(input.groupId, "chat");
        // Push notification aux autres membres du groupe (async, non-bloquant)
        db.getGroupById(input.groupId).then((group) => {
          push.sendToGroup(
            input.groupId,
            {
              title: group?.name || ctx.user.name || "Nouveau message",
              body: `${ctx.user.name || "Quelqu'un"} : ${(input.text ?? "📷 Photo").substring(0, 100)}`,
              data: { type: "chat", groupId: String(input.groupId), externalGroupId: group?.externalId ?? "" },
            },
            ctx.user.id
          ).catch(() => {});
        }).catch(() => {});
        return { success: true };
      }),
    pin: protectedProcedure
      .input(z.object({ messageId: z.number(), pinned: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const message = await db.getChatMessageById(input.messageId);
        if (!message) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Message introuvable" });
        }
        await requireGroupAdmin(message.groupId, ctx.user.id);
        await db.pinMessage(input.messageId, input.pinned);
        return { success: true };
      }),
    markAsRead: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        await db.markGroupChatRead(input.groupId, ctx.user.id);
        return { success: true };
      }),
    unreadCount: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        const count = await db.getUnreadChatCount(input.groupId, ctx.user.id);
        return { count };
      }),
  }),

  // Shopping items
  shopping: router({
    list: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        return db.getGroupShoppingItems(input.groupId);
      }),
    add: protectedProcedure
      .input(z.object({
        externalId: z.string(),
        groupId: z.number(),
        name: z.string().min(1).max(200),
        quantity: z.number().optional(),
        price: z.string()
          .regex(/^\d+(\.\d{1,2})?$/, "Prix invalide (ex: 9.99)")
          .refine((v) => parseFloat(v) >= 0, { message: "Le prix ne peut pas être négatif" })
          .optional(),
        assignedTo: z.string().optional(),
        assignedToName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        await db.addShoppingItem({
          ...input,
          checked: false,
          addedBy: ctx.user.id,
        });
        broadcastRefresh(input.groupId, "shopping");
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), checked: z.boolean().optional(), assignedTo: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const item = await db.getShoppingItemById(input.id);
        if (!item) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Article introuvable" });
        }
        await requireMember(item.groupId, ctx.user.id);
        await db.updateShoppingItem(input.id, { checked: input.checked, assignedTo: input.assignedTo });
        broadcastRefresh(item.groupId, "shopping");
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const item = await db.getShoppingItemById(input.id);
        if (!item) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Article introuvable" });
        }
        const member = await requireMember(item.groupId, ctx.user.id);
        if (item.addedBy !== ctx.user.id && member.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Seul le créateur ou un administrateur peut supprimer cet article",
          });
        }
        await db.deleteShoppingItem(input.id);
        broadcastRefresh(item.groupId, "shopping");
        return { success: true };
      }),
  }),

  // Expenses
  expenses: router({
    list: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        return db.getGroupExpenses(input.groupId);
      }),
    add: protectedProcedure
      .input(z.object({
        externalId: z.string(),
        groupId: z.number(),
        description: z.string().min(1).max(200),
        amount: z.string()
          .regex(/^\d+(\.\d{1,2})?$/, "Montant invalide (ex: 12.50)")
          .refine((v) => parseFloat(v) > 0, { message: "Le montant doit être supérieur à 0" })
          .refine((v) => parseFloat(v) <= 99999.99, { message: "Montant trop élevé (max 99 999,99 €)" }),
        paidBy: z.string(),
        paidByName: z.string().optional(),
        splitBetween: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        await db.addExpense(input);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const expense = await db.getExpenseById(input.id);
        if (!expense) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Dépense introuvable" });
        }
        await requireMember(expense.groupId, ctx.user.id);
        await db.deleteExpense(input.id);
        return { success: true };
      }),
  }),

  // Tasks
  tasks: router({
    list: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        return db.getGroupTasks(input.groupId);
      }),
    add: protectedProcedure
      .input(z.object({
        externalId: z.string(),
        groupId: z.number(),
        title: z.string().min(1).max(200),
        assignedTo: z.string().optional(),
        assignedToName: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        await db.addTask({
          ...input,
          priority: input.priority ?? "medium",
          completed: false,
          createdBy: ctx.user.id,
        });
        broadcastRefresh(input.groupId, "tasks");
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        completed: z.boolean().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.id);
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Tâche introuvable" });
        }
        await requireMember(task.groupId, ctx.user.id);
        await db.updateTask(input.id, { completed: input.completed, priority: input.priority });
        broadcastRefresh(task.groupId, "tasks");
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.id);
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Tâche introuvable" });
        }
        const member = await requireMember(task.groupId, ctx.user.id);
        if (task.createdBy !== ctx.user.id && member.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Seul le créateur ou un administrateur peut supprimer cette tâche",
          });
        }
        await db.deleteTask(input.id);
        broadcastRefresh(task.groupId, "tasks");
        return { success: true };
      }),
    // Atomic claim: first-come, first-served assignment
    claim: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Tâche introuvable" });
        await requireMember(task.groupId, ctx.user.id);
        const claimed = await db.atomicClaimTask(input.id, String(ctx.user.id), ctx.user.name || "Inconnu");
        if (!claimed) throw new TRPCError({ code: "CONFLICT", message: "Cette tâche a déjà été prise" });
        broadcastRefresh(task.groupId, "tasks");
        push.sendToGroup(
          task.groupId,
          {
            title: "Tâche prise en charge",
            body: `${ctx.user.name || "Un membre"} s'occupe de "${task.title}"`,
            data: { type: "task", groupId: String(task.groupId) },
          },
          ctx.user.id
        ).catch(() => {});
        return { success: true };
      }),
  }),

  // Polls
  polls: router({
    list: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        return db.getGroupPolls(input.groupId);
      }),
    add: protectedProcedure
      .input(z.object({
        externalId: z.string(),
        groupId: z.number(),
        question: z.string().min(1).max(500),
        // JSON stringifié d'un tableau PollOption[] — validé structurellement
        options: z.string()
          .superRefine(validateJsonString(pollOptionsSchema, "options"))
          .refine(
            (v) => { try { return JSON.parse(v).length >= 2; } catch { return false; } },
            { message: "Le sondage doit comporter au moins 2 options" }
          )
          .optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        await db.addPoll({ ...input, createdBy: ctx.user.id });
        broadcastRefresh(input.groupId, "polls");
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const poll = await db.getPollById(input.id);
        if (!poll) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sondage introuvable" });
        }
        const member = await requireMember(poll.groupId, ctx.user.id);
        if (poll.createdBy !== ctx.user.id && member.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Seul le créateur ou un administrateur peut supprimer ce sondage",
          });
        }
        await db.deletePoll(input.id);
        broadcastRefresh(poll.groupId, "polls");
        return { success: true };
      }),
    vote: protectedProcedure
      .input(z.object({ pollId: z.number(), optionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const poll = await db.getPollById(input.pollId);
        if (!poll) throw new TRPCError({ code: "NOT_FOUND", message: "Sondage introuvable" });
        await requireMember(poll.groupId, ctx.user.id);
        const options = parseJsonColumn<PollOption[]>(poll.options, [], pollOptionsSchema);
        const userId = String(ctx.user.id);
        const updated = options.map((opt) =>
          opt.id === input.optionId
            ? { ...opt, votes: opt.votes.includes(userId) ? opt.votes.filter((v) => v !== userId) : [...opt.votes, userId] }
            : opt
        );
        await db.updatePollOptions(input.pollId, serializeJsonColumn(updated));
        broadcastRefresh(poll.groupId, "polls");
        return { success: true };
      }),
    clearVotes: protectedProcedure
      .input(z.object({ pollId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const poll = await db.getPollById(input.pollId);
        if (!poll) throw new TRPCError({ code: "NOT_FOUND", message: "Sondage introuvable" });
        await requireMember(poll.groupId, ctx.user.id);
        const options = parseJsonColumn<PollOption[]>(poll.options, [], pollOptionsSchema);
        const userId = String(ctx.user.id);
        const updated = options.map((opt) => ({ ...opt, votes: opt.votes.filter((v) => v !== userId) }));
        await db.updatePollOptions(input.pollId, serializeJsonColumn(updated));
        broadcastRefresh(poll.groupId, "polls");
        return { success: true };
      }),
  }),

  // Carpool
  carpool: router({
    list: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        return db.getGroupCarpoolRides(input.groupId);
      }),
    add: protectedProcedure
      .input(z.object({
        externalId: z.string(),
        groupId: z.number(),
        driverName: z.string(),
        driverId: z.string(),
        departure: z.string().optional(),
        departureTime: z.string().optional(),
        totalSeats: z.number().min(2).max(9).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        await db.addCarpoolRide({
          ...input,
          availableSeats: (input.totalSeats ?? 4) - 1,
          passengers: serializeJsonColumn<Passenger[]>([]),
        });
        broadcastRefresh(input.groupId, "carpool");
        return { success: true };
      }),
    join: protectedProcedure
      .input(z.object({
        externalId: z.string(),
        passengerName: z.string(),
        passengerAvatar: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.joinCarpoolRide(
          input.externalId,
          ctx.user.id,
          { id: String(ctx.user.id), name: input.passengerName, avatar: input.passengerAvatar ?? "" }
        );
        if (!result.success) {
          const messages: Record<string, string> = {
            full: "Plus de places disponibles dans cette voiture",
            already_in: "Vous êtes déjà passager de ce trajet",
            not_member: "Vous n'êtes pas membre de ce groupe",
            not_found: "Trajet introuvable",
          };
          throw new TRPCError({
            code: result.reason === "full" ? "CONFLICT"
              : result.reason === "not_member" ? "FORBIDDEN"
              : "BAD_REQUEST",
            message: messages[result.reason],
          });
        }
        const ride = await db.getCarpoolRideByExternalId(input.externalId);
        if (ride) broadcastRefresh(ride.groupId, "carpool");
        return { success: true };
      }),
    leave: protectedProcedure
      .input(z.object({ externalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const ride = await db.getCarpoolRideByExternalId(input.externalId);
        await db.leaveCarpoolRide(input.externalId, ctx.user.id);
        if (ride) broadcastRefresh(ride.groupId, "carpool");
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), passengers: z.string().optional(), availableSeats: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const ride = await db.getCarpoolRideById(input.id);
        if (!ride) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Trajet introuvable" });
        }
        await requireMember(ride.groupId, ctx.user.id);
        await db.updateCarpoolRide(input.id, { passengers: input.passengers, availableSeats: input.availableSeats });
        broadcastRefresh(ride.groupId, "carpool");
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ride = await db.getCarpoolRideById(input.id);
        if (!ride) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Trajet introuvable" });
        }
        await requireMember(ride.groupId, ctx.user.id);
        await db.deleteCarpoolRide(input.id);
        broadcastRefresh(ride.groupId, "carpool");
        return { success: true };
      }),
  }),

  // Photos
  photos: router({
    list: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        return db.getGroupPhotos(input.groupId);
      }),
    add: protectedProcedure
      .input(z.object({
        externalId: z.string(),
        groupId: z.number(),
        uri: z.string(),
        uploadedBy: z.string().optional(),
        uploadedByName: z.string().optional(),
        caption: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        await db.addPhoto({ ...input, likes: 0 });
        broadcastRefresh(input.groupId, "photos");
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const photo = await db.getPhotoById(input.id);
        if (!photo) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Photo introuvable" });
        }
        await requireMember(photo.groupId, ctx.user.id);
        await db.deletePhoto(input.id);
        return { success: true };
      }),
  }),

  // Location
  location: router({
    update: protectedProcedure
      .input(z.object({
        groupId: z.number(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        const entry = {
          userId: String(ctx.user.id),
          name: ctx.user.name || "Inconnu",
          lat: input.lat,
          lng: input.lng,
          updatedAt: new Date().toISOString(),
        };
        storeLocation(input.groupId, entry);
        broadcastLocationUpdate(input.groupId, entry);
        return { success: true };
      }),
    list: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireMember(input.groupId, ctx.user.id);
        return getGroupLocations(input.groupId);
      }),
  }),

  // Notifications
  notifications: router({
    sos: protectedProcedure
      .input(z.object({
        groupId: z.number(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        console.log("🆘 SOS reçu de userId:", ctx.user.id, "pour groupId:", input.groupId, "lat:", input.lat, "lng:", input.lng);
        await requireMember(input.groupId, ctx.user.id);

        // Server-side rate limit: 1 SOS per user per group per 5 minutes
        const sosKey = `${ctx.user.id}_${input.groupId}`;
        const lastSent = sosLastSent.get(sosKey);
        if (lastSent && Date.now() - lastSent < SOS_COOLDOWN_MS) {
          const waitSec = Math.ceil((SOS_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
          console.log(`🆘 SOS bloqué (rate limit) pour userId:${ctx.user.id} — attendre ${waitSec}s`);
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Veuillez patienter ${waitSec} secondes avant d'envoyer une nouvelle alerte`,
          });
        }
        sosLastSent.set(sosKey, Date.now());

        const senderName = ctx.user.name || "Quelqu'un";
        const locationInfo = input.lat && input.lng
          ? ` (${input.lat.toFixed(4)}, ${input.lng.toFixed(4)})`
          : "";

        // Insère un message SOS épinglé dans le chat pour que tous les membres le voient
        const sosExternalId = `sos-${Date.now()}-${input.groupId}`;
        const sosText = `🆘 ${senderName} a déclenché une alerte SOS !${locationInfo}`;
        try {
          await db.addChatMessage({
            externalId: sosExternalId,
            groupId: input.groupId,
            senderId: ctx.user.id,
            text: sosText,
            type: "text",
            isPinned: true,
            reactions: "[]",
          });
        } catch (e) {
          console.warn("🆘 SOS: impossible d'insérer le message chat:", e);
        }

        // Broadcast le message SOS via SSE chat (temps réel)
        broadcastChatMessage(input.groupId, {
          externalId: sosExternalId,
          groupId: input.groupId,
          senderId: ctx.user.id,
          senderName,
          senderAvatar: "",
          text: sosText,
          type: "text",
          isPinned: true,
          reactions: [],
          createdAt: new Date().toISOString(),
        });

        // Push notification — wrappé pour ne pas bloquer broadcastRefresh si push échoue
        try {
          const group = await db.getGroupById(input.groupId);
          await push.sendToGroup(input.groupId, {
            title: `🆘 ${senderName} a besoin d'aide !`,
            body: `Alerte SOS déclenchée${locationInfo}`,
            data: { type: "sos", groupId: String(input.groupId), externalGroupId: group?.externalId ?? "", senderId: String(ctx.user.id) },
            priority: "high",
          });
        } catch (e) {
          console.warn("🆘 SOS: push.sendToGroup échoué (non bloquant):", e);
        }

        broadcastRefresh(input.groupId, "chat");
        broadcastRefreshWithPayload(input.groupId, {
          type: "refresh",
          module: "sos",
          senderName: senderName,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
        });
        console.log("🆘 SOS broadcast envoyé pour groupId:", input.groupId);
        return { success: true };
      }),
  }),

  // Friends / user search
  friends: router({
    search: protectedProcedure
      .input(z.object({ query: z.string().min(1).max(64) }))
      .query(async ({ ctx, input }) => {
        const results = await db.searchUsers(input.query, ctx.user.id);
        return results.map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username ?? "",
          avatar: u.avatar ?? "",
          status: (u.status as string) ?? "available",
        }));
      }),
  }),

  // Push tokens
  push: router({
    register: protectedProcedure
      .input(z.object({
        token: z.string(),
        platform: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.savePushToken({
          userId: ctx.user.id,
          token: input.token,
          platform: input.platform ?? null,
        });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
