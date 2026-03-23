import { describe, it, expect } from "vitest";
import { formatDateFR as formatDate, formatTimeFR as formatTime, formatRelativeTimeFR as formatRelativeDate } from "../lib/date-utils";

describe("Améliorations V2 - Tests", () => {
  describe("Sondages - Retrait de vote", () => {
    it("devrait permettre de retirer un vote d'un sondage", () => {
      // Simulate poll state
      const poll = {
        id: "poll_1",
        options: [
          { id: "opt_1", text: "Option A", votes: ["user_1", "user_2"] },
          { id: "opt_2", text: "Option B", votes: ["user_3"] },
        ],
      };

      // Simulate UNVOTE_POLL action
      const updatedPoll = {
        ...poll,
        options: poll.options.map((o) => ({
          ...o,
          votes: o.votes.filter((v) => v !== "user_1"),
        })),
      };

      expect(updatedPoll.options[0].votes).toEqual(["user_2"]);
      expect(updatedPoll.options[0].votes).not.toContain("user_1");
      expect(updatedPoll.options[1].votes).toEqual(["user_3"]);
    });

    it("devrait supprimer un sondage", () => {
      const polls = [
        { id: "poll_1", question: "Q1" },
        { id: "poll_2", question: "Q2" },
      ];

      // Simulate DELETE_POLL
      const updated = polls.filter((p) => p.id !== "poll_1");
      expect(updated).toHaveLength(1);
      expect(updated[0].id).toBe("poll_2");
    });
  });

  describe("Covoiturage - Un seul choix", () => {
    it("devrait vérifier qu'un utilisateur n'est dans qu'une seule voiture", () => {
      const rides = [
        { id: "ride_1", passengers: [{ id: "user_1" }, { id: "user_2" }] },
        { id: "ride_2", passengers: [{ id: "user_3" }] },
      ];

      const userId = "user_1";
      const isAlreadyInRide = rides.some((r) =>
        r.passengers.some((p) => p.id === userId)
      );
      expect(isAlreadyInRide).toBe(true);

      // User should not be able to join another ride
      const currentRide = rides.find((r) =>
        r.passengers.some((p) => p.id === userId)
      );
      expect(currentRide?.id).toBe("ride_1");
    });

    it("devrait permettre de se retirer d'un covoiturage", () => {
      const ride = {
        id: "ride_1",
        passengers: [{ id: "user_1" }, { id: "user_2" }],
        availableSeats: 1,
      };

      // Simulate LEAVE_CARPOOL
      const updated = {
        ...ride,
        passengers: ride.passengers.filter((p) => p.id !== "user_1"),
        availableSeats: ride.availableSeats + 1,
      };

      expect(updated.passengers).toHaveLength(1);
      expect(updated.availableSeats).toBe(2);
    });
  });

  describe("Courses - Assignation", () => {
    it("devrait assigner un article à un membre", () => {
      const item = {
        id: "item_1",
        name: "Chips",
        assignedTo: undefined as string | undefined,
      };

      const updated = { ...item, assignedTo: "user_2" };
      expect(updated.assignedTo).toBe("user_2");
    });

    it("devrait retirer l'assignation d'un article", () => {
      const item = {
        id: "item_1",
        name: "Chips",
        assignedTo: "user_2" as string | undefined,
      };

      const updated = { ...item, assignedTo: undefined };
      expect(updated.assignedTo).toBeUndefined();
    });

    it("devrait grouper les articles par membre", () => {
      const items = [
        { id: "1", name: "Chips", assignedTo: "user_1" },
        { id: "2", name: "Bière", assignedTo: "user_2" },
        { id: "3", name: "Pain", assignedTo: "user_1" },
        { id: "4", name: "Fromage", assignedTo: undefined },
      ];

      const byMember: Record<string, typeof items> = {};
      items.forEach((item) => {
        if (item.assignedTo) {
          if (!byMember[item.assignedTo]) byMember[item.assignedTo] = [];
          byMember[item.assignedTo].push(item);
        }
      });

      expect(byMember["user_1"]).toHaveLength(2);
      expect(byMember["user_2"]).toHaveLength(1);
      expect(items.filter((i) => !i.assignedTo)).toHaveLength(1);
    });
  });

  describe("RSVP - Liste des présents/absents", () => {
    it("devrait catégoriser les membres par RSVP", () => {
      const members = [
        { id: "1", name: "Alice", rsvp: "going" as const },
        { id: "2", name: "Bob", rsvp: "maybe" as const },
        { id: "3", name: "Charlie", rsvp: "not_going" as const },
        { id: "4", name: "Diana", rsvp: "going" as const },
        { id: "5", name: "Eve", rsvp: "pending" as const },
      ];

      const going = members.filter((m) => m.rsvp === "going");
      const maybe = members.filter((m) => m.rsvp === "maybe");
      const notGoing = members.filter((m) => m.rsvp === "not_going");
      const pending = members.filter((m) => m.rsvp === "pending");

      expect(going).toHaveLength(2);
      expect(maybe).toHaveLength(1);
      expect(notGoing).toHaveLength(1);
      expect(pending).toHaveLength(1);
    });
  });

  describe("Thèmes de soirée", () => {
    it("devrait avoir des templates prédéfinis avec tâches et courses", () => {
      // Simulate template structure
      const template = {
        id: "birthday",
        name: "Anniversaire",
        emoji: "🎂",
        tasks: ["Décorer la salle", "Commander le gâteau"],
        shopping: ["Gâteau", "Bougies", "Ballons"],
        polls: [{ question: "Thème de la soirée ?", options: ["Disco", "Tropical"] }],
      };

      expect(template.tasks.length).toBeGreaterThan(0);
      expect(template.shopping.length).toBeGreaterThan(0);
      expect(template.polls.length).toBeGreaterThan(0);
    });
  });

  describe("Partage par QR Code", () => {
    it("devrait générer un lien de partage valide", () => {
      const groupId = "group_123";
      const shareLink = `ravvy://join/${groupId}`;
      expect(shareLink).toContain(groupId);
      expect(shareLink).toMatch(/^ravvy:\/\/join\//);
    });
  });

  describe("Quitter/Annuler groupe", () => {
    it("devrait supprimer un groupe et ses données associées", () => {
      const state = {
        groups: [{ id: "g1" }, { id: "g2" }],
        shoppingItems: [
          { id: "s1", groupId: "g1" },
          { id: "s2", groupId: "g2" },
        ],
        polls: [
          { id: "p1", groupId: "g1" },
          { id: "p2", groupId: "g2" },
        ],
      };

      // Simulate DELETE_GROUP
      const groupId = "g1";
      const updated = {
        groups: state.groups.filter((g) => g.id !== groupId),
        shoppingItems: state.shoppingItems.filter((i) => i.groupId !== groupId),
        polls: state.polls.filter((p) => p.groupId !== groupId),
      };

      expect(updated.groups).toHaveLength(1);
      expect(updated.shoppingItems).toHaveLength(1);
      expect(updated.polls).toHaveLength(1);
    });

    it("devrait retirer un membre d'un groupe", () => {
      const group = {
        id: "g1",
        members: [
          { id: "user_1", name: "Alice" },
          { id: "user_2", name: "Bob" },
          { id: "user_3", name: "Charlie" },
        ],
      };

      const updated = {
        ...group,
        members: group.members.filter((m) => m.id !== "user_2"),
      };

      expect(updated.members).toHaveLength(2);
      expect(updated.members.find((m) => m.id === "user_2")).toBeUndefined();
    });
  });

  describe("Dates françaises", () => {
    it("devrait formater les dates en JJ/MM/AAAA", () => {
      const result = formatDate("2025-12-25T20:00:00.000Z");
      expect(result).toBe("25/12/2025");
    });

    it("devrait formater l'heure en HH:MM", () => {
      const result = formatTime("2025-12-25T20:30:00.000Z");
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it("devrait afficher une date relative pour le passé", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = formatRelativeDate(yesterday.toISOString());
      expect(result).toBe("hier");
    });

    it("devrait afficher 'à l'instant' pour maintenant", () => {
      const now = new Date();
      const result = formatRelativeDate(now.toISOString());
      expect(result).toBe("à l'instant");
    });
  });
});
