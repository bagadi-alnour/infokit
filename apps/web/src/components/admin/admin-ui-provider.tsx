"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
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

export function DashboardActionNotice({
  notices,
}: {
  notices: Record<
    string,
    { message: string; tone: "success" | "error" | "info" | "warning" }
  >;
}) {
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");
  const feedback = notice ? notices[notice] : undefined;

  useEffect(() => {
    if (!feedback) return;
    const url = new URL(window.location.href);
    // React's development Strict Mode replays effects. Reading the live URL
    // keeps a redirect result from being announced twice after we consume it.
    if (url.searchParams.get("notice") !== notice) return;
    toast[feedback.tone](feedback.message);

    url.searchParams.delete("notice");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [feedback]);

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
