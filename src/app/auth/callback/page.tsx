"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error("Auth error:", error.message);
          router.push("/login");
        } else {
          router.push("/dashboard");
        }
      });
    } else {
      // No code — check hash (implicit flow) or existing session
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        // Supabase handles hash automatically, wait for it
        setTimeout(() => {
          supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
              router.push("/dashboard");
            } else {
              router.push("/login");
            }
          });
        }, 500);
      } else {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) {
            router.push("/dashboard");
          } else {
            router.push("/login");
          }
        });
      }
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Even geduld...</p>
      </div>
    </div>
  );
}
