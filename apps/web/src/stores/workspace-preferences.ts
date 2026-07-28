"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Client state for the authenticated workspace that no form owns.
 *
 * The console has three kinds of state and they belong in three places:
 *
 * - what the editor is about to save → React Hook Form, inside the form;
 * - what the URL should be able to reproduce (filters, pagination, the runbook's
 *   date) → search params, so a link still describes the same screen;
 * - how this editor likes the console arranged on this device → here.
 *
 * Only the third kind is global, and it is the only thing this store holds.
 * Anything a colleague should be able to open by pasting a link stays in the
 * URL, and anything the server will validate stays in the form: a global store
 * that duplicates either one would give the same fact two homes.
 *
 * Preferences are persisted per device, never per account: they are a comfort
 * setting, not member data, so nothing here reaches the database.
 */

type WorkspacePreferencesState = {
  /** Whether the runbook keeps its information rail open. */
  informationRailExpanded: boolean;
};

type WorkspacePreferencesActions = {
  setInformationRailExpanded: (expanded: boolean) => void;
};

export type WorkspacePreferences = WorkspacePreferencesState &
  WorkspacePreferencesActions;

export const workspacePreferencesStorageKey = "infokit-workspace-preferences";

/**
 * Storage that shrugs off a browser which refuses it.
 *
 * Private-browsing modes either hide `localStorage` or throw on write. A lost
 * preference is a fair price; a console that cannot render because a panel
 * remembered its width is not.
 */
const preferenceStorage = createJSONStorage<WorkspacePreferencesState>(() => ({
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // The preference is lost, the interaction still works.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Nothing to undo.
    }
  },
}));

export const useWorkspacePreferences = create<WorkspacePreferences>()(
  persist(
    (set) => ({
      informationRailExpanded: true,
      setInformationRailExpanded: (expanded) => {
        set({ informationRailExpanded: expanded });
      },
    }),
    {
      name: workspacePreferencesStorageKey,
      version: 1,
      storage: preferenceStorage,
      /** Only the preferences are written; the setters live in code. */
      partialize: ({ informationRailExpanded }) => ({
        informationRailExpanded,
      }),
      /**
       * These screens are server-rendered, so the first client render has to
       * match the server's markup — which knows nothing about this device.
       * Rehydration is therefore deferred to `useHydrateWorkspacePreferences`,
       * after mount.
       */
      skipHydration: true,
    },
  ),
);

/** Read this device's stored preferences once, after the workspace mounts. */
export function useHydrateWorkspacePreferences(): void {
  useEffect(() => {
    void useWorkspacePreferences.persist.rehydrate();
  }, []);
}
