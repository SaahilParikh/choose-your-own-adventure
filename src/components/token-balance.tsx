import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getBalance } from "@/lib/tokens";
import { formatBalance } from "@/lib/pricing";

export async function TokenBalance() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const balance = await getBalance(session.user.id);

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span>💰</span>
      <span className="font-medium">{formatBalance(balance)}</span>
    </div>
  );
}
