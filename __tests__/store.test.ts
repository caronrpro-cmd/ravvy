import { describe, it, expect } from "vitest";
import {
  generateId,
  formatDate,
  formatRelativeTime,
  getTimeRemaining,
  defaultState,
} from "../lib/store";
import {
  demoProfile,
  demoFriends,
  demoGroups,
  demoShoppingItems,
  demoExpenses,
  demoCarpoolRides,
  demoChatMessages,
  demoTasks,
  demoNotifications,
  demoPolls,
} from "../lib/demo-data";

describe("Store helpers", () => {
  it("generateId returns unique strings", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it("formatDate formats a date string in French", () => {
    const result = formatDate("2026-03-15T20:00:00.000Z");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    // Should contain "15" for the day
    expect(result).toContain("15");
  });

  it("formatRelativeTime returns 'À l'instant' for recent time", () => {
    const now = new Date().toISOString();
    const result = formatRelativeTime(now);
    expect(result).toBe("À l'instant");
  });

  it("formatRelativeTime returns minutes ago", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60000).toISOString();
    const result = formatRelativeTime(tenMinAgo);
    expect(result).toContain("min");
  });

  it("getTimeRemaining returns 'Expiré' for past dates", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getTimeRemaining(past)).toBe("Expiré");
  });

  it("getTimeRemaining returns time string for future dates", () => {
    const future = new Date(Date.now() + 2 * 86400000).toISOString();
    const result = getTimeRemaining(future);
    expect(result).toContain("j");
  });
});

describe("Default state", () => {
  it("has all required fields", () => {
    expect(defaultState.profile).toBeNull();
    expect(defaultState.friends).toEqual([]);
    expect(defaultState.groups).toEqual([]);
    expect(defaultState.shoppingItems).toEqual([]);
    expect(defaultState.expenses).toEqual([]);
    expect(defaultState.carpoolRides).toEqual([]);
    expect(defaultState.chatMessages).toEqual([]);
    expect(defaultState.photos).toEqual([]);
    expect(defaultState.tasks).toEqual([]);
    expect(defaultState.notifications).toEqual([]);
    expect(defaultState.polls).toEqual([]);
    expect(defaultState.onboardingComplete).toBe(false);
    expect(defaultState.darkMode).toBeNull();
  });
});

describe("Demo data integrity", () => {
  it("demoProfile has valid structure", () => {
    expect(demoProfile.id).toBe("user_1");
    expect(demoProfile.name).toBeTruthy();
    expect(demoProfile.username).toBeTruthy();
    expect(["available", "busy", "away", "dnd"]).toContain(demoProfile.status);
  });

  it("demoFriends have valid structure", () => {
    expect(demoFriends.length).toBeGreaterThan(0);
    demoFriends.forEach((f) => {
      expect(f.id).toBeTruthy();
      expect(f.name).toBeTruthy();
      expect(f.username).toBeTruthy();
      expect(["available", "busy", "away", "dnd"]).toContain(f.status);
    });
  });

  it("demoGroups have valid structure", () => {
    expect(demoGroups.length).toBe(3);
    demoGroups.forEach((g) => {
      expect(g.id).toBeTruthy();
      expect(g.name).toBeTruthy();
      expect(g.members.length).toBeGreaterThan(0);
      expect(["classic", "auto-destruct"]).toContain(g.type);
      g.members.forEach((m) => {
        expect(["present", "absent", "maybe", "pending"]).toContain(m.rsvp);
        expect(["admin", "member"]).toContain(m.role);
      });
    });
  });

  it("demoShoppingItems reference valid groups", () => {
    const groupIds = demoGroups.map((g) => g.id);
    demoShoppingItems.forEach((item) => {
      expect(groupIds).toContain(item.groupId);
      expect(["to_buy", "bought"]).toContain(item.status);
      expect(item.price).toBeGreaterThanOrEqual(0);
    });
  });

  it("demoExpenses reference valid groups and have valid amounts", () => {
    const groupIds = demoGroups.map((g) => g.id);
    demoExpenses.forEach((exp) => {
      expect(groupIds).toContain(exp.groupId);
      expect(exp.amount).toBeGreaterThan(0);
      expect(exp.splitBetween.length).toBeGreaterThan(0);
    });
  });

  it("demoCarpoolRides have valid seat counts", () => {
    demoCarpoolRides.forEach((ride) => {
      expect(ride.totalSeats).toBeGreaterThan(0);
      expect(ride.availableSeats).toBeGreaterThanOrEqual(0);
      expect(ride.availableSeats).toBeLessThanOrEqual(ride.totalSeats);
      expect(ride.passengers.length).toBe(ride.totalSeats - ride.availableSeats);
    });
  });

  it("demoChatMessages have valid structure", () => {
    demoChatMessages.forEach((msg) => {
      expect(msg.id).toBeTruthy();
      expect(msg.groupId).toBeTruthy();
      expect(msg.text).toBeTruthy();
      expect(["text", "image", "location"]).toContain(msg.type);
    });
  });

  it("demoTasks have valid priorities", () => {
    demoTasks.forEach((task) => {
      expect(["low", "medium", "high"]).toContain(task.priority);
      expect(typeof task.completed).toBe("boolean");
    });
  });

  it("demoNotifications have valid types", () => {
    demoNotifications.forEach((notif) => {
      expect(["rsvp", "task", "carpool", "expense", "reminder", "destruct", "friend", "chat"]).toContain(notif.type);
      expect(typeof notif.read).toBe("boolean");
    });
  });

  it("demoPolls have valid structure", () => {
    demoPolls.forEach((poll) => {
      expect(poll.question).toBeTruthy();
      expect(poll.options.length).toBeGreaterThanOrEqual(2);
      poll.options.forEach((opt) => {
        expect(opt.text).toBeTruthy();
        expect(Array.isArray(opt.votes)).toBe(true);
      });
    });
  });
});
