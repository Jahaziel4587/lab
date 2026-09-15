"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/Context/AuthContext";

export default function InspectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (user === null) {
      router.replace("/login");
      return;
    }

    setCheckingAuth(false);
  }, [user, router]);

  if (checkingAuth) {
    return null;
  }

  return <>{children}</>;
}