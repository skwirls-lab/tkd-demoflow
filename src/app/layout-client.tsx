"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ReactNode } from "react";

export default function RootLayoutClient({ children }: { children: ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-belt-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-belt-red border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-belt-white/60 text-lg">Loading DemoTeam...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
