"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { portalFetch } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function VerifyPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <VerifyContent />
    </Suspense>
  );
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Bezig met inloggen...</p>
      </div>
    </div>
  );
}

function VerifyContent() {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg("Geen geldige link.");
      return;
    }

    portalFetch<{ token: string; user: any; client: any }>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        setAuth(data.token, data.user, data.client);
        router.replace("/dashboard");
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message || "Link is verlopen of ongeldig.");
      });
  }, [searchParams, router]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm max-w-md w-full text-center">
          <div className="w-16 h-16 bg-danger-light rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Link niet geldig</h1>
          <p className="text-muted-foreground mb-4">{errorMsg}</p>
          <a
            href="/login"
            className="inline-block px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-muted transition"
          >
            Opnieuw inloggen
          </a>
        </div>
      </div>
    );
  }

  return <LoadingSpinner />;
}
