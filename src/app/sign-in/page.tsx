"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const { error } = await authClient.signIn.email({
      email: form.get("email") as string,
      password: form.get("password") as string,
    });

    if (error) {
      toast.error(error.message ?? "Sign in failed");
      setLoading(false);
      return;
    }

    router.push("/game");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to continue your adventure</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="sign-in-form" onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" disabled={loading} size="lg">
              {loading && <Loader2 className="animate-spin" />}
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="ml-1 underline">
            Sign up
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
