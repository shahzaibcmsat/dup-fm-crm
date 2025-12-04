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
let cachedSnapshot: State = { ...state };

const listeners = new Set<Listener>();

function emit() {
  // Create a new snapshot object only when state actually changes
  cachedSnapshot = {
    unreadTotal: state.unreadTotal,
    perLeadUnread: { ...state.perLeadUnread }
  };
  saveState(state);
  console.log(`🔔 STORE: Emitting to ${listeners.size} listeners`);
  listeners.forEach((l) => l());
}

export const notificationStore = {
  subscribe: (cb: Listener) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getState: () => {
    // Return the cached snapshot - same reference until emit() is called
    return cachedSnapshot;
  },
  increment(leadId: string) {
    state.perLeadUnread[leadId] = (state.perLeadUnread[leadId] || 0) + 1;
    state.unreadTotal += 1;
    emit();
  },
  setCount(leadId: string, count: number) {
    const oldCount = state.perLeadUnread[leadId] || 0;
    console.log(`📊 STORE: setCount for ${leadId}: ${oldCount} → ${count}`);
    state.perLeadUnread[leadId] = count;
    state.unreadTotal = state.unreadTotal - oldCount + count;
    emit();
    console.log(`✅ STORE: Updated and emitted, new total: ${state.unreadTotal}`);
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
    notificationStore.subscribe,
    notificationStore.getState,
    () => ({
      unreadTotal: 0,
      perLeadUnread: {}
    })
  );
}
