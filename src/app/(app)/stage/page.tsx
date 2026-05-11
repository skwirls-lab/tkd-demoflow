"use client";

import { useEffect, useState } from "react";
import { getAllRoutines, Routine } from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function StagePage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  useEffect(() => {
    loadRoutines();
  }, []);

  const loadRoutines = async () => {
    try {
      const data = await getAllRoutines();
      setRoutines(data);
    } catch (error) {
      console.error("Failed to load routines:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-belt-white">Stage Manager</h1>
          <p className="text-belt-white/60 mt-1">
            {routines.length} routine{routines.length !== 1 ? "s" : ""} available
          </p>
        </div>
        {isAdmin && (
          <Link href="/stage/builder" className="btn-primary">
            <span className="text-xl mr-2">+</span> New Routine
          </Link>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-belt-gray rounded w-1/3 mb-3" />
              <div className="h-4 bg-belt-gray rounded w-1/2 mb-2" />
              <div className="h-10 bg-belt-gray rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && routines.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-4xl mb-4">🎵</p>
          <p className="text-belt-white/60 text-lg">No routines yet</p>
          {isAdmin && (
            <Link href="/stage/builder" className="btn-primary mt-4 inline-block">
              Create Your First Routine
            </Link>
          )}
        </div>
      )}

      {/* Routine List */}
      {!loading && routines.length > 0 && (
        <div className="space-y-4">
          {routines.map((routine) => (
            <Link key={routine.id} href={`/stage/live/${routine.id}`}>
              <div className="card hover:ring-2 hover:ring-belt-red transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-belt-red rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">▶️</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-belt-white text-lg">
                      {routine.name}
                    </h3>
                    <p className="text-sm text-belt-white/50">
                      {routine.events.length} event
                      {routine.events.length !== 1 ? "s" : ""} •{" "}
                      {new Date(routine.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-belt-white/30 text-2xl">→</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
