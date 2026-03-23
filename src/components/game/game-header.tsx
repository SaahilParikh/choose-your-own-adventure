"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function GameHeader() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut}>
      <LogOut className="size-4" />
      <span className="hidden sm:inline">Sign Out</span>
    </Button>
  );
}
