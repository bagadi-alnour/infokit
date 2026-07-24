"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Surfaces catalogue mutation outcomes after a redirect, then clears them. */
export function CatalogueNotice({
  duplicateNameMessage,
  inUseMessage,
}: {
  duplicateNameMessage: string;
  inUseMessage: string;
}) {
  useEffect(() => {
    const url = new URL(window.location.href);
    const notice = url.searchParams.get("notice");
    if (notice === "in-use") toast.error(inUseMessage);
    else if (notice === "duplicate-name") toast.error(duplicateNameMessage);
    else return;
    url.searchParams.delete("notice");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [duplicateNameMessage, inUseMessage]);

  return null;
}
