// ===== TYPES =====

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar: string;
  status: "available" | "busy" | "away" | "dnd";
  createdAt: string;
}

export interface Friend {
  id: string;
  name: string;
  username: string;
  avatar: string;
  status: "available" | "busy" | "away" | "dnd";
  addedAt: string;
}

export type GroupType = "classic" | "auto-destruct";

export interface GroupSyncPayload {
  name: string;
  description?: string;
  type: GroupType;
  date: string;
  time: string;
  location?: string;
  shareCode: string;
  tasks: { externalId: string; title: string; priority: "low" | "medium" | "high" }[];
  shoppingItems: { externalId: string; name: string; price?: string }[];
  polls: { externalId: string; question: string; options: string }[];
}

export interface Group {
  id: string;
  name: string;
  description: string;
  type: GroupType;
  coverImage: string;
  date: string;
  time: string;
  location: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  invitationCode: string;
  members: GroupMember[];
  syncStatus?: "pending" | "synced" | "failed";
  syncPayload?: GroupSyncPayload;
}

export interface GroupMember {
  id: string;
  name: string;
  username: string;
  avatar: string;
  rsvp: "present" | "absent" | "maybe" | "pending";
  role: "admin" | "member";
}

export interface ShoppingItem {
  id: string;
  groupId: string;
  name: string;
  assignedTo?: string;
  status: "to_buy" | "bought";
  price: number;
  addedBy: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitBetween: string[];
  createdAt: string;
}

export interface CarpoolRide {
  id: string;
  groupId: string;
  driverId: string;
  driverName: string;
  driverAvatar: string;
  departureLocation: string;
  departureCoords?: { lat: number; lng: number };
  availableSeats: number;
  totalSeats: number;
  passengers: { id: string; name: string; avatar: string }[];
  departureTime: string;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  type: "text" | "image" | "location";
  imageUrl?: string;
  reactions: { emoji: string; userId: string }[];
  isPinned: boolean;
  createdAt: string;
  replyTo?: { id: string; senderName: string; text: string };
}

export interface PhotoItem {
  id: string;
  groupId: string;
  uri: string;
  uploadedBy: string;
  uploadedByName: string;
  tags: string[];
  createdAt: string;
}

export interface TaskItem {
  id: string;
  groupId: string;
  title: string;
  assignedTo?: string;
  assignedToName?: string;
  priority: "low" | "medium" | "high";
  completed: boolean;
  deadline?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "rsvp" | "task" | "carpool" | "expense" | "reminder" | "destruct" | "friend" | "chat";
  title: string;
  message: string;
  groupId?: string;
  read: boolean;
  createdAt: string;
}

export interface Poll {
  id: string;
  groupId: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  createdAt: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface LiveLocationEntry {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface AppState {
  profile: UserProfile | null;
  friends: Friend[];
  friendRequests: Friend[];
  groups: Group[];
  shoppingItems: ShoppingItem[];
  expenses: Expense[];
  carpoolRides: CarpoolRide[];
  chatMessages: ChatMessage[];
  photos: PhotoItem[];
  tasks: TaskItem[];
  notifications: Notification[];
  polls: Poll[];
  onboardingComplete: boolean;
  darkMode: boolean | null;
  groupLocations: Record<string, Record<string, LiveLocationEntry>>;
}

export const defaultState: AppState = {
  profile: null,
  friends: [],
  friendRequests: [],
  groups: [],
  shoppingItems: [],
  expenses: [],
  carpoolRides: [],
  chatMessages: [],
  photos: [],
  tasks: [],
  notifications: [],
  polls: [],
  onboardingComplete: false,
  darkMode: null,
  groupLocations: {},
};
