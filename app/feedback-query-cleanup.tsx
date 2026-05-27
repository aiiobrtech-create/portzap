"use client";

import { useEffect } from "react";

type FeedbackQueryCleanupProps = {
  keys?: string[];
};

export function FeedbackQueryCleanup({ keys = ["tone", "message"] }: FeedbackQueryCleanupProps) {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;

    for (const key of keys) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [keys]);

  return null;
}
