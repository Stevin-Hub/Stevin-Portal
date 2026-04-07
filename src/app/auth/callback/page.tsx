"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function handle() {
      const supabase = createClient();
      const code = searchParams.get("code");

      if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        if (result.error) {
          router.push("/login");
          return;
        }
      }

      const session = await supabase.auth.getSession();
      if (session.data.session) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
    handle();
  }, [router, searchParams]);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Even geduld...</p>
      </div>
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
