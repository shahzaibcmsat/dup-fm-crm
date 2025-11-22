// Lightweight notification store for unread email counts (no external deps)
import { useSyncExternalStore } from "react";

type State = {
  unreadTotal: number;
  perLeadUnread: Record<string, number>;
};

type Listener = () => void;

const STORAGE_KEY = "fmd-email-notifications";

// Load initial state from localStorage
function loadState(): State {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load notification state from localStorage", error);
  }
  return {
    unreadTotal: 0,
    perLeadUnread: {},
  };
}

// Save state to localStorage
function saveState(state: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save notification state to localStorage", error);
  }
}

const state: State = loadState();

const listeners = new Set<Listener>();

function emit() {
  saveState(state);
  listeners.forEach((l) => l());
}

export const notificationStore = {
  subscribe(cb: Listener) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getState(): State {
    return state;
  },
  increment(leadId: string) {
    state.perLeadUnread[leadId] = (state.perLeadUnread[leadId] || 0) + 1;
    state.unreadTotal += 1;
    emit();
  },
  clearLead(leadId: string) {
    const count = state.perLeadUnread[leadId] || 0;
    if (count > 0) {
      state.unreadTotal = Math.max(0, state.unreadTotal - count);
    }
    delete state.perLeadUnread[leadId];
    emit();
  },
  reset() {
    state.unreadTotal = 0;
    state.perLeadUnread = {};
    emit();
  },
};

export function useUnreadEmailCounts() {
  return useSyncExternalStore(
    (cb) => notificationStore.subscribe(cb),
    () => notificationStore.getState()
  );
}
