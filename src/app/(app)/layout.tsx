"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-belt-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-belt-red border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-belt-white/60 text-lg">Checking auth...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-belt-black pb-20">
      {children}
      <Navbar />
    </div>
  );
}
