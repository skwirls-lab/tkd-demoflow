"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addRoutine,
  getRoutine,
  updateRoutine,
  RoutineEvent,
  getAllMembers,
  Member,
  getAllAudioTracks,
  AudioTrack,
} from "@/lib/firebase/firestore";
import FormationDesigner from "@/components/stage/FormationDesigner";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

const cloneFormation = (formation: RoutineEvent["formations"]) =>
  Object.fromEntries(Object.entries(formation || {}).map(([id, pos]) => [id, { ...pos }]));

export default function RoutineBuilderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [name, setName] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [events, setEvents] = useState<RoutineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"setup" | "editing">("setup");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [libraryTracks, setLibraryTracks] = useState<AudioTrack[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    getAllMembers().then(setAllMembers).catch(console.error);
    getAllAudioTracks().then(setLibraryTracks).catch(console.error);

    if (!editId) {
      setLoading(false);
      return;
    }
    getRoutine(editId)
      .then((data) => {
        if (data) {
          setName(data.name);
          setAudioUrl(data.audioUrl || "");
          setEvents(data.events || []);
          setStep("editing");
          if (data.events?.length > 0) setSelectedIndex(0);
        }
      })
      .catch((error) => console.error("Failed to load routine:", error))
      .finally(() => setLoading(false));
  }, [editId]);

  // Warn before losing unsaved work: browser refresh/close, and in-app links
  // (nav bar, back link). Capture phase runs before Next's Link handler.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (anchor && !confirm("You have unsaved changes. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  // A selection can point past the end after deletes; treat that as none.
  const selected = selectedIndex !== null && selectedIndex < events.length ? selectedIndex : null;
  const selectedEvent = selected !== null ? events[selected] : null;

  useEffect(() => {
    if (selected !== null) {
      chipRefs.current[selected]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selected]);

  // Only active members are offered, plus anyone already placed in this segment.
  const designerMembers = useMemo(() => {
    const placed = selectedEvent?.formations || {};
    return allMembers.filter((m) => m.status === "active" || placed[m.id]);
  }, [allMembers, selectedEvent]);

  const trackName = (url?: string) => libraryTracks.find((t) => t.url === url)?.name;

  const commit = (next: RoutineEvent[], select?: number | null) => {
    setEvents(next);
    setDirty(true);
    if (select !== undefined) setSelectedIndex(select);
  };

  const updateEvent = (index: number, updates: Partial<RoutineEvent>) => {
    const next = [...events];
    next[index] = { ...next[index], ...updates };
    commit(next);
  };

  // Insert a new segment after `afterIndex` (or at the end), starting from
  // that segment's formation so you only tweak what changes.
  const insertSegment = (afterIndex: number | null) => {
    const base = afterIndex !== null ? events[afterIndex] : events[events.length - 1];
    const newEvent: RoutineEvent = {
      timestamp: 0,
      label: `Segment ${events.length + 1}`,
      type: "formation",
      formations: cloneFormation(base?.formations),
    };
    const at = afterIndex !== null ? afterIndex + 1 : events.length;
    const next = [...events.slice(0, at), newEvent, ...events.slice(at)];
    commit(next, at);
  };

  const duplicateSegment = (index: number) => {
    const source = events[index];
    const copy: RoutineEvent = { ...source, label: `${source.label} (copy)`, formations: cloneFormation(source.formations) };
    delete copy.audioUrl; // a copy shouldn't restart the song
    const next = [...events.slice(0, index + 1), copy, ...events.slice(index + 1)];
    commit(next, index + 1);
  };

  const moveSegment = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= events.length) return;
    const next = [...events];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next, target);
  };

  const deleteSegment = (index: number) => {
    if (!confirm(`Delete "${events[index].label}"?`)) return;
    const next = events.filter((_, i) => i !== index);
    commit(next, next.length === 0 ? null : Math.min(index, next.length - 1));
  };

  const copyFormationToNext = (index: number) => {
    if (index >= events.length - 1) return;
    if (!confirm(`Replace the formation in "${events[index + 1].label}" with this one?`)) return;
    const next = [...events];
    next[index + 1] = { ...next[index + 1], formations: cloneFormation(events[index].formations) };
    commit(next);
  };

  const handleSave = async () => {
    if (saving || !user) return;
    if (!name.trim()) {
      alert("Give the routine a name first.");
      return;
    }
    setSaving(true);
    try {
      const routineData = {
        name: name.trim(),
        audioUrl,
        events,
        updatedAt: new Date().toISOString(),
      };

      if (editId) {
        await updateRoutine(editId, routineData);
      } else {
        await addRoutine({ ...routineData, authorId: user.uid, notes: [] });
      }
      setDirty(false);
      router.push("/stage");
    } catch (error) {
      console.error("Failed to save routine:", error);
      alert("Save failed. Check your connection and try again — your changes are still here.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-belt-red border-t-transparent rounded-full" />
      </div>
    );
  }

  const smallBtn =
    "h-10 px-3 rounded-lg bg-belt-gray/50 hover:bg-belt-gray text-belt-white text-[10px] md:text-[11px] font-black uppercase tracking-wider disabled:opacity-25 active:scale-95 transition-all";

  return (
    <div className="min-h-screen bg-belt-black">
      <div className="sticky-subheader z-30 bg-belt-dark/90 backdrop-blur-md border-b border-belt-gray/30 px-3 py-2 md:px-4 md:py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Link href="/stage" className="h-11 px-3 flex items-center rounded-lg bg-belt-gray/40 text-belt-white/60 hover:text-belt-white text-xs font-bold whitespace-nowrap">
              ← Stage
            </Link>
            <h1 className="text-sm md:text-2xl font-black text-belt-white uppercase italic tracking-tighter truncate">
              {editId ? "Edit Routine" : "Build Routine"}
            </h1>
            {dirty && <span className="text-[10px] text-belt-gold font-bold uppercase tracking-widest whitespace-nowrap">● Unsaved</span>}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-11 px-6 md:px-8 bg-belt-red text-white text-xs md:text-sm font-black uppercase tracking-widest rounded-full shadow-lg active:scale-95 transition-all whitespace-nowrap disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="px-3 py-4 md:py-8 max-w-[1800px] mx-auto pb-32">
        {/* STEP 1: SETUP */}
        {step === "setup" && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="space-y-4">
              <h2 className="text-[11px] font-black text-belt-gold uppercase tracking-[0.3em]">Routine Basics</h2>
              <div className="card space-y-6">
                <div>
                  <label htmlFor="routine-name" className="block text-[11px] font-black text-belt-white/40 uppercase mb-2 tracking-widest">Routine Name</label>
                  <input
                    id="routine-name"
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setDirty(true); }}
                    placeholder="e.g. Fall Festival 2026"
                    className="input-field"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="routine-audio" className="block text-[11px] font-black text-belt-white/40 uppercase tracking-widest">Main Audio Track (Optional)</label>
                  <select
                    id="routine-audio"
                    value={audioUrl}
                    onChange={(e) => { setAudioUrl(e.target.value); setDirty(true); }}
                    className="input-field cursor-pointer"
                  >
                    <option value="">— No Audio / Silent —</option>
                    {libraryTracks.map((t) => (
                      <option key={t.id} value={t.url}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setStep("editing");
                if (events.length === 0) insertSegment(null);
              }}
              disabled={!name.trim()}
              className="btn-primary w-full py-4 text-sm md:text-base font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Start Designing →
            </button>
          </div>
        )}

        {/* STEP 2: FORMATION STUDIO */}
        {step === "editing" && (
          <div className="space-y-4 md:space-y-6">
            {/* Routine settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-belt-dark/40 p-3 md:p-4 rounded-2xl border border-belt-gray/20">
              <div>
                <label htmlFor="routine-name-edit" className="block text-[10px] font-black text-belt-white/40 uppercase tracking-widest mb-1">Routine Name</label>
                <input
                  id="routine-name-edit"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setDirty(true); }}
                  className="input-field min-h-[44px] py-2 font-black uppercase italic"
                />
              </div>
              <div>
                <label htmlFor="routine-audio-edit" className="block text-[10px] font-black text-belt-white/40 uppercase tracking-widest mb-1">Main Track</label>
                <select
                  id="routine-audio-edit"
                  value={audioUrl}
                  onChange={(e) => { setAudioUrl(e.target.value); setDirty(true); }}
                  className="input-field min-h-[44px] py-2 cursor-pointer"
                >
                  <option value="">— No Audio / Silent —</option>
                  {libraryTracks.map((t) => (
                    <option key={t.id} value={t.url}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 md:gap-8 items-start">
              {/* Segment list: horizontal strip on phones, sidebar on desktop */}
              <div className="w-full lg:w-72 shrink-0">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-[11px] font-black text-belt-white/40 uppercase tracking-[0.2em]">
                    Sequence · {events.length}
                  </span>
                </div>
                <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:max-h-[70vh] lg:overflow-y-auto no-scrollbar pb-1 snap-x">
                  {events.map((event, index) => (
                    <button
                      key={index}
                      ref={(el) => { chipRefs.current[index] = el; }}
                      onClick={() => setSelectedIndex(index)}
                      className={`snap-center shrink-0 w-40 lg:w-full text-left rounded-xl border-2 px-3 py-2 transition-all ${
                        selected === index
                          ? "border-belt-red bg-belt-red/10"
                          : "border-belt-gray/40 bg-belt-dark/40 hover:border-belt-gray"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                        <span className="text-belt-white/40">#{index + 1}</span>
                        <span className="text-belt-gold">
                          {event.audioUrl && <span className="mr-1">♪</span>}
                          {event.timestamp > 0 ? `${event.timestamp}s` : "manual"}
                        </span>
                      </div>
                      <p className="text-xs font-black text-belt-white uppercase tracking-wide truncate mt-0.5">
                        {event.label || "Untitled"}
                      </p>
                    </button>
                  ))}
                  <button
                    onClick={() => insertSegment(null)}
                    className="snap-center shrink-0 w-28 lg:w-full rounded-xl border-2 border-dashed border-belt-gray/50 text-belt-white/50 hover:text-belt-white hover:border-belt-gray text-xs font-black uppercase tracking-widest py-3"
                  >
                    + Segment
                  </button>
                </div>
              </div>

              {/* Selected segment */}
              <div className="flex-1 w-full min-w-0">
                {selectedEvent && selected !== null ? (
                  <div className="space-y-4">
                    <div className="card p-3 md:p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-[1fr_140px_1fr] gap-3">
                        <div className="col-span-2 md:col-span-1">
                          <label htmlFor="seg-label" className="block text-[10px] font-black text-belt-white/40 uppercase tracking-widest mb-1">
                            Segment {selected + 1} name
                          </label>
                          <input
                            id="seg-label"
                            type="text"
                            value={selectedEvent.label}
                            onChange={(e) => updateEvent(selected, { label: e.target.value })}
                            className="input-field min-h-[44px] py-2 font-black uppercase"
                          />
                        </div>
                        <div>
                          <label htmlFor="seg-duration" className="block text-[10px] font-black text-belt-white/40 uppercase tracking-widest mb-1">
                            Duration (sec)
                          </label>
                          <input
                            id="seg-duration"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.5"
                            value={selectedEvent.timestamp || ""}
                            placeholder="manual"
                            onChange={(e) => updateEvent(selected, { timestamp: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="input-field min-h-[44px] py-2 font-mono text-belt-gold"
                          />
                        </div>
                        <div>
                          <label htmlFor="seg-track" className="block text-[10px] font-black text-belt-white/40 uppercase tracking-widest mb-1">
                            Music
                          </label>
                          <select
                            id="seg-track"
                            value={selectedEvent.audioUrl || ""}
                            onChange={(e) => updateEvent(selected, { audioUrl: e.target.value || undefined })}
                            className="input-field min-h-[44px] py-2 text-sm cursor-pointer"
                          >
                            <option value="">Keep current song</option>
                            {libraryTracks.map((t) => (
                              <option key={t.id} value={t.url}>Start: {t.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="text-[10px] text-belt-white/30">
                        Leave duration empty for segments you&apos;ll advance by hand. With Auto-advance on, a timed segment moves on after this many seconds.
                        {selectedEvent.audioUrl && trackName(selectedEvent.audioUrl) && (
                          <> This segment starts <span className="text-belt-white/60">{trackName(selectedEvent.audioUrl)}</span>.</>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button onClick={() => moveSegment(selected, -1)} disabled={selected === 0} className={smallBtn} aria-label="Move earlier">
                          ◀ Move
                        </button>
                        <button onClick={() => moveSegment(selected, 1)} disabled={selected === events.length - 1} className={smallBtn} aria-label="Move later">
                          Move ▶
                        </button>
                        <button onClick={() => insertSegment(selected)} className={smallBtn}>
                          + Insert after
                        </button>
                        <button onClick={() => duplicateSegment(selected)} className={smallBtn}>
                          Duplicate
                        </button>
                        <button onClick={() => copyFormationToNext(selected)} disabled={selected === events.length - 1} className={smallBtn}>
                          Copy formation → next
                        </button>
                        <button
                          onClick={() => deleteSegment(selected)}
                          className="h-10 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] md:text-[11px] font-black uppercase tracking-wider ml-auto active:scale-95"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <FormationDesigner
                      key={selected}
                      members={designerMembers}
                      formation={selectedEvent.formations || {}}
                      onChange={(formation) => updateEvent(selected, { formations: formation })}
                    />
                  </div>
                ) : (
                  <div className="h-[240px] md:h-[500px] flex flex-col items-center justify-center gap-4 bg-belt-dark/20 border-2 border-dashed border-belt-gray/20 rounded-3xl text-center p-8">
                    <p className="text-belt-white/40 text-xs md:text-sm uppercase tracking-widest">
                      {events.length ? "Select a segment to design" : "No segments yet"}
                    </p>
                    {!events.length && (
                      <button onClick={() => insertSegment(null)} className="btn-primary">+ Add first segment</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
