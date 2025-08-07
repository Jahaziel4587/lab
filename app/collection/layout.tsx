"use client";
import { useAuth } from "@/src/Context/AuthContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login"); // redirige si no hay sesión
    }
  }, [user, router]);

  if (!user) return null; // evita parpadeo de contenido si no hay sesión

  return <>{children}</>;
}
