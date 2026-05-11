"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-belt-black flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-belt-red border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-belt-white/60 text-lg">Checking auth...</p>
        </div>
      </div>
    );
  }

  const allowedEmailsStr = process.env.NEXT_PUBLIC_ALLOWED_EMAILS || "";
  const allowedEmails = allowedEmailsStr.split(",").map(e => e.trim().toLowerCase()).filter(e => e.length > 0);

  if (allowedEmails.length > 0 && !allowedEmails.includes(user.email?.toLowerCase() || "")) {
    return (
      <div className="min-h-screen bg-belt-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-belt-red/20 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl">🛑</span>
        </div>
        <h1 className="text-3xl font-black text-belt-white uppercase tracking-tighter mb-4">Access Denied</h1>
        <p className="text-belt-white/60 max-w-md mx-auto mb-8">
          Your account (<span className="text-belt-white font-bold">{user.email}</span>) has not been granted access to this team's command center.
        </p>
        <button 
          onClick={signOut}
          className="btn-secondary"
        >
          Sign Out
        </button>
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
