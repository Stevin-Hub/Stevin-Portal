"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { portalFetch } from "@/lib/api";

export default function OneClickPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <OneClickContent />
    </Suspense>
  );
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Even geduld...</p>
      </div>
    </div>
  );
}

function OneClickContent() {
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

    portalFetch<{ token: string; redirect: string }>("/auth/one-click", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        localStorage.setItem("stevin-portal-token", data.token);
        router.replace(data.redirect || "/dashboard");
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message || "Link is verlopen of al gebruikt.");
      });
  }, [searchParams, router]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm max-w-md w-full text-center">
          <h1 className="text-xl font-bold mb-2">Link niet geldig</h1>
          <p className="text-muted-foreground mb-4">{errorMsg}</p>
          <a href="/login" className="inline-block px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-muted transition">
            Inloggen
          </a>
        </div>
      </div>
    );
  }

  return <LoadingSpinner />;
}
