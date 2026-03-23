import {
  UserProfile,
  Friend,
  Group,
  ShoppingItem,
  Expense,
  CarpoolRide,
  ChatMessage,
  TaskItem,
  Notification,
  Poll,
  PhotoItem,
} from "./store";

export const demoProfile: UserProfile = {
  id: "user_1",
  name: "Alex Martin",
  username: "alexmartin",
  bio: "Organisateur de soirées 🎉",
  avatar: "",
  status: "available",
  createdAt: new Date().toISOString(),
};

export const demoFriends: Friend[] = [
  { id: "user_2", name: "Sophie Dubois", username: "sophied", avatar: "", status: "available", addedAt: new Date().toISOString() },
  { id: "user_3", name: "Lucas Bernard", username: "lucasb", avatar: "", status: "busy", addedAt: new Date().toISOString() },
  { id: "user_4", name: "Emma Petit", username: "emmap", avatar: "", status: "available", addedAt: new Date().toISOString() },
  { id: "user_5", name: "Hugo Moreau", username: "hugom", avatar: "", status: "away", addedAt: new Date().toISOString() },
  { id: "user_6", name: "Léa Laurent", username: "leal", avatar: "", status: "available", addedAt: new Date().toISOString() },
  { id: "user_7", name: "Thomas Roux", username: "thomasr", avatar: "", status: "dnd", addedAt: new Date().toISOString() },
];

const futureDate1 = new Date(Date.now() + 3 * 86400000).toISOString();
const futureDate2 = new Date(Date.now() + 7 * 86400000).toISOString();
const futureDate3 = new Date(Date.now() + 2 * 86400000).toISOString();

export const demoGroups: Group[] = [
  {
    id: "group_1",
    name: "Soirée Anniversaire Sophie",
    description: "On fête les 25 ans de Sophie ! 🎂",
    type: "classic",
    coverImage: "",
    date: futureDate1,
    time: "20:00",
    location: "Chez Sophie, 15 rue de la Paix, Paris",
    createdBy: "user_1",
    createdAt: new Date().toISOString(),
    invitationCode: "PARTY2024",
    members: [
      { id: "user_1", name: "Alex Martin", username: "alexmartin", avatar: "", rsvp: "present", role: "admin" },
      { id: "user_2", name: "Sophie Dubois", username: "sophied", avatar: "", rsvp: "present", role: "admin" },
      { id: "user_3", name: "Lucas Bernard", username: "lucasb", avatar: "", rsvp: "present", role: "member" },
      { id: "user_4", name: "Emma Petit", username: "emmap", avatar: "", rsvp: "maybe", role: "member" },
      { id: "user_5", name: "Hugo Moreau", username: "hugom", avatar: "", rsvp: "pending", role: "member" },
    ],
  },
  {
    id: "group_2",
    name: "BBQ du Week-end",
    description: "Barbecue chez Lucas, ramenez vos spécialités ! 🥩🔥",
    type: "auto-destruct",
    coverImage: "",
    date: futureDate2,
    time: "12:00",
    location: "Jardin de Lucas, Boulogne",
    createdBy: "user_3",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 86400000).toISOString(),
    invitationCode: "BBQ2024",
    members: [
      { id: "user_1", name: "Alex Martin", username: "alexmartin", avatar: "", rsvp: "present", role: "member" },
      { id: "user_3", name: "Lucas Bernard", username: "lucasb", avatar: "", rsvp: "present", role: "admin" },
      { id: "user_5", name: "Hugo Moreau", username: "hugom", avatar: "", rsvp: "present", role: "member" },
      { id: "user_6", name: "Léa Laurent", username: "leal", avatar: "", rsvp: "maybe", role: "member" },
    ],
  },
  {
    id: "group_3",
    name: "Soirée Film",
    description: "Marathon Harry Potter 🧙‍♂️",
    type: "auto-destruct",
    coverImage: "",
    date: futureDate3,
    time: "19:00",
    location: "Chez Emma",
    createdBy: "user_4",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    invitationCode: "FILM2024",
    members: [
      { id: "user_1", name: "Alex Martin", username: "alexmartin", avatar: "", rsvp: "present", role: "member" },
      { id: "user_4", name: "Emma Petit", username: "emmap", avatar: "", rsvp: "present", role: "admin" },
      { id: "user_2", name: "Sophie Dubois", username: "sophied", avatar: "", rsvp: "present", role: "member" },
      { id: "user_7", name: "Thomas Roux", username: "thomasr", avatar: "", rsvp: "absent", role: "member" },
    ],
  },
];

export const demoShoppingItems: ShoppingItem[] = [
  { id: "shop_1", groupId: "group_1", name: "Gâteau d'anniversaire", assignedTo: "user_3", status: "to_buy", price: 35, addedBy: "user_1", createdAt: new Date().toISOString() },
  { id: "shop_2", groupId: "group_1", name: "Bougies (25)", assignedTo: "user_1", status: "bought", price: 5, addedBy: "user_1", createdAt: new Date().toISOString() },
  { id: "shop_3", groupId: "group_1", name: "Boissons (sodas + jus)", assignedTo: "user_4", status: "to_buy", price: 20, addedBy: "user_2", createdAt: new Date().toISOString() },
  { id: "shop_4", groupId: "group_1", name: "Chips et apéro", assignedTo: "user_5", status: "to_buy", price: 15, addedBy: "user_1", createdAt: new Date().toISOString() },
  { id: "shop_5", groupId: "group_2", name: "Viande pour BBQ", assignedTo: "user_3", status: "to_buy", price: 45, addedBy: "user_3", createdAt: new Date().toISOString() },
  { id: "shop_6", groupId: "group_2", name: "Pain et sauces", assignedTo: "user_1", status: "bought", price: 10, addedBy: "user_3", createdAt: new Date().toISOString() },
  { id: "shop_7", groupId: "group_3", name: "Pop-corn", assignedTo: "user_4", status: "to_buy", price: 8, addedBy: "user_4", createdAt: new Date().toISOString() },
];

export const demoExpenses: Expense[] = [
  { id: "exp_1", groupId: "group_1", description: "Décorations", amount: 30, paidBy: "user_1", splitBetween: ["user_1", "user_2", "user_3", "user_4", "user_5"], createdAt: new Date().toISOString() },
  { id: "exp_2", groupId: "group_1", description: "Sono et lumières", amount: 50, paidBy: "user_3", splitBetween: ["user_1", "user_2", "user_3", "user_4", "user_5"], createdAt: new Date().toISOString() },
  { id: "exp_3", groupId: "group_2", description: "Charbon BBQ", amount: 12, paidBy: "user_3", splitBetween: ["user_1", "user_3", "user_5", "user_6"], createdAt: new Date().toISOString() },
];

export const demoCarpoolRides: CarpoolRide[] = [
  {
    id: "ride_1", groupId: "group_1", driverId: "user_1", driverName: "Alex Martin", driverAvatar: "",
    departureLocation: "Gare du Nord, Paris", availableSeats: 2, totalSeats: 4,
    passengers: [{ id: "user_5", name: "Hugo Moreau", avatar: "" }, { id: "user_4", name: "Emma Petit", avatar: "" }],
    departureTime: futureDate1,
  },
  {
    id: "ride_2", groupId: "group_1", driverId: "user_3", driverName: "Lucas Bernard", driverAvatar: "",
    departureLocation: "Place de la République", availableSeats: 3, totalSeats: 3,
    passengers: [],
    departureTime: futureDate1,
  },
];

export const demoChatMessages: ChatMessage[] = [
  { id: "msg_1", groupId: "group_1", senderId: "user_2", senderName: "Sophie", senderAvatar: "", text: "Trop hâte pour samedi ! 🎉", type: "text", reactions: [{ emoji: "❤️", userId: "user_1" }], isPinned: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "msg_2", groupId: "group_1", senderId: "user_1", senderName: "Alex", senderAvatar: "", text: "J'ai commandé les décorations, ça va être top !", type: "text", reactions: [], isPinned: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: "msg_3", groupId: "group_1", senderId: "user_3", senderName: "Lucas", senderAvatar: "", text: "Qui ramène la sono ?", type: "text", reactions: [], isPinned: true, createdAt: new Date(Date.now() - 900000).toISOString() },
  { id: "msg_4", groupId: "group_1", senderId: "user_4", senderName: "Emma", senderAvatar: "", text: "Moi je peux ! J'ai une enceinte Bluetooth", type: "text", reactions: [{ emoji: "👍", userId: "user_3" }], isPinned: false, createdAt: new Date(Date.now() - 600000).toISOString() },
];

export const demoTasks: TaskItem[] = [
  { id: "task_1", groupId: "group_1", title: "Préparer la playlist", assignedTo: "user_1", assignedToName: "Alex", priority: "high", completed: false, deadline: futureDate1, createdAt: new Date().toISOString() },
  { id: "task_2", groupId: "group_1", title: "Installer les décorations", assignedTo: "user_3", assignedToName: "Lucas", priority: "medium", completed: false, deadline: futureDate1, createdAt: new Date().toISOString() },
  { id: "task_3", groupId: "group_1", title: "Commander le gâteau", assignedTo: "user_2", assignedToName: "Sophie", priority: "high", completed: true, deadline: futureDate1, createdAt: new Date().toISOString() },
  { id: "task_4", groupId: "group_2", title: "Nettoyer le barbecue", assignedTo: "user_3", assignedToName: "Lucas", priority: "medium", completed: false, deadline: futureDate2, createdAt: new Date().toISOString() },
  { id: "task_5", groupId: "group_2", title: "Acheter les boissons", assignedTo: "user_5", assignedToName: "Hugo", priority: "low", completed: false, deadline: futureDate2, createdAt: new Date().toISOString() },
];

export const demoNotifications: Notification[] = [
  { id: "notif_1", type: "rsvp", title: "RSVP en attente", message: "Hugo n'a pas encore répondu pour la Soirée Anniversaire", groupId: "group_1", read: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: "notif_2", type: "task", title: "Tâche assignée", message: "Tu dois préparer la playlist pour samedi", groupId: "group_1", read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "notif_3", type: "chat", title: "Nouveau message", message: "Emma a envoyé un message dans Soirée Anniversaire", groupId: "group_1", read: true, createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: "notif_4", type: "destruct", title: "Groupe temporaire", message: "Le groupe BBQ du Week-end expire dans 8 jours", groupId: "group_2", read: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "notif_5", type: "friend", title: "Demande d'ami", message: "Léa Laurent veut vous ajouter en ami", read: false, createdAt: new Date(Date.now() - 43200000).toISOString() },
];

export const demoPolls: Poll[] = [
  {
    id: "poll_1", groupId: "group_1", question: "Quel thème pour la soirée ?", createdBy: "user_1", createdAt: new Date().toISOString(),
    options: [
      { id: "opt_1", text: "Années 80", votes: ["user_1", "user_3"] },
      { id: "opt_2", text: "Tropical", votes: ["user_2", "user_4"] },
      { id: "opt_3", text: "Noir & Or", votes: ["user_5"] },
    ],
  },
];
