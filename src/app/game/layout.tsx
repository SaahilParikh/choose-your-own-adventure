import { TokenBalance } from "@/components/token-balance";
import { GameHeader } from "@/components/game/game-header";
import { BuyTokensDialog } from "@/components/buy-tokens-dialog";
import { PaymentVerifier } from "@/components/payment-verifier";
import { Suspense } from "react";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-card/50 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span>🎮</span>
          <span>Adventure Game</span>
        </div>
        <div className="flex items-center gap-4">
          <TokenBalance />
          <BuyTokensDialog />
          <GameHeader />
        </div>
      </header>
      <Suspense>
        <PaymentVerifier />
      </Suspense>
      <main className="flex min-h-0 flex-1">{children}</main>
    </div>
  );
}
