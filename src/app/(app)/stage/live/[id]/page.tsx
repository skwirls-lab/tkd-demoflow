"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  getRoutine,
  Routine,
  RoutineEvent,
  RoutineNote,
  getAllMembers,
  Member,
  getAllAudioTracks,
  addRoutineNote,
  removeRoutineNote,
} from "@/lib/firebase/firestore";
import AudioPlayer, { SeekRequest } from "@/components/stage/AudioPlayer";
import { useAuth } from "@/contexts/AuthContext";
import { getMemberLabels } from "@/lib/members";
import Link from "next/link";

// Which song is playing at a given segment: the most recent segment at or
// before it with a trigger track, otherwise the routine's main track.
const trackFor = (routine: Routine, index: number) => {
  let url: string | null = routine.audioUrl || null;
  let startIndex = 0;
  for (let i = 0; i <= index && i < routine.events.length; i++) {
    if (routine.events[i].audioUrl) {
      url = routine.events[i].audioUrl as string;
      startIndex = i;
    }
  }
  return { url, startIndex };
};

const sumDurations = (events: RoutineEvent[], from: number, to: number) =>
  events.slice(from, to).reduce((sum, e) => sum + (e.timestamp || 0), 0);

const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
};

// Keep the phone screen on while the live screen is open.
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
        } else {
          lock = sentinel;
        }
      } catch {
        // Not supported or denied (e.g. low battery mode) - nothing to do.
      }
    };

    // The browser drops the lock whenever the page is hidden; re-acquire it.
    const onVisibility = () => {
      if (document.visibilityState === "visible") request();
    };

    request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
    };
  }, []);
}

export default function LiveRoutinePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [trackNames, setTrackNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // Time spent in the current segment. Drives auto-advance.
  const [segmentElapsed, setSegmentElapsed] = useState(0);
  // Total time since Play, for reference only.
  const [showElapsed, setShowElapsed] = useState(0);
  // Off by default on purpose: segments rarely line up exactly with the music,
  // so manual Prev/Next should not move the song.
  const [syncAudio, setSyncAudio] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [seekRequest, setSeekRequest] = useState<SeekRequest | null>(null);

  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const audioDrivesRef = useRef(false);
  const pendingSeekRef = useRef<{ time: number; at: number } | null>(null);
  const sequenceRef = useRef<HTMLDivElement>(null);

  useWakeLock();

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [routineData, members, tracks] = await Promise.all([
          getRoutine(id as string),
          getAllMembers(),
          getAllAudioTracks().catch(() => []),
        ]);
        setRoutine(routineData);
        setAllMembers(members);
        setTrackNames(Object.fromEntries(tracks.map((t) => [t.url, t.name])));
      } catch (error) {
        console.error("Failed to load routine:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const events = routine?.events || [];
  const currentEvent = events[activeIndex] || null;
  const nextEvent = events[activeIndex + 1] || null;
  const activeTrack = useMemo(
    () => (routine ? trackFor(routine, activeIndex) : { url: null, startIndex: 0 }),
    [routine, activeIndex]
  );
  const memberLabels = useMemo(() => getMemberLabels(allMembers), [allMembers]);

  // With Sync on and a song playing, the song position is the one clock for
  // the segment. Otherwise a real-time stopwatch is. Never both.
  audioDrivesRef.current = syncAudio && !!activeTrack.url;

  // Stopwatch: measures real elapsed time, so it doesn't drift or stall when
  // the phone throttles timers.
  useEffect(() => {
    if (!isPlaying) return;
    let last = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setShowElapsed((t) => t + dt);
      if (!audioDrivesRef.current) setSegmentElapsed((t) => t + dt);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Auto-advance once a segment has run for its planned duration. The timer
  // restarts whenever a new segment begins (manually or automatically).
  // Segments with no duration (0) wait for a manual Next.
  useEffect(() => {
    if (!isPlaying || !autoAdvance || !currentEvent) return;
    const duration = currentEvent.timestamp || 0;
    if (duration > 0 && segmentElapsed >= duration && activeIndex < events.length - 1) {
      setActiveIndex(activeIndex + 1);
      setSegmentElapsed(segmentElapsed - duration);
    }
  }, [segmentElapsed, isPlaying, autoAdvance, currentEvent, activeIndex, events.length]);

  // Keep the active segment visible in the sequence list (without scrolling the page).
  useEffect(() => {
    const container = sequenceRef.current;
    const item = container?.children[activeIndex] as HTMLElement | undefined;
    if (container && item) {
      container.scrollTo({
        top: item.offsetTop - container.clientHeight / 2 + item.clientHeight / 2,
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  const requestSeek = (time: number) => {
    pendingSeekRef.current = { time, at: Date.now() };
    setSeekRequest({ time, id: Date.now() });
  };

  const handleAudioTime = (time: number) => {
    if (!routine || !syncAudio) return;

    // Ignore stale updates that arrive before a requested seek lands.
    const pending = pendingSeekRef.current;
    if (pending) {
      if (Math.abs(time - pending.time) > 0.75 && Date.now() - pending.at < 2000) return;
      pendingSeekRef.current = null;
    }

    const { startIndex } = activeTrack;
    let index = activeIndex;
    let segmentStart = sumDurations(events, startIndex, index);
    // Music scrubbed backwards: follow it back to the matching segment.
    while (index > startIndex && time < segmentStart) {
      index--;
      segmentStart = sumDurations(events, startIndex, index);
    }
    if (index !== activeIndex) setActiveIndex(index);
    setSegmentElapsed(Math.max(0, time - segmentStart));
  };

  const jumpToSegment = useCallback(
    (index: number) => {
      if (!routine || index < 0 || index >= routine.events.length) return;
      setActiveIndex(index);
      setSegmentElapsed(0);

      if (syncAudio) {
        const track = trackFor(routine, index);
        if (track.url) requestSeek(sumDurations(routine.events, track.startIndex, index));
      }
    },
    [routine, syncAudio]
  );

  const handleReset = () => {
    if (showElapsed > 0 && !confirm("Reset to the first segment and restart the music?")) return;
    setIsPlaying(false);
    setActiveIndex(0);
    setSegmentElapsed(0);
    setShowElapsed(0);
    requestSeek(0);
  };

  // Keyboard shortcuts for laptops: Space = play/pause, arrows = prev/next.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === "ArrowRight") {
        jumpToSegment(activeIndex + 1);
      } else if (e.key === "ArrowLeft") {
        jumpToSegment(activeIndex - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, jumpToSegment]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !routine || !newNote.trim()) return;

    setSavingNote(true);
    try {
      const note: RoutineNote = {
        authorId: user.uid,
        content: newNote.trim(),
        timestamp: new Date().toISOString(),
      };
      await addRoutineNote(routine.id, note);
      setRoutine({ ...routine, notes: [...(routine.notes || []), note] });
      setNewNote("");
    } catch (error) {
      console.error("Failed to add note:", error);
      alert("Couldn't save the note. Check your connection and try again.");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (note: RoutineNote) => {
    if (!routine || !confirm("Delete this note?")) return;
    try {
      await removeRoutineNote(routine.id, note);
      setRoutine({ ...routine, notes: (routine.notes || []).filter((n) => n !== note) });
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  const sortedNotes = useMemo(
    () =>
      [...(routine?.notes || [])].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [routine?.notes]
  );

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

  const duration = currentEvent?.timestamp || 0;
  const overTime = duration > 0 && segmentElapsed > duration;
  const progress = duration > 0 ? Math.min(100, (segmentElapsed / duration) * 100) : 0;

  return (
    <div className="min-h-screen bg-belt-black flex flex-col">
      {/* Header */}
      <div className="sticky-subheader z-30 bg-belt-dark/90 backdrop-blur-md border-b border-belt-gray/30 px-3 py-2 md:px-6 md:py-3">
        <div className="max-w-[1800px] mx-auto flex items-center gap-3">
          <Link
            href="/stage"
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-belt-gray/40 text-belt-white/70 hover:text-belt-white text-lg"
            aria-label="Back to Stage"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base md:text-xl font-black text-belt-white uppercase italic tracking-tighter truncate">
              {routine.name}
            </h1>
            <span
              className={`block truncate text-[11px] font-bold uppercase tracking-wider ${
                isPlaying ? "text-belt-red" : "text-belt-white/40"
              }`}
            >
              {isPlaying ? "● On Air" : "○ Ready"} · {formatClock(showElapsed)}
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setSyncAudio(!syncAudio)}
              aria-pressed={syncAudio}
              className={`h-11 px-3 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider border transition-colors ${
                syncAudio
                  ? "bg-belt-red/20 border-belt-red text-belt-white"
                  : "bg-belt-gray/30 border-belt-gray text-belt-white/50"
              }`}
              title="When on, jumping to a segment also moves the music to that point"
            >
              Sync<span className="hidden sm:inline"> music</span>: {syncAudio ? "On" : "Off"}
            </button>
            <button
              onClick={() => setAutoAdvance(!autoAdvance)}
              aria-pressed={autoAdvance}
              className={`h-11 px-3 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider border transition-colors ${
                autoAdvance
                  ? "bg-belt-gold/15 border-belt-gold text-belt-gold"
                  : "bg-belt-gray/30 border-belt-gray text-belt-white/50"
              }`}
              title="When on, a segment moves to the next one after its planned duration"
            >
              Auto<span className="hidden sm:inline">-advance</span>: {autoAdvance ? "On" : "Off"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-3 md:p-8 pb-40 md:pb-40">
        <div className="max-w-[1800px] mx-auto flex flex-col gap-4 md:gap-8">
          {/* Mat */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center gap-4 px-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-belt-red/20" />
              <span className="text-[9px] md:text-[10px] font-bold text-belt-red uppercase tracking-[0.4em] italic opacity-60">
                Audience / Front
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-belt-red/20" />
            </div>

            <div className="stage-mat w-full relative bg-[#0a0a0a] border-2 md:border-[6px] border-belt-gray/40 overflow-hidden shadow-2xl rounded-xl md:rounded-3xl">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 -translate-y-1/2" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2" />
              </div>

              {currentEvent?.formations &&
                Object.entries(currentEvent.formations).map(([memberId, pos]) => (
                  <div
                    key={memberId}
                    className="stage-dot absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-[1500ms] ease-in-out"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  >
                    <div className="w-full h-full rounded-full bg-belt-gold border-[1.5px] md:border-2 border-belt-black flex items-center justify-center shadow-2xl">
                      <span className="stage-dot-label text-belt-black font-black">
                        {memberLabels[memberId] || "??"}
                      </span>
                    </div>
                    {pos.action && (
                      <div
                        className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap bg-belt-black/90 px-1.5 py-0.5 rounded border border-belt-gray/30 text-[8px] md:text-[10px] font-black text-belt-gold uppercase tracking-wider shadow-xl z-20 ${
                          pos.y > 65 ? "bottom-full mb-1" : "top-full mt-1"
                        }`}
                      >
                        {pos.action}
                      </div>
                    )}
                  </div>
                ))}

              {(!currentEvent?.formations || Object.keys(currentEvent.formations).length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center text-belt-white/20 text-[10px] md:text-sm font-black uppercase tracking-[0.3em]">
                  No formation set
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
            {/* Now / Next + Music */}
            <div className="lg:col-span-7 space-y-4">
              <div className={`card border-2 ${overTime ? "border-belt-gold" : "border-belt-red"} bg-belt-red/5`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-black text-belt-gold uppercase tracking-[0.2em]">
                    Now · {activeIndex + 1}/{events.length}
                  </p>
                  <p className={`font-mono font-bold text-sm md:text-lg ${overTime ? "text-belt-gold" : "text-belt-white"}`}>
                    {segmentElapsed.toFixed(1)}s{duration > 0 ? ` / ${duration}s` : ""}
                  </p>
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-belt-white uppercase italic leading-tight tracking-tighter break-words">
                  {currentEvent?.label || "Ready"}
                </h2>
                {duration > 0 ? (
                  <div className="mt-3 h-2 w-full bg-belt-gray rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-[width] duration-100 ${overTime ? "bg-belt-gold" : "bg-belt-red"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-belt-white/40 uppercase tracking-widest font-bold">
                    Manual — tap Next when ready
                  </p>
                )}
                <div className="mt-4 pt-3 border-t border-belt-gray/40 flex items-baseline gap-3">
                  <span className="text-[11px] font-black text-belt-white/40 uppercase tracking-[0.2em] shrink-0">Next</span>
                  <span className="text-lg md:text-2xl font-black text-belt-white/70 uppercase italic truncate">
                    {nextEvent ? nextEvent.label : "End of routine"}
                  </span>
                </div>
              </div>

              {activeTrack.url && (
                <div className="card bg-belt-dark/60">
                  <AudioPlayer
                    url={activeTrack.url}
                    label={trackNames[activeTrack.url]}
                    isPlaying={isPlaying}
                    onTimeUpdate={handleAudioTime}
                    seekRequest={seekRequest}
                  />
                </div>
              )}
            </div>

            {/* Sequence */}
            <div className="lg:col-span-5">
              <div className="card bg-belt-dark/40">
                <p className="text-[11px] font-black text-belt-white/40 uppercase tracking-[0.2em] mb-3">Sequence</p>
                <div ref={sequenceRef} className="relative space-y-2 max-h-[320px] md:max-h-[420px] overflow-y-auto pr-1">
                  {events.map((event, idx) => (
                    <button
                      key={idx}
                      onClick={() => jumpToSegment(idx)}
                      className={`w-full text-left px-3 py-3 rounded-xl border-2 transition-all min-h-[48px] ${
                        activeIndex === idx
                          ? "bg-belt-red/20 border-belt-red text-belt-white"
                          : idx < activeIndex
                            ? "bg-belt-gray/10 border-transparent text-belt-white/30"
                            : "bg-belt-gray/20 border-transparent text-belt-white/70 hover:text-belt-white"
                      }`}
                    >
                      <div className="flex justify-between items-center gap-3">
                        <span className="text-xs md:text-sm font-black uppercase tracking-wider truncate">
                          <span className="text-belt-white/30 mr-2">{idx + 1}</span>
                          {event.audioUrl && <span className="mr-1" title="Starts a track">♪</span>}
                          {event.label}
                        </span>
                        <span className="font-mono text-[10px] md:text-xs font-bold text-belt-gold shrink-0">
                          {event.timestamp > 0 ? `${event.timestamp}s` : "manual"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-3">
              <h3 className="text-[11px] font-black text-belt-white uppercase tracking-widest">Add Note</h3>
              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="e.g. Seg 4 spacing too tight"
                  className="input-field flex-1 text-sm"
                />
                <button
                  type="submit"
                  disabled={savingNote || !newNote.trim()}
                  className="btn-primary px-5 text-xs font-black uppercase disabled:opacity-30"
                >
                  {savingNote ? "..." : "Add"}
                </button>
              </form>
            </div>

            <div className="space-y-3">
              <h3 className="text-[11px] font-black text-belt-white uppercase tracking-widest flex items-center justify-between">
                <span>Performance Notes</span>
                <span className="text-belt-gold">{sortedNotes.length}</span>
              </h3>
              <div className="card bg-belt-dark/40 max-h-56 overflow-y-auto space-y-3">
                {sortedNotes.length === 0 && (
                  <p className="text-xs text-belt-white/30 italic">No notes yet.</p>
                )}
                {sortedNotes.map((note) => (
                  <div
                    key={`${note.timestamp}-${note.content}`}
                    className="text-xs md:text-sm pb-3 border-b border-belt-gray/30 last:border-0 last:pb-0 flex justify-between items-start gap-3 group"
                  >
                    <div className="flex-1">
                      <p className="text-belt-white/80 leading-relaxed">{note.content}</p>
                      <span className="text-[10px] text-belt-white/30 uppercase font-black mt-1 block tracking-widest">
                        {new Date(note.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note)}
                      className="hover-reveal w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-belt-white/30 hover:text-red-500 hover:bg-red-500/10"
                      aria-label="Delete note"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom control bar */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-belt-dark/95 backdrop-blur-md border-t border-gray-800 pt-3 px-3 safe-bottom-pad">
        <div className="max-w-xl mx-auto flex items-center gap-2">
          <button
            onClick={handleReset}
            className="w-14 h-14 shrink-0 rounded-xl bg-belt-gray/50 text-belt-white/60 hover:text-belt-white text-[10px] font-black uppercase tracking-wider active:scale-95"
            aria-label="Reset to start"
          >
            ↺<br />Reset
          </button>
          <button
            onClick={() => jumpToSegment(activeIndex - 1)}
            disabled={activeIndex <= 0}
            className="flex-1 h-14 rounded-xl bg-belt-gray text-belt-white font-black uppercase tracking-wider text-sm active:scale-95 disabled:opacity-25"
          >
            ◀ Prev
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex-[1.3] h-16 rounded-2xl font-black uppercase tracking-widest text-base shadow-lg active:scale-95 ${
              isPlaying ? "bg-belt-white text-belt-black" : "bg-belt-red text-white"
            }`}
          >
            {isPlaying ? "❚❚ Pause" : showElapsed > 0 ? "▶ Resume" : "▶ Go"}
          </button>
          <button
            onClick={() => jumpToSegment(activeIndex + 1)}
            disabled={activeIndex >= events.length - 1}
            className="flex-1 h-14 rounded-xl bg-belt-gray text-belt-white font-black uppercase tracking-wider text-sm active:scale-95 disabled:opacity-25"
          >
            Next ▶
          </button>
        </div>
      </div>
    </div>
  );
}
