"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { DirectionProvider } from "~/components/ui/direction";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useHydrateWorkspacePreferences } from "~/stores/workspace-preferences";

const ActionFeedbackContext = createContext({
  permissionDenied: "Permission denied",
});

export function isPermissionDeniedError(error: unknown) {
  const redirectDigest =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : "";

  return (
    (error instanceof Error &&
      (error.message === "Forbidden" || error.message.includes("Forbidden"))) ||
    redirectDigest.includes("permission-denied")
  );
}

export function useActionErrorToast() {
  const { permissionDenied } = useContext(ActionFeedbackContext);
  return useCallback(
    (error: unknown, fallback: string) => {
      toast.error(isPermissionDeniedError(error) ? permissionDenied : fallback);
    },
    [permissionDenied],
  );
}

export function PermissionDeniedNotice({ message }: { message: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("notice") !== "permission-denied") return;
    toast.error(message);
    url.searchParams.delete("notice");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [message]);

  return null;
}

/** Web-only interaction providers for the authenticated shadcn workspace. */
export function AdminUIProvider({
  children,
  direction,
  permissionDenied,
}: {
  children: ReactNode;
  direction: "ltr" | "rtl";
  permissionDenied: string;
}) {
  // Once for the whole workspace: the panels read the store, and only the shell
  // knows when the client has taken over from the server's markup.
  useHydrateWorkspacePreferences();

  return (
    <ActionFeedbackContext.Provider value={{ permissionDenied }}>
      <DirectionProvider direction={direction}>
        <TooltipProvider delay={350}>{children}</TooltipProvider>
      </DirectionProvider>
    </ActionFeedbackContext.Provider>
  );
}
