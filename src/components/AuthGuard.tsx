"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getUser, getClient, type PortalUser, type PortalClient } from "@/lib/auth";

interface AuthGuardProps {
  children: (user: PortalUser, client: PortalClient | null) => React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [client, setClient] = useState<PortalClient | null>(null);
  const [checked, setChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
    setClient(getClient());
    setChecked(true);
  }, [router]);

  if (!checked || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children(user, client)}</>;
}
