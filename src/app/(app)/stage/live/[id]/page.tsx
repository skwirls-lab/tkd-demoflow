"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRoutine, Routine, RoutineEvent, getAllMembers, Member, updateRoutine } from "@/lib/firebase/firestore";
import AudioPlayer from "@/components/stage/AudioPlayer";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function LiveRoutinePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [seekTo, setSeekTo] = useState<number | undefined>(undefined);
  const [syncAudio, setSyncAudio] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Duration-based Auto-advance
  useEffect(() => {
    if (isPlaying && autoAdvance && routine && routine.events.length > 0) {
      const currentEvent = routine.events[activeSegmentIndex];
      const duration = currentEvent.timestamp; // The input is the DURATION of the segment
      
      if (duration > 0) {
        // Calculate the absolute start time of the CURRENT segment by summing previous durations
        const absoluteStartTime = routine.events
          .slice(0, activeSegmentIndex)
          .reduce((sum, e) => sum + e.timestamp, 0);
          
        const exitTime = absoluteStartTime + duration;

        if (currentTime >= exitTime) {
          const nextIndex = activeSegmentIndex + 1;
          if (nextIndex < routine.events.length) {
            setActiveSegmentIndex(nextIndex);
          } else {
             setIsPlaying(false); // End of routine
          }
        }
      }
    }
  }, [currentTime, isPlaying, autoAdvance, routine, activeSegmentIndex]);

  // Timer for manual stopwatch
  useEffect(() => {
    if (routine && !routine.audioUrl && isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => prev + 0.1);
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, routine]);

  useEffect(() => {
    if (id) {
      loadRoutine();
      loadMembers();
    }
  }, [id]);

  const loadMembers = async () => {
    const data = await getAllMembers();
    setAllMembers(data);
  };

  const loadRoutine = async () => {
    try {
      const data = await getRoutine(id as string);
      setRoutine(data);
    } catch (error) {
      console.error("Failed to load routine:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !routine || !newNote.trim()) return;

    setSavingNote(true);
    try {
      const note = {
        authorId: user.uid,
        content: newNote.trim(),
        timestamp: new Date().toISOString(),
      };
      
      const updatedNotes = [...(routine.notes || []), note];
      await updateRoutine(routine.id, { notes: updatedNotes });
      
      setRoutine({ ...routine, notes: updatedNotes });
      setNewNote("");
    } catch (error) {
      console.error("Failed to add note:", error);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (index: number) => {
    if (!routine || !user) return;
    try {
      const updatedNotes = routine.notes?.filter((_, i) => i !== index) || [];
      await updateRoutine(routine.id, { notes: updatedNotes });
      setRoutine({ ...routine, notes: updatedNotes });
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  const currentEvent = useMemo(() => {
    if (!routine || activeSegmentIndex < 0) return null;
    return routine.events[activeSegmentIndex] || null;
  }, [routine, activeSegmentIndex]);

  // Find the currently active audio track and its offset
  const activeAudio = useMemo(() => {
    if (!routine) return { url: null, offset: 0 };
    let url = routine.audioUrl || null;
    let offset = 0;

    for (let i = 0; i <= activeSegmentIndex; i++) {
      if (routine.events[i] && routine.events[i].audioUrl) {
        url = routine.events[i].audioUrl as string;
        offset = routine.events.slice(0, i).reduce((sum, e) => sum + e.timestamp, 0);
      }
    }
    return { url, offset };
  }, [routine, activeSegmentIndex]);

  // Manual Navigation
  const jumpToSegment = (index: number) => {
    if (!routine || index < 0 || index >= routine.events.length) return;
    setActiveSegmentIndex(index);
    
    // Calculate the absolute time to jump to by summing all previous durations
    const targetTime = routine.events
      .slice(0, index)
      .reduce((sum, e) => sum + e.timestamp, 0);
      
    setCurrentTime(targetTime);
    
    // If we have an active audio track, we need to seek the audio player to the relative time
    if (syncAudio && activeAudio.url) {
      let relativeTime = targetTime;
      // Recalculate offset for the target index
      let targetOffset = 0;
      for (let i = 0; i <= index; i++) {
        if (routine.events[i].audioUrl) {
          targetOffset = routine.events.slice(0, i).reduce((sum, e) => sum + e.timestamp, 0);
        }
      }
      relativeTime = targetTime - targetOffset;
      
      setSeekTo(relativeTime);
      setTimeout(() => setSeekTo(undefined), 50);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-belt-black">
        <div className="animate-spin w-12 h-12 border-4 border-belt-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!routine) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-belt-black p-4">
        <h2 className="text-xl font-bold text-belt-white mb-4">Routine not found</h2>
        <Link href="/stage" className="btn-primary">Back to Stage</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-belt-black flex flex-col">
      {/* Header */}
      <div className="bg-belt-dark/80 backdrop-blur-md border-b border-belt-gray/30 p-3 md:p-4 sticky top-16 z-30">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/stage" className="text-belt-white/40 hover:text-belt-white text-lg">←</Link>
            <div>
              <h1 className="text-sm md:text-xl font-black text-belt-white uppercase italic tracking-tighter truncate max-w-[120px] md:max-w-none">
                {routine.name}
              </h1>
              <div className="flex items-center gap-2 md:gap-4">
                <span className="text-[8px] md:text-[10px] text-belt-gold font-bold uppercase tracking-widest whitespace-nowrap">
                  {isPlaying ? "● On Air" : "○ Stby"}
                </span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={syncAudio}
                      onChange={(e) => setSyncAudio(e.target.checked)}
                      className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-belt-gray border-none text-belt-red focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[8px] md:text-[9px] font-black text-belt-white/30 group-hover:text-belt-white transition-colors uppercase tracking-widest">Sync Audio</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={autoAdvance}
                      onChange={(e) => setAutoAdvance(e.target.checked)}
                      className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-belt-gray border-none text-belt-gold focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[8px] md:text-[9px] font-black text-belt-white/30 group-hover:text-belt-gold transition-colors uppercase tracking-widest">Auto Advance</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-6">
            <div className="flex gap-1 bg-belt-gray/20 p-1 rounded-lg border border-belt-gray/50 shadow-inner">
              <button 
                onClick={() => jumpToSegment(activeSegmentIndex - 1)}
                disabled={activeSegmentIndex <= 0}
                className="px-2 md:px-4 py-1 bg-belt-gray hover:bg-belt-red text-[9px] md:text-[11px] font-black uppercase rounded transition-colors disabled:opacity-10"
              >
                Prev
              </button>
              <button 
                onClick={() => jumpToSegment(activeSegmentIndex + 1)}
                disabled={activeSegmentIndex >= routine.events.length - 1}
                className="px-2 md:px-4 py-1 bg-belt-gray hover:bg-belt-red text-[9px] md:text-[11px] font-black uppercase rounded transition-colors disabled:opacity-10"
              >
                Next
              </button>
            </div>
            <div className="text-lg md:text-2xl font-mono font-bold text-belt-white w-14 md:w-20 text-right">
              {currentTime.toFixed(1)}s
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-3 md:p-8 overflow-y-auto pb-32">
        <div className="max-w-[1800px] mx-auto flex flex-col gap-4 md:gap-8">
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-4 px-12">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-belt-red/20" />
              <span className="text-[8px] md:text-[10px] font-bold text-belt-red uppercase tracking-[0.4em] italic opacity-60">Audience / Front</span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-belt-red/20" />
            </div>

            <div className="w-full">
              <div className="card w-full aspect-[3/1] relative bg-[#0a0a0a] border-2 md:border-[8px] border-belt-gray/40 overflow-hidden shadow-2xl rounded-xl md:rounded-3xl">
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 -translate-y-1/2" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2" />
                </div>

                {currentEvent?.formations && Object.entries(currentEvent.formations).map(([memberId, pos]) => {
                  const member = allMembers.find(m => m.id === memberId);
                  return (
                    <div
                      key={memberId}
                      className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-[1500ms] ease-in-out"
                      style={{ 
                        left: `${pos.x}%`, 
                        top: `${pos.y}%`,
                        width: '3.5%',
                        aspectRatio: '1/1'
                      }}
                    >
                      <div className="w-full h-full rounded-full bg-belt-gold border-[1.5px] md:border-2 border-belt-black flex flex-col items-center justify-center shadow-2xl ring-1 md:ring-2 ring-belt-gold/20">
                        <span className="text-belt-black font-black text-[max(6px,0.6vw)]">
                          {member?.name.split(" ").map(n => n[0]).join("") || "??"}
                        </span>
                      </div>
                      {pos.action && (
                        <div className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap bg-belt-black/90 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg border border-belt-gray/30 text-[6px] md:text-[8px] font-black text-belt-gold uppercase tracking-widest shadow-xl z-20 ${pos.y > 65 ? "bottom-full mb-2 md:mb-3" : "top-full mt-2 md:mt-3"}`}>
                          {pos.action}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!currentEvent?.formations && (
                  <div className="absolute inset-0 flex items-center justify-center text-belt-white/10 text-[10px] md:text-sm font-black uppercase tracking-[0.3em]">
                    Standing By...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            <div className="lg:col-span-8 space-y-6 md:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-belt-white uppercase tracking-widest">Add Note</h3>
                  <form onSubmit={handleAddNote} className="flex gap-2">
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Comment..."
                      className="input-field flex-1 text-xs py-2.5 md:py-3"
                    />
                    <button 
                      type="submit"
                      disabled={savingNote || !newNote.trim()}
                      className="btn-primary px-4 md:px-6 text-[10px] md:text-xs font-black uppercase disabled:opacity-30"
                    >
                      {savingNote ? "..." : "Add"}
                    </button>
                  </form>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-belt-white uppercase tracking-widest flex items-center justify-between">
                    <span>Performance Archive</span>
                    <span className="text-belt-gold">{routine.notes?.length || 0}</span>
                  </h3>
                  <div className="card bg-belt-dark/40 max-h-40 md:max-h-56 overflow-y-auto pr-3 custom-scrollbar space-y-3">
                    {routine.notes?.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((note, i) => (
                      <div key={i} className="text-[10px] md:text-xs pb-3 md:pb-4 border-b border-belt-gray/30 last:border-0 last:pb-0 flex justify-between items-start gap-4 group/note">
                        <div className="flex-1">
                          <p className="text-belt-white/80 leading-relaxed">{note.content}</p>
                          <span className="text-[8px] text-belt-white/20 uppercase font-black mt-1 block tracking-widest">
                            {new Date(note.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleDeleteNote(i)}
                          className="opacity-0 group-hover/note:opacity-100 text-belt-white/20 hover:text-red-500 transition-all p-1.5"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6 md:space-y-8">
              <div className={`card p-6 md:p-8 border-2 transition-all duration-500 ${currentEvent ? "border-belt-red bg-belt-red/5" : "border-belt-gray"}`}>
                <p className="text-[8px] md:text-[10px] font-black text-belt-gold uppercase tracking-[0.2em] mb-4 md:mb-6">Active Segment</p>
                <h2 className="text-xl md:text-4xl font-black text-belt-white uppercase italic leading-tight tracking-tighter">
                  {currentEvent?.label || "Ready"}
                </h2>
                <div className="mt-4 md:mt-6 flex flex-wrap gap-2">
                   <span className="bg-belt-red text-white text-[8px] md:text-[10px] font-black px-2 md:px-3 py-1 rounded-full uppercase tracking-widest">
                    {currentEvent?.type || "STBY"}
                  </span>
                </div>
              </div>

              <div className="card p-4 md:p-6 bg-belt-dark/60 border-belt-gray/20">
                {activeAudio.url ? (
                  <AudioPlayer
                    url={activeAudio.url}
                    isPlaying={isPlaying}
                    onTogglePlay={setIsPlaying}
                    onTimeUpdate={(time) => {
                      if (seekTo === undefined) {
                        setCurrentTime(activeAudio.offset + time);
                      }
                    }}
                    onEnded={() => setIsPlaying(false)}
                    seekTo={seekTo}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 md:gap-6">
                    <div className="flex gap-2 md:gap-4 w-full">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`btn-primary flex-1 h-10 md:h-14 font-black uppercase tracking-widest text-[10px] md:text-xs ${isPlaying ? "bg-belt-gray" : "bg-belt-red"}`}
                      >
                        {isPlaying ? "Pause" : "Launch"}
                      </button>
                      <button
                        onClick={() => {
                          setIsPlaying(false);
                          setCurrentTime(0);
                        }}
                        className="btn-secondary h-10 md:h-14 px-4 md:px-6 text-[10px]"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="card p-4 md:p-6 bg-belt-dark/40 border-belt-gray/10 max-h-[300px] md:max-h-[400px] overflow-y-auto custom-scrollbar">
                <p className="text-[9px] md:text-[11px] font-black text-belt-white/30 uppercase tracking-[0.2em] mb-4 md:mb-6">Sequence</p>
                <div className="space-y-2 md:space-y-3">
                  {routine.events.map((event, idx) => (
                    <button
                      key={idx}
                      onClick={() => jumpToSegment(idx)}
                      className={`w-full text-left p-3 md:p-4 rounded-xl border-2 transition-all ${
                        activeSegmentIndex === idx 
                          ? "bg-belt-red/20 border-belt-red text-belt-white" 
                          : "bg-belt-gray/10 border-transparent text-belt-white/30 hover:text-belt-white/60"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-wider">{event.label}</span>
                        <span className="font-mono text-[8px] md:text-[10px] font-bold text-belt-gold">{event.timestamp.toFixed(1)}s len</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
