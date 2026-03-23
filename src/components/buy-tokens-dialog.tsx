"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";

const packages = [
  { id: "funds_5", name: "$5", amount: "$5.00", price: "$5" },
  { id: "funds_10", name: "$10", amount: "$10.00", price: "$10" },
  { id: "funds_20", name: "$20", amount: "$20.00", price: "$20" },
];

export function BuyTokensDialog() {
  const [loading, setLoading] = useState<string | null>(null);

  async function handlePurchase(packageId: string) {
    setLoading(packageId);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });

      if (!response.ok) throw new Error("Failed to create checkout");

      const { url } = await response.json();
      window.location.href = url;
    } catch {
      toast.error("Failed to start checkout");
      setLoading(null);
    }
  }

  return (
    <Dialog>
      <DialogTrigger>
        <div className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
          <DollarSign className="size-4" />
          Add Funds
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Funds</DialogTitle>
          <DialogDescription>
            Funds are used to cover the cost of each game turn. Choose an amount below.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 pt-2">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => handlePurchase(pkg.id)}
              disabled={loading !== null}
              className="flex items-center justify-between rounded-lg border border-border/50 p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              <div>
                <div className="font-medium">{pkg.amount} balance</div>
                <div className="text-sm text-muted-foreground">{pkg.name} package</div>
              </div>
              <div className="flex items-center gap-2">
                {loading === pkg.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span className="text-lg font-bold">{pkg.price}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
