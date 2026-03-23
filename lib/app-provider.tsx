import React, { createContext, useContext, useEffect, useReducer, useCallback } from "react";
import { Platform } from "react-native";
import {
  AppState,
  defaultState,
  UserProfile,
  Friend,
  Group,
  GroupMember,
  ShoppingItem,
  Expense,
  CarpoolRide,
  ChatMessage,
  PhotoItem,
  TaskItem,
  Notification,
  Poll,
  PollOption,
} from "./types";
import { loadState, saveState } from "./storage";
import { generateId, generateInvitationCode } from "./helpers";
import * as Auth from "./_core/auth";

// ===== ACTIONS =====
type Action =
  | { type: "LOAD_STATE"; payload: AppState }
  | { type: "SET_PROFILE"; payload: UserProfile }
  | { type: "UPDATE_PROFILE"; payload: Partial<UserProfile> }
  | { type: "COMPLETE_ONBOARDING" }
  | { type: "SET_DARK_MODE"; payload: boolean | null }
  // Friends
  | { type: "ADD_FRIEND"; payload: Friend }
  | { type: "REMOVE_FRIEND"; payload: string }
  | { type: "ADD_FRIEND_REQUEST"; payload: Friend }
  | { type: "ACCEPT_FRIEND_REQUEST"; payload: string }
  | { type: "REJECT_FRIEND_REQUEST"; payload: string }
  // Groups
  | { type: "ADD_GROUP"; payload: Group }
  | { type: "UPDATE_GROUP"; payload: { id: string; updates: Partial<Group> } }
  | { type: "DELETE_GROUP"; payload: string }
  | { type: "UPDATE_RSVP"; payload: { groupId: string; memberId: string; rsvp: GroupMember["rsvp"] } }
  // Shopping
  | { type: "ADD_SHOPPING_ITEM"; payload: ShoppingItem }
  | { type: "UPDATE_SHOPPING_ITEM"; payload: { id: string; updates: Partial<ShoppingItem> } }
  | { type: "DELETE_SHOPPING_ITEM"; payload: string }
  // Expenses
  | { type: "ADD_EXPENSE"; payload: Expense }
  | { type: "DELETE_EXPENSE"; payload: string }
  // Carpool
  | { type: "ADD_CARPOOL_RIDE"; payload: CarpoolRide }
  | { type: "UPDATE_CARPOOL_RIDE"; payload: { id: string; updates: Partial<CarpoolRide> } }
  | { type: "JOIN_CARPOOL"; payload: { rideId: string; passenger: { id: string; name: string; avatar: string } } }
  | { type: "LEAVE_CARPOOL"; payload: { rideId: string; passengerId: string } }
  | { type: "DELETE_CARPOOL_RIDE"; payload: string }
  // Chat
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "ADD_MESSAGE_SSE"; payload: ChatMessage }
  | { type: "PIN_MESSAGE"; payload: { messageId: string; pinned: boolean } }
  | { type: "ADD_REACTION"; payload: { messageId: string; emoji: string; userId: string } }
  // Photos
  | { type: "ADD_PHOTO"; payload: PhotoItem }
  | { type: "DELETE_PHOTO"; payload: string }
  // Tasks
  | { type: "ADD_TASK"; payload: TaskItem }
  | { type: "UPDATE_TASK"; payload: { id: string; updates: Partial<TaskItem> } }
  | { type: "DELETE_TASK"; payload: string }
  // Notifications
  | { type: "ADD_NOTIFICATION"; payload: Notification }
  | { type: "MARK_NOTIFICATION_READ"; payload: string }
  | { type: "CLEAR_NOTIFICATIONS" }
  // Polls
  | { type: "ADD_POLL"; payload: Poll }
  | { type: "VOTE_POLL"; payload: { pollId: string; optionId: string; userId: string } }
  | { type: "UNVOTE_POLL"; payload: { pollId: string; userId: string } }
  | { type: "DELETE_POLL"; payload: string }
  // Backend sync — replaces all items for a specific group
  | { type: "SET_GROUP_CHAT_MESSAGES"; payload: { groupId: string; messages: ChatMessage[] } }
  | { type: "SET_GROUP_SHOPPING_ITEMS"; payload: { groupId: string; items: ShoppingItem[] } }
  | { type: "SET_GROUP_EXPENSES"; payload: { groupId: string; expenses: Expense[] } }
  | { type: "SET_GROUP_TASKS"; payload: { groupId: string; tasks: TaskItem[] } }
  | { type: "SET_GROUP_POLLS"; payload: { groupId: string; polls: Poll[] } }
  | { type: "SET_GROUP_CARPOOL_RIDES"; payload: { groupId: string; rides: CarpoolRide[] } }
  | { type: "SET_GROUP_PHOTOS"; payload: { groupId: string; photos: PhotoItem[] } }
  | { type: "UPDATE_PHOTO_URI"; payload: { id: string; uri: string } }
  // Live locations
  | { type: "UPDATE_LOCATION"; payload: { groupId: string; entry: { userId: string; name: string; lat: number; lng: number; updatedAt: string } } }
  | { type: "SET_GROUP_LOCATIONS"; payload: { groupId: string; locations: { userId: string; name: string; lat: number; lng: number; updatedAt: string }[] } }
  | { type: "PURGE_EXPIRED_GROUPS" }
  | { type: "LOGOUT" };

// ===== REDUCER =====
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.payload;
    case "SET_PROFILE":
      return { ...state, profile: action.payload };
    case "UPDATE_PROFILE":
      return { ...state, profile: state.profile ? { ...state.profile, ...action.payload } : null };
    case "COMPLETE_ONBOARDING":
      return { ...state, onboardingComplete: true };
    case "SET_DARK_MODE":
      return { ...state, darkMode: action.payload };
    // Friends
    case "ADD_FRIEND":
      return { ...state, friends: [...state.friends, action.payload] };
    case "REMOVE_FRIEND":
      return { ...state, friends: state.friends.filter((f) => f.id !== action.payload) };
    case "ADD_FRIEND_REQUEST":
      return { ...state, friendRequests: [...state.friendRequests, action.payload] };
    case "ACCEPT_FRIEND_REQUEST": {
      const req = state.friendRequests.find((r) => r.id === action.payload);
      if (!req) return state;
      return {
        ...state,
        friends: [...state.friends, req],
        friendRequests: state.friendRequests.filter((r) => r.id !== action.payload),
      };
    }
    case "REJECT_FRIEND_REQUEST":
      return { ...state, friendRequests: state.friendRequests.filter((r) => r.id !== action.payload) };
    // Groups
    case "ADD_GROUP":
      return { ...state, groups: [action.payload, ...state.groups] };
    case "UPDATE_GROUP":
      return {
        ...state,
        groups: state.groups.map((g) => (g.id === action.payload.id ? { ...g, ...action.payload.updates } : g)),
      };
    case "DELETE_GROUP":
      return {
        ...state,
        groups: state.groups.filter((g) => g.id !== action.payload),
        shoppingItems: state.shoppingItems.filter((i) => i.groupId !== action.payload),
        expenses: state.expenses.filter((e) => e.groupId !== action.payload),
        carpoolRides: state.carpoolRides.filter((r) => r.groupId !== action.payload),
        chatMessages: state.chatMessages.filter((m) => m.groupId !== action.payload),
        photos: state.photos.filter((p) => p.groupId !== action.payload),
        tasks: state.tasks.filter((t) => t.groupId !== action.payload),
        polls: state.polls.filter((p) => p.groupId !== action.payload),
      };
    case "UPDATE_RSVP":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.payload.groupId
            ? {
                ...g,
                members: g.members.map((m) =>
                  m.id === action.payload.memberId ? { ...m, rsvp: action.payload.rsvp } : m
                ),
              }
            : g
        ),
      };
    // Shopping
    case "ADD_SHOPPING_ITEM":
      return { ...state, shoppingItems: [...state.shoppingItems, action.payload] };
    case "UPDATE_SHOPPING_ITEM":
      return {
        ...state,
        shoppingItems: state.shoppingItems.map((i) =>
          i.id === action.payload.id ? { ...i, ...action.payload.updates } : i
        ),
      };
    case "DELETE_SHOPPING_ITEM":
      return { ...state, shoppingItems: state.shoppingItems.filter((i) => i.id !== action.payload) };
    // Expenses
    case "ADD_EXPENSE":
      return { ...state, expenses: [...state.expenses, action.payload] };
    case "DELETE_EXPENSE":
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.payload) };
    // Carpool
    case "ADD_CARPOOL_RIDE":
      return { ...state, carpoolRides: [...state.carpoolRides, action.payload] };
    case "UPDATE_CARPOOL_RIDE":
      return {
        ...state,
        carpoolRides: state.carpoolRides.map((r) =>
          r.id === action.payload.id ? { ...r, ...action.payload.updates } : r
        ),
      };
    case "JOIN_CARPOOL":
      return {
        ...state,
        carpoolRides: state.carpoolRides.map((r) =>
          r.id === action.payload.rideId
            ? {
                ...r,
                passengers: [...r.passengers, action.payload.passenger],
                availableSeats: r.availableSeats - 1,
              }
            : r
        ),
      };
    case "LEAVE_CARPOOL":
      return {
        ...state,
        carpoolRides: state.carpoolRides.map((r) =>
          r.id === action.payload.rideId
            ? {
                ...r,
                passengers: r.passengers.filter((p) => p.id !== action.payload.passengerId),
                availableSeats: r.availableSeats + 1,
              }
            : r
        ),
      };
    case "DELETE_CARPOOL_RIDE":
      return { ...state, carpoolRides: state.carpoolRides.filter((r) => r.id !== action.payload) };
    // Chat
    case "ADD_MESSAGE": {
      const next = [...state.chatMessages, action.payload];
      const groupMsgs = next.filter((m) => m.groupId === action.payload.groupId);
      if (groupMsgs.length > 200) {
        const toRemove = new Set(groupMsgs.slice(0, groupMsgs.length - 200).map((m) => m.id));
        return { ...state, chatMessages: next.filter((m) => !toRemove.has(m.id)) };
      }
      return { ...state, chatMessages: next };
    }
    // SSE : n'ajoute le message que s'il n'existe pas déjà (évite les doublons avec l'envoi optimiste)
    case "ADD_MESSAGE_SSE": {
      if (state.chatMessages.some((m) => m.id === action.payload.id)) return state;
      const next = [...state.chatMessages, action.payload];
      const groupMsgs = next.filter((m) => m.groupId === action.payload.groupId);
      if (groupMsgs.length > 200) {
        const toRemove = new Set(groupMsgs.slice(0, groupMsgs.length - 200).map((m) => m.id));
        return { ...state, chatMessages: next.filter((m) => !toRemove.has(m.id)) };
      }
      return { ...state, chatMessages: next };
    }
    case "PIN_MESSAGE":
      return {
        ...state,
        chatMessages: state.chatMessages.map((m) =>
          m.id === action.payload.messageId ? { ...m, isPinned: action.payload.pinned } : m
        ),
      };
    case "ADD_REACTION":
      return {
        ...state,
        chatMessages: state.chatMessages.map((m) =>
          m.id === action.payload.messageId
            ? { ...m, reactions: [...m.reactions, { emoji: action.payload.emoji, userId: action.payload.userId }] }
            : m
        ),
      };
    // Photos
    case "ADD_PHOTO":
      return { ...state, photos: [...state.photos, action.payload] };
    case "DELETE_PHOTO":
      return { ...state, photos: state.photos.filter((p) => p.id !== action.payload) };
    case "UPDATE_PHOTO_URI":
      return { ...state, photos: state.photos.map((p) => p.id === action.payload.id ? { ...p, uri: action.payload.uri } : p) };
    // Tasks
    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.payload] };
    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.payload.id ? { ...t, ...action.payload.updates } : t)),
      };
    case "DELETE_TASK":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.payload) };
    // Notifications
    case "ADD_NOTIFICATION":
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === action.payload ? { ...n, read: true } : n)),
      };
    case "CLEAR_NOTIFICATIONS":
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    // Polls
    case "ADD_POLL":
      return { ...state, polls: [...state.polls, action.payload] };
    case "VOTE_POLL":
      return {
        ...state,
        polls: state.polls.map((p) =>
          p.id === action.payload.pollId
            ? {
                ...p,
                options: p.options.map((o) =>
                  o.id === action.payload.optionId
                    ? {
                        ...o,
                        votes: o.votes.includes(action.payload.userId)
                          ? o.votes.filter((v) => v !== action.payload.userId)
                          : [...o.votes, action.payload.userId],
                      }
                    : o
                ),
              }
            : p
        ),
      };
    case "UNVOTE_POLL":
      return {
        ...state,
        polls: state.polls.map((p) =>
          p.id === action.payload.pollId
            ? {
                ...p,
                options: p.options.map((o) => ({
                  ...o,
                  votes: o.votes.filter((v) => v !== action.payload.userId),
                })),
              }
            : p
        ),
      };
    case "DELETE_POLL":
      return { ...state, polls: state.polls.filter((p) => p.id !== action.payload) };
    case "SET_GROUP_CHAT_MESSAGES": {
      const capped = action.payload.messages.slice(-500);
      return { ...state, chatMessages: [...state.chatMessages.filter((m) => m.groupId !== action.payload.groupId), ...capped] };
    }
    case "SET_GROUP_SHOPPING_ITEMS":
      return { ...state, shoppingItems: [...state.shoppingItems.filter((i) => i.groupId !== action.payload.groupId), ...action.payload.items] };
    case "SET_GROUP_EXPENSES":
      return { ...state, expenses: [...state.expenses.filter((e) => e.groupId !== action.payload.groupId), ...action.payload.expenses] };
    case "SET_GROUP_TASKS":
      return { ...state, tasks: [...state.tasks.filter((t) => t.groupId !== action.payload.groupId), ...action.payload.tasks] };
    case "SET_GROUP_POLLS":
      return { ...state, polls: [...state.polls.filter((p) => p.groupId !== action.payload.groupId), ...action.payload.polls] };
    case "SET_GROUP_CARPOOL_RIDES":
      return { ...state, carpoolRides: [...state.carpoolRides.filter((r) => r.groupId !== action.payload.groupId), ...action.payload.rides] };
    case "SET_GROUP_PHOTOS":
      return { ...state, photos: [...state.photos.filter((p) => p.groupId !== action.payload.groupId), ...action.payload.photos] };
    case "UPDATE_LOCATION": {
      const { groupId, entry } = action.payload;
      return {
        ...state,
        groupLocations: {
          ...state.groupLocations,
          [groupId]: { ...(state.groupLocations[groupId] ?? {}), [entry.userId]: entry },
        },
      };
    }
    case "SET_GROUP_LOCATIONS": {
      const { groupId, locations } = action.payload;
      const map: Record<string, typeof locations[0]> = {};
      locations.forEach((l) => { map[l.userId] = l; });
      return { ...state, groupLocations: { ...state.groupLocations, [groupId]: map } };
    }
    case "PURGE_EXPIRED_GROUPS": {
      const now = Date.now();
      const expiredIds = new Set(
        state.groups
          .filter((g) => g.type === "auto-destruct" && g.expiresAt && new Date(g.expiresAt).getTime() <= now)
          .map((g) => g.id)
      );
      if (expiredIds.size === 0) return state;
      return {
        ...state,
        groups: state.groups.filter((g) => !expiredIds.has(g.id)),
        shoppingItems: state.shoppingItems.filter((i) => !expiredIds.has(i.groupId)),
        expenses: state.expenses.filter((e) => !expiredIds.has(e.groupId)),
        carpoolRides: state.carpoolRides.filter((r) => !expiredIds.has(r.groupId)),
        chatMessages: state.chatMessages.filter((m) => !expiredIds.has(m.groupId)),
        photos: state.photos.filter((p) => !expiredIds.has(p.groupId)),
        tasks: state.tasks.filter((t) => !expiredIds.has(t.groupId)),
        polls: state.polls.filter((p) => !expiredIds.has(p.groupId)),
      };
    }
    case "LOGOUT":
      return { ...defaultState, darkMode: state.darkMode };
    default:
      return state;
  }
}

// ===== CONTEXT =====
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

// Separate contexts so components that only need dispatch don't re-render on state changes
const AppStateContext = createContext<AppState>(defaultState);
const AppDispatchContext = createContext<React.Dispatch<Action>>(() => {});

const AppContext = createContext<AppContextType>({
  state: defaultState,
  dispatch: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);

  // Load state on mount
  useEffect(() => {
    loadState().then(async (loaded) => {
      // On web: if profile wasn't persisted (debounce didn't fire before reload),
      // fall back to Auth.getUserInfo() stored in localStorage.
      if (!loaded.profile && Platform.OS === "web") {
        const userInfo = await Auth.getUserInfo();
        if (userInfo) {
          loaded = {
            ...loaded,
            profile: {
              id: String(userInfo.id),
              name: userInfo.name || "Utilisateur",
              username: userInfo.email?.split("@")[0] || "utilisateur",
              bio: "",
              avatar: "",
              status: "available",
              createdAt: new Date().toISOString(),
            },
          };
        }
      }
      dispatch({ type: "LOAD_STATE", payload: loaded });
    });
  }, []);

  // Nettoyage automatique des groupes auto-destruct expirés
  useEffect(() => {
    dispatch({ type: "PURGE_EXPIRED_GROUPS" });
    const interval = setInterval(() => {
      dispatch({ type: "PURGE_EXPIRED_GROUPS" });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Save state on changes (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      saveState(state);
    }, 500);
    return () => clearTimeout(timeout);
  }, [state]);

  return (
    <AppDispatchContext.Provider value={dispatch}>
      <AppStateContext.Provider value={state}>
        <AppContext.Provider value={{ state, dispatch }}>
          {children}
        </AppContext.Provider>
      </AppStateContext.Provider>
    </AppDispatchContext.Provider>
  );
}

/** Returns both state and dispatch. Triggers re-render on any state change. */
export function useApp() {
  return useContext(AppContext);
}

/** Returns only state. Use when you don't need dispatch. */
export function useAppState() {
  return useContext(AppStateContext);
}

/** Returns only dispatch. Never triggers re-renders from state changes. */
export function useAppDispatch() {
  return useContext(AppDispatchContext);
}

export { generateId, generateInvitationCode };
