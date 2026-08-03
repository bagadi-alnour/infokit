"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

/** Surfaces catalogue mutation outcomes after a redirect, then clears them. */
export function CatalogueNotice({
  duplicateNameMessage,
  inUseMessage,
}: {
  duplicateNameMessage: string;
  inUseMessage: string;
}) {
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");

  useEffect(() => {
    if (notice === "in-use") toast.error(inUseMessage);
    else if (notice === "duplicate-name") toast.error(duplicateNameMessage);
    else return;

    const url = new URL(window.location.href);
    url.searchParams.delete("notice");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [duplicateNameMessage, inUseMessage, notice]);

  return null;
}
