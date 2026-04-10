"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isLoggedIn, getClient } from "@/lib/auth";

export default function SlugDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "denied">("loading");
  const slug = typeof params.slug === "string" ? params.slug : "";

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    const client = getClient();
    if (client?.slug === slug) {
      // Slug matches logged-in client — show their dashboard
      router.replace("/dashboard");
    } else {
      // Slug doesn't match — no access
      setStatus("denied");
    }
  }, [slug, router]);

  if (status === "denied") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 7.636z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2">Geen toegang</h1>
        <p className="text-muted-foreground mb-6">
          Je hebt geen toegang tot dit dashboard. Log in met het juiste account.
        </p>
        <a
          href="/login"
          className="px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-muted transition"
        >
          Inloggen
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
