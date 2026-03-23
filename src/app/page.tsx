import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/game");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="grid gap-2">
        <h1 className="text-4xl font-bold tracking-tight">Choose Your Own Adventure</h1>
        <p className="text-muted-foreground">
          Craft your story. Make choices. Shape your destiny.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/sign-in"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
}
