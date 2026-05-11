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
        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <p className="text-belt-white/40 text-xs">
            TKD DemoFlow Command Center v0.1.0
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-belt-black pb-20">
      <header className="sticky top-0 z-40 bg-belt-black/80 backdrop-blur-md border-b border-belt-gray/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-belt-red rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xs">DF</span>
            </div>
            <span className="font-black text-lg tracking-tight text-belt-white uppercase">TKD DemoFlow</span>
          </div>
          {user && (
            <div className="text-[10px] text-belt-gold font-bold uppercase tracking-widest bg-belt-gray px-2 py-1 rounded">
              Demo Leader
            </div>
          )}
        </div>
      </header>
      <main>
        {children}
      </main>
      <Navbar />
    </div>
  );
}
