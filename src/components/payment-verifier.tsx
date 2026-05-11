"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function PaymentVerifier() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;

    fetch("/api/stripe/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        // The webhook may have credited first — in that case `alreadyProcessed`
        // is true, but `grantedFormatted` still reflects the amount added. Show
        // one unified success message regardless of which path completed the
        // credit.
        if (data.grantedFormatted && data.granted > 0) {
          toast.success(`${data.grantedFormatted} added to your balance!`);
        }
        router.replace("/game");
        router.refresh();
      })
      .catch(() => toast.error("Failed to verify payment"));
  }, [searchParams, router]);

  return null;
}
