"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  addRoutine, 
  getRoutine, 
  updateRoutine, 
  Routine, 
  RoutineEvent, 
  getAllMembers, 
  Member,
  getAllAudioTracks,
  AudioTrack
} from "@/lib/firebase/firestore";
import FormationDesigner from "@/components/stage/FormationDesigner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAudio } from "@/lib/firebase/storage";
import Link from "next/link";

export default function RoutineBuilderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [name, setName] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [events, setEvents] = useState<RoutineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"setup" | "marking" | "editing">("setup");
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [libraryTracks, setLibraryTracks] = useState<AudioTrack[]>([]);

  useEffect(() => {
    loadMembers();
    loadLibrary();
    if (editId) {
      loadRoutine();
    } else {
      setLoading(false);
    }
  }, [editId]);

  const loadLibrary = async () => {
    const tracks = await getAllAudioTracks();
    setLibraryTracks(tracks);
  };

  const loadMembers = async () => {
    const data = await getAllMembers();
    setAllMembers(data);
  };

  const loadRoutine = async () => {
    try {
      const data = await getRoutine(editId as string);
      if (data) {
        setName(data.name);
        setAudioUrl(data.audioUrl || "");
        setEvents(data.events || []);
        setStep("editing");
        if (data.events.length > 0) setSelectedEventIndex(0);
      }
    } catch (error) {
      console.error("Failed to load routine:", error);
    } finally {
      setLoading(false);
    }
  };

  const addSegment = () => {
    // If in marking mode, we use currentTime, otherwise default to a 5s segment
    const duration = step === "marking" ? currentTime : 5.0;
    
    const newEvent: RoutineEvent = {
      timestamp: duration,
      label: `Segment ${events.length + 1}`,
      type: "formation",
      formations: events.length > 0 ? { ...events[events.length - 1].formations } : {}
    };

    const newEvents = [...events, newEvent];
    setEvents(newEvents);
    setSelectedEventIndex(newEvents.length - 1);
  };

  const updateEvent = (index: number, updates: Partial<RoutineEvent>) => {
    const newEvents = [...events];
    newEvents[index] = { ...newEvents[index], ...updates };
    setEvents(newEvents);
  };

  const removeEvent = (index: number) => {
    setEvents(events.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name || !user) return;
    try {
      const routineData = {
        name,
        audioUrl,
        events,
        updatedAt: new Date().toISOString(),
      };

      if (editId) {
        await updateRoutine(editId, routineData);
      } else {
        await addRoutine({
          ...routineData,
          authorId: user.uid,
          notes: []
        });
      }
      router.push("/stage");
    } catch (error) {
      console.error("Failed to save routine:", error);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-belt-black">
      <div className="bg-belt-dark/80 backdrop-blur-md border-b border-belt-gray/30 p-3 md:p-4 sticky top-16 z-30">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 md:gap-4 truncate">
            <Link href="/stage" className="text-belt-white/40 hover:text-belt-white text-xs md:text-sm whitespace-nowrap">← LIBRARY</Link>
            <h1 className="text-sm md:text-2xl font-black text-belt-white uppercase italic tracking-tighter truncate">
              {editId ? "Edit Routine" : "Build Routine"}
            </h1>
          </div>
          <button 
            onClick={handleSave}
            className="px-4 md:px-8 py-2 md:py-3 bg-belt-red text-white text-[10px] md:text-sm font-black uppercase tracking-widest rounded-full shadow-lg active:scale-95 transition-all whitespace-nowrap"
          >
            Save
          </button>
        </div>
      </div>

      <div className="px-3 py-6 md:py-8 max-w-[1800px] mx-auto pb-32">
        {/* STEP 1: SETUP */}
        {step === "setup" && (
          <div className="max-w-xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              <h2 className="text-[10px] font-black text-belt-gold uppercase tracking-[0.3em]">Routine Basics</h2>
              <div className="card space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-belt-white/30 uppercase mb-2 tracking-widest">Routine Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. World Expo 2026"
                    className="input-field"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-belt-white/30 uppercase tracking-widest">Main Audio Track (Optional)</label>
                  <select
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    className="input-field text-xs uppercase cursor-pointer"
                  >
                    <option value="">-- No Audio / Silent --</option>
                    {libraryTracks.map(t => (
                      <option key={t.id} value={t.url}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => {
                setStep("editing");
                if (events.length === 0) addSegment();
              }}
              disabled={!name.trim()}
              className="btn-primary w-full py-4 text-sm md:text-base font-black uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Start Designing →
            </button>
          </div>
        )}

        {/* STEP 2: MARKING */}
        {step === "marking" && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="card flex flex-col items-center gap-4 py-8 bg-belt-dark/80 border-belt-gold/20">
              <div className="text-4xl md:text-6xl font-mono font-black text-belt-white tracking-widest">
                {currentTime.toFixed(1)}s
              </div>
              <div className="flex gap-4">
                <button onClick={() => setIsPlaying(!isPlaying)} className={`btn-primary px-8 ${isPlaying ? "bg-belt-gray" : "bg-belt-red"}`}>
                  {isPlaying ? "Pause" : "Start"}
                </button>
                <button onClick={() => { setIsPlaying(false); setCurrentTime(0); }} className="btn-secondary">Reset</button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-8 pt-4">
              <button
                onClick={addSegment}
                className="w-40 h-40 md:w-56 md:h-56 rounded-full bg-belt-red shadow-2xl flex flex-col items-center justify-center active:scale-95 transition-transform border-[8px] md:border-[12px] border-belt-black ring-8 ring-belt-red/10"
              >
                <span className="text-white font-black text-lg md:text-2xl tracking-widest uppercase italic">Mark</span>
              </button>

              <button 
                onClick={() => { setIsPlaying(false); setStep("editing"); }} 
                className="btn-primary w-full py-4 font-black uppercase tracking-widest text-xs md:text-sm"
              >
                Design {events.length} Segments →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: FORMATION STUDIO */}
        {step === "editing" && (
          <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-belt-dark/40 p-4 rounded-2xl border border-belt-gray/20 gap-4">
              <div className="flex items-center gap-4 md:gap-8">
                <div className="flex flex-col">
                  <span className="text-[8px] md:text-[10px] font-black text-belt-white/30 uppercase tracking-widest">Routine Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-transparent border-none text-belt-white font-black p-0 focus:ring-0 text-sm md:text-lg uppercase italic"
                  />
                </div>
                <div className="w-px h-8 md:h-10 bg-belt-gray/30" />
                <div className="flex flex-col">
                  <span className="text-[8px] md:text-[10px] font-black text-belt-white/30 uppercase tracking-widest">Segments</span>
                  <span className="text-belt-gold font-black text-sm md:text-lg">{events.length}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addSegment} className="flex-1 md:flex-none px-4 py-2 bg-belt-gray/50 hover:bg-belt-gray text-belt-white text-[9px] md:text-[11px] font-black uppercase rounded-xl border border-belt-gray/50 transition-all">
                  + Segment
                </button>
                <button onClick={handleSave} className="flex-1 md:flex-none px-6 py-2 bg-belt-red text-white text-[9px] md:text-[11px] font-black uppercase rounded-xl shadow-lg transition-all active:scale-95">
                  Save
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 md:gap-8 items-start">
              {/* Sidebar (RESPONSIVE) */}
              <div className="w-full lg:w-72 space-y-3 shrink-0 order-2 lg:order-1">
                <div className="text-[10px] font-black text-belt-white/20 uppercase tracking-[0.2em] px-2">Sequence</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-1 gap-3 max-h-[300px] lg:max-h-[1000px] overflow-y-auto pr-2 custom-scrollbar">
                  {events.map((event, index) => (
                    <div 
                      key={index} 
                      onClick={() => setSelectedEventIndex(index)}
                      className={`card p-3 md:p-4 cursor-pointer transition-all border-l-4 relative overflow-hidden group/item ${
                        selectedEventIndex === index 
                          ? "border-belt-red bg-belt-red/5" 
                          : "border-belt-gray/50 bg-belt-dark/20"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <input
                          type="number"
                          step="0.1"
                          value={event.timestamp}
                          onClick={e => e.stopPropagation()}
                          onChange={(e) => updateEvent(index, { timestamp: parseFloat(e.target.value) || 0 })}
                          className="bg-belt-gray/30 px-1.5 py-0.5 rounded font-mono text-[9px] text-belt-gold w-12 md:w-16 border-none"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEvent(index);
                            if (selectedEventIndex === index) setSelectedEventIndex(null);
                          }}
                          className="text-belt-white/10 group-hover/item:text-red-500 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                      <input
                        type="text"
                        value={event.label}
                        onClick={e => e.stopPropagation()}
                        onChange={(e) => updateEvent(index, { label: e.target.value })}
                        className="bg-transparent border-none text-belt-white font-black p-0 focus:ring-0 text-[10px] md:text-[11px] uppercase tracking-wider w-full"
                      />
                      {/* Per-segment Audio Upload */}
                      <div className="mt-3 pt-3 border-t border-belt-gray/20">
                         <label className="block text-[8px] font-black text-belt-white/20 uppercase tracking-widest mb-1">Trigger Track</label>
                         <select
                           value={event.audioUrl || ""}
                           onClick={e => e.stopPropagation()}
                           onChange={(e) => updateEvent(index, { audioUrl: e.target.value || undefined })}
                           className="w-full bg-belt-gray/30 border-none rounded text-[8px] text-belt-white font-bold uppercase p-1.5 focus:ring-1 focus:ring-belt-red cursor-pointer truncate"
                         >
                           <option value="">-- Continue Previous --</option>
                           {libraryTracks.map(t => (
                             <option key={t.id} value={t.url}>{t.name}</option>
                           ))}
                         </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Designer (RESPONSIVE) */}
              <div className="flex-1 w-full order-1 lg:order-2">
                {selectedEventIndex !== null ? (
                  <div className="space-y-3 md:space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between px-4 py-2 bg-belt-dark/20 rounded-xl border border-belt-gray/10">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-2 h-2 bg-belt-red rounded-full animate-pulse" />
                        <h3 className="font-black text-belt-white uppercase tracking-widest text-[10px] md:text-sm italic truncate max-w-[150px] md:max-w-none">
                          {events[selectedEventIndex].label}
                        </h3>
                      </div>
                    </div>
                    
                    <div className="w-full">
                      <FormationDesigner
                        members={allMembers}
                        formation={events[selectedEventIndex].formations || {}}
                        onChange={(formation) => updateEvent(selectedEventIndex, { formations: formation })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-[300px] md:h-[600px] flex flex-col items-center justify-center bg-belt-dark/20 border-2 border-dashed border-belt-gray/10 rounded-3xl text-center p-8">
                    <p className="text-belt-white/30 text-[10px] md:text-sm uppercase tracking-widest">Select segment to design</p>
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
