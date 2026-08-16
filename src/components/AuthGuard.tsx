"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getUser, getClient, isImpersonating, type PortalUser, type PortalClient } from "@/lib/auth";
import { portalFetch } from "@/lib/api";

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
    // Bij meekijken (?_t=) is /me de waarheid: de localStorage-sessie kan van
    // de EIGEN login zijn (andere klant), en zonder eerdere login is er
    // helemaal geen user en bleef dit scherm eeuwig op de spinner hangen
    // (16 aug 2026). De pagina's krijgen dan de meegekeken klant mee.
    if (isImpersonating()) {
      portalFetch<{ client?: { id: string; name: string; slug: string } | null }>("/me")
        .then((me) => {
          setUser(
            getUser() ?? { id: "impersonate", email: "meekijken@stevin.ai", displayName: "Consultant (meekijken)", role: "stagiair" },
          );
          setClient(me.client ? { id: me.client.id, name: me.client.name, slug: me.client.slug } : getClient());
          setChecked(true);
        })
        .catch(() => {
          setUser(getUser());
          setClient(getClient());
          setChecked(true);
        });
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
