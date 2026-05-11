"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/roster", label: "Roster", icon: "👥" },
  { href: "/stage", label: "Stage", icon: "🎵" },
  { href: "/notes", label: "Notes", icon: "📝" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { userData, signOut } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-belt-dark/95 backdrop-blur-sm border-t border-gray-800 z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-3 px-4 min-h-[48px] transition-colors ${
                isActive
                  ? "text-belt-red"
                  : "text-belt-white/60 hover:text-belt-white"
              }`}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
              {isActive && (
                <div className="w-1 h-1 bg-belt-red rounded-full mt-1" />
              )}
            </Link>
          );
        })}

        <button
          onClick={signOut}
          className="flex flex-col items-center py-3 px-4 min-h-[48px] text-belt-white/60 hover:text-red-400 transition-colors"
          aria-label="Sign Out"
        >
          <span className="text-xl mb-1">🚪</span>
          <span className="text-xs font-medium">Exit</span>
        </button>
      </div>
    </nav>
  );
}
