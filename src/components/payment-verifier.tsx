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
        if (data.grantedFormatted) {
          toast.success(`${data.grantedFormatted} added to your balance!`);
        } else if (data.alreadyProcessed) {
          toast.info("Payment already processed");
        }
        router.replace("/game");
        router.refresh();
      })
      .catch(() => toast.error("Failed to verify payment"));
  }, [searchParams, router]);

  return null;
}
