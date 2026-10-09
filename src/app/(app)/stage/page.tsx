"use client";

import { useEffect, useState } from "react";
import { getAllRoutines, Routine, deleteRoutine, getAllAudioTracks, AudioTrack, deleteAudioTrack, addAudioTrack, updateRoutine } from "@/lib/firebase/firestore";
import { uploadAudio, deleteFile } from "@/lib/firebase/storage";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function StagePage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const [activeTab, setActiveTab] = useState<"routines" | "library">("routines");
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rData, tData] = await Promise.all([
        getAllRoutines(),
        getAllAudioTracks()
      ]);
      setRoutines(rData);
      setTracks(tData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (routine: Routine) => {
    if (!confirm(`Delete the routine "${routine.name}"? This can't be undone.`)) return;
    try {
      await deleteRoutine(routine.id);
      loadData();
    } catch (error) {
      console.error("Failed to delete routine:", error);
      alert("Delete failed. Check your connection and try again.");
    }
  };

  const handleDeleteTrack = async (track: AudioTrack) => {
    const usedBy = routines.filter(
      (r) => r.audioUrl === track.url || r.events?.some((e) => e.audioUrl === track.url)
    );
    const message = usedBy.length
      ? `"${track.name}" is used by ${usedBy.length} routine${usedBy.length > 1 ? "s" : ""}:\n\n` +
        usedBy.map((r) => `• ${r.name}`).join("\n") +
        `\n\nDeleting it removes the song from those routines (they'll play silent there). Delete anyway?`
      : `Delete "${track.name}"? This can't be undone.`;
    if (!confirm(message)) return;

    try {
      // Unlink the track from routines first so nothing points at a missing file.
      await Promise.all(
        usedBy.map((r) =>
          updateRoutine(r.id, {
            audioUrl: r.audioUrl === track.url ? "" : r.audioUrl,
            events: (r.events || []).map((e) => {
              if (e.audioUrl !== track.url) return e;
              const { audioUrl: _removed, ...rest } = e; // eslint-disable-line @typescript-eslint/no-unused-vars
              return rest;
            }),
          })
        )
      );
      await deleteAudioTrack(track.id);
      await deleteFile(track.url);
      loadData();
    } catch (error) {
      console.error("Failed to delete track:", error);
      alert("Delete failed. Check your connection and try again.");
    }
  };

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-belt-white uppercase tracking-tight">
            Stage Control
          </h1>
          <div className="flex gap-4 mt-2">
            <button 
              onClick={() => setActiveTab("routines")}
              className={`text-sm font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === "routines" ? "text-belt-white border-belt-red" : "text-belt-white/30 border-transparent hover:text-belt-white/60"}`}
            >
              Routines ({routines.length})
            </button>
            <button 
              onClick={() => setActiveTab("library")}
              className={`text-sm font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === "library" ? "text-belt-white border-belt-red" : "text-belt-white/30 border-transparent hover:text-belt-white/60"}`}
            >
              Audio Library ({tracks.length})
            </button>
          </div>
        </div>
        {activeTab === "routines" ? (
          <Link href="/stage/builder" className="btn-primary whitespace-nowrap">
            <span className="text-xl mr-2">+</span> New Routine
          </Link>
        ) : (
          <label className={`btn-primary whitespace-nowrap cursor-pointer ${uploadingTrack ? "opacity-50 pointer-events-none" : ""}`}>
            <span className="text-xl mr-2">{uploadingTrack ? "⏳" : "+"}</span> {uploadingTrack ? "Uploading..." : "Upload Track"}
            <input 
              type="file" 
              accept="audio/*" 
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !user) return;
                setUploadingTrack(true);
                try {
                  e.target.value = ""; // allow re-selecting the same file later
                  const url = await uploadAudio(file, file.name.replace(/\.[^/.]+$/, ""));
                  await addAudioTrack({
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    url,
                    uploaderId: user.uid
                  });
                  await loadData();
                } catch (err) {
                  console.error(err);
                  alert("Upload failed.");
                } finally {
                  setUploadingTrack(false);
                }
              }}
            />
          </label>
        )}
      </div>

      {activeTab === "routines" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {routines.map((routine) => (
          <div key={routine.id} className="card group relative flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex justify-between items-start gap-3 mb-4">
                <h3 className="text-xl font-bold text-belt-white group-hover:text-belt-red transition-colors line-clamp-2 break-words min-w-0">
                  {routine.name}
                </h3>
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => handleDelete(routine)}
                    className="hover-reveal w-10 h-10 bg-belt-gray/50 hover:bg-red-500/20 text-red-500 rounded-lg flex items-center justify-center transition-colors"
                    title="Delete Routine"
                    aria-label={`Delete ${routine.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.15em] text-belt-white/40">
                  <span>Segments</span>
                  <span className="text-belt-gold">{routine.events.length}</span>
                </div>
                <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.15em] text-belt-white/40">
                  <span>Sync Type</span>
                  <span className={routine.audioUrl ? "text-green-500" : "text-belt-white/60"}>
                    {routine.audioUrl ? "Audio Sync" : "Manual / Silent"}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.15em] text-belt-white/40">
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
                className="btn-primary flex-1 px-3 py-2 text-xs text-center uppercase font-black tracking-widest"
              >
                Go Live
              </Link>
              <Link 
                href={`/stage/builder?edit=${routine.id}`}
                className="btn-secondary flex-1 px-3 py-2 text-xs text-center uppercase font-black tracking-widest"
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
      </>
    )}

      {activeTab === "library" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tracks.map(track => (
              <div key={track.id} className="card p-4 flex flex-col gap-3 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0 bg-belt-red/20 rounded-full flex items-center justify-center text-belt-red">🎵</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-belt-white uppercase tracking-wider truncate">{track.name}</h3>
                    <p className="text-[10px] text-belt-white/40 uppercase tracking-widest">{new Date(track.uploadedAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteTrack(track)}
                    className="hover-reveal w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-belt-gray/30 hover:bg-red-500/20 text-red-500 transition-all"
                    aria-label={`Delete ${track.name}`}
                  >✕</button>
                </div>
                <audio controls preload="none" src={track.url} className="w-full h-10" />
              </div>
            ))}
          </div>

          {!loading && tracks.length === 0 && (
            <div className="card text-center py-20 border-dashed border-2 border-belt-gray/30">
              <div className="w-16 h-16 bg-belt-gray/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎧</span>
              </div>
              <p className="text-belt-white/60 text-lg font-bold mb-2">No Tracks Uploaded</p>
              <p className="text-belt-white/30 text-sm max-w-xs mx-auto">Upload MP3s here to use them in your routine choreographies.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
