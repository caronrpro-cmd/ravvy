import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useApp, generateId } from "@/lib/app-provider";
import { Group } from "@/lib/types";

const REMINDERS_KEY = "@ravvy_reminders";
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (web uniquement)

// Valeurs possibles dans le record :
//   <uuid>       → ID d'une notification native planifiée (pas encore déclenchée)
//   "web-pending" → rappel web en attente de déclenchement par l'intervalle
//   "fired"       → rappel déjà déclenché (ne pas redéclencher)
type ReminderRecord = Record<string, string>;

// ===== AsyncStorage helpers =====

async function loadReminders(): Promise<ReminderRecord> {
  try {
    const raw = await AsyncStorage.getItem(REMINDERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveReminders(record: ReminderRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(record));
  } catch (e) {
    console.warn("[Reminders] Failed to save reminder record:", e);
  }
}

// ===== Date parsing =====

function parseEventDate(group: Group): Date | null {
  try {
    const dateStr = group.date;
    const timeStr = group.time || "20:00";
    let date: Date;
    if (dateStr.includes("T")) {
      date = new Date(dateStr);
    } else if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        // DD/MM/YYYY
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${timeStr}:00`);
      } else {
        date = new Date(dateStr);
      }
    } else {
      date = new Date(`${dateStr}T${timeStr}:00`);
    }
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

// ===== Native scheduling (trigger DATE absolu) =====

async function scheduleNativeReminder(
  title: string,
  body: string,
  date: Date
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
    return id;
  } catch (e) {
    console.warn("[Reminders] Failed to schedule native notification:", e);
    return null;
  }
}

// ===== Hook =====

export function useReminders() {
  const { state, dispatch } = useApp();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Planification des rappels au montage et lors des changements de groupes ---
  useEffect(() => {
    if (!state.profile) return;

    const schedule = async () => {
      const now = new Date();
      const record = await loadReminders();
      let changed = false;

      const ONE_HOUR = 60 * 60 * 1000;
      const TWENTY_FOUR_HOURS = 24 * ONE_HOUR;

      // 1. Nettoyage des entrées périmées (groupes supprimés ou événements passés)
      for (const key of Object.keys(record)) {
        const groupId = key.replace(/_(?:24h|1h)$/, "");
        const group = state.groups.find((g) => g.id === groupId);
        const eventDate = group ? parseEventDate(group) : null;

        const isStale = !group || !eventDate || eventDate.getTime() <= now.getTime();
        if (isStale) {
          // Annuler la notification native si elle n'a pas encore été déclenchée
          const val = record[key];
          if (Platform.OS !== "web" && val !== "web-pending" && val !== "fired") {
            Notifications.cancelScheduledNotificationAsync(val).catch(() => {});
          }
          delete record[key];
          changed = true;
        }
      }

      // 2. Planification des nouveaux rappels
      for (const group of state.groups) {
        const eventDate = parseEventDate(group);
        if (!eventDate) continue;

        const diff = eventDate.getTime() - now.getTime();
        if (diff <= 0) continue; // événement passé

        const makeTitle = () => `Rappel : ${group.name}`;
        const makeBody = (timing: "24h" | "1h") => {
          const label = timing === "24h" ? "demain" : "dans 1 heure";
          return `La soirée "${group.name}" commence ${label} ! Lieu : ${group.location}.`;
        };

        // Rappel 24h
        const key24h = `${group.id}_24h`;
        if (diff > TWENTY_FOUR_HOURS && !record[key24h]) {
          const reminderDate = new Date(eventDate.getTime() - TWENTY_FOUR_HOURS);
          if (Platform.OS !== "web") {
            const id = await scheduleNativeReminder(makeTitle(), makeBody("24h"), reminderDate);
            if (id) { record[key24h] = id; changed = true; }
          } else {
            record[key24h] = "web-pending";
            changed = true;
          }
        }

        // Rappel 1h
        const key1h = `${group.id}_1h`;
        if (diff > ONE_HOUR && !record[key1h]) {
          const reminderDate = new Date(eventDate.getTime() - ONE_HOUR);
          if (Platform.OS !== "web") {
            const id = await scheduleNativeReminder(makeTitle(), makeBody("1h"), reminderDate);
            if (id) { record[key1h] = id; changed = true; }
          } else {
            record[key1h] = "web-pending";
            changed = true;
          }
        }
      }

      if (changed) await saveReminders(record);
    };

    schedule();
  }, [state.groups, state.profile]);

  // --- Web uniquement : vérification toutes les 5 minutes ---
  useEffect(() => {
    if (Platform.OS !== "web" || !state.profile) return;

    const ONE_HOUR = 60 * 60 * 1000;
    const TWENTY_FOUR_HOURS = 24 * ONE_HOUR;

    const check = async () => {
      const now = new Date();
      const record = await loadReminders();
      let changed = false;

      for (const group of state.groups) {
        const eventDate = parseEventDate(group);
        if (!eventDate) continue;

        const diff = eventDate.getTime() - now.getTime();
        // Ne pas déclencher si l'événement est déjà passé
        if (diff <= 0) continue;

        const fire = (key: string, timing: "24h" | "1h") => {
          const label = timing === "24h" ? "demain" : "dans 1 heure";
          dispatch({
            type: "ADD_NOTIFICATION",
            payload: {
              id: generateId(),
              type: "reminder" as const,
              title: `Rappel : ${group.name}`,
              message: `La soirée "${group.name}" commence ${label} ! Lieu : ${group.location}.`,
              groupId: group.id,
              read: false,
              createdAt: new Date().toISOString(),
            },
          });
          record[key] = "fired";
          changed = true;
        };

        // Déclencher le rappel 24h si l'heure de rappel est atteinte
        const key24h = `${group.id}_24h`;
        if (record[key24h] === "web-pending" && diff <= TWENTY_FOUR_HOURS) {
          fire(key24h, "24h");
        }

        // Déclencher le rappel 1h si l'heure de rappel est atteinte
        const key1h = `${group.id}_1h`;
        if (record[key1h] === "web-pending" && diff <= ONE_HOUR) {
          fire(key1h, "1h");
        }
      }

      if (changed) await saveReminders(record);
    };

    check(); // vérification immédiate au montage
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.groups, state.profile]);
}
