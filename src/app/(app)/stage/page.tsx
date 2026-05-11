"use client";

import { useEffect, useState } from "react";
import { getAllRoutines, Routine, deleteRoutine } from "@/lib/firebase/firestore";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function StagePage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this routine?")) return;
    try {
      await deleteRoutine(id);
      loadRoutines();
    } catch (error) {
      console.error("Failed to delete routine:", error);
    }
  };

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-belt-white uppercase tracking-tight">
            Routine Library
          </h1>
          <p className="text-belt-white/60 mt-1">
            {routines.length} routine{routines.length !== 1 ? "s" : ""} available
          </p>
        </div>
        <Link href="/stage/builder" className="btn-primary">
          <span className="text-xl mr-2">+</span> New Routine
        </Link>
      </div>

      {/* Routines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {routines.map((routine) => (
          <div key={routine.id} className="card group relative flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-belt-white group-hover:text-belt-red transition-colors line-clamp-1">
                  {routine.name}
                </h3>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleDelete(routine.id)}
                    className="w-8 h-8 bg-belt-gray/50 hover:bg-red-500/20 text-red-500 rounded-lg flex items-center justify-center transition-colors"
                    title="Delete Routine"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-belt-white/30">
                  <span>Segments</span>
                  <span className="text-belt-gold">{routine.events.length}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-belt-white/30">
                  <span>Sync Type</span>
                  <span className={routine.audioUrl ? "text-green-500" : "text-belt-white/60"}>
                    {routine.audioUrl ? "Audio Sync" : "Manual / Silent"}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-belt-white/30">
                  <span>Feedback</span>
                  <span className="text-belt-white/60">
                    {routine.notes?.length || 0} notes
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Link 
                href={`/stage/live/${routine.id}`}
                className="btn-primary flex-1 py-2 text-xs text-center uppercase font-black tracking-widest"
              >
                Go Live
              </Link>
              <Link 
                href={`/stage/builder?edit=${routine.id}`}
                className="btn-secondary flex-1 py-2 text-xs text-center uppercase font-black tracking-widest"
              >
                Edit
              </Link>
            </div>
          </div>
        ))}
      </div>

      {!loading && routines.length === 0 && (
        <div className="card text-center py-20 border-dashed border-2">
          <div className="w-16 h-16 bg-belt-gray/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎵</span>
          </div>
          <p className="text-belt-white/60 text-lg font-bold mb-2">Your Stage is Empty</p>
          <p className="text-belt-white/30 text-sm mb-6 max-w-xs mx-auto">Create your first routine to start managing formations and team segments.</p>
          <Link href="/stage/builder" className="btn-primary inline-block">
            Create Routine
          </Link>
        </div>
      )}
    </div>
  );
}
