"use client";

import { useState, useRef, useEffect } from "react";
import { Member } from "@/lib/firebase/firestore";

interface Position {
  x: number;
  y: number;
  action?: string;
}

interface FormationDesignerProps {
  members: Member[];
  formation: Record<string, Position>;
  onChange: (formation: Record<string, Position>) => void;
}

export default function FormationDesigner({ members, formation, onChange }: FormationDesignerProps) {
  const matRef = useRef<HTMLDivElement>(null);
  const [draggingMemberId, setDraggingMemberId] = useState<string | null>(null);

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setDraggingMemberId(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingMemberId || !matRef.current) return;

    const rect = matRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const constrainedX = Math.max(0, Math.min(100, x));
    const constrainedY = Math.max(0, Math.min(100, y));

    onChange({
      ...formation,
      [draggingMemberId]: {
        ...formation[draggingMemberId],
        x: constrainedX,
        y: constrainedY,
      },
    });
  };

  const handleMouseUp = () => {
    setDraggingMemberId(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setDraggingMemberId(null);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  const availableMembers = members.filter(m => !formation[m.id]);

  return (
    <div className="flex flex-col gap-4 h-full w-full">
      {/* Sidebar: Unplaced Members */}
      <div className="w-full bg-belt-dark/60 rounded-2xl border border-belt-gray/30 p-3 shadow-xl flex flex-col md:flex-row gap-4 items-center">
        <div className="flex flex-col items-center md:items-start shrink-0">
          <h3 className="text-[10px] font-black text-belt-gold uppercase tracking-[0.2em] whitespace-nowrap">Roster</h3>
          <span className="text-[9px] text-belt-white/30 font-bold uppercase">{availableMembers.length} Available</span>
        </div>
        <div className="flex-1 flex flex-wrap justify-center md:justify-start gap-2 overflow-y-auto max-h-24 md:max-h-20 custom-scrollbar">
          {availableMembers.map(member => (
            <div
              key={member.id}
              onClick={() => onChange({ ...formation, [member.id]: { x: 50, y: 50 } })}
              className="flex items-center gap-1 px-2 py-1 bg-belt-gray/20 hover:bg-belt-red/20 border border-belt-gray/50 rounded-full cursor-pointer transition-all active:scale-95"
            >
              <div className="w-4 h-4 rounded-full bg-belt-gray flex items-center justify-center text-[7px] font-black shrink-0">
                {member.name.split(" ").map(n => n[0]).join("")}
              </div>
              <span className="text-[9px] font-bold text-belt-white whitespace-nowrap uppercase tracking-tighter">{member.name}</span>
            </div>
          ))}
          {availableMembers.length === 0 && (
            <p className="text-[9px] text-belt-white/20 italic uppercase py-1">Full team on floor</p>
          )}
        </div>
        <button 
          onClick={() => {
            if (confirm("Clear floor?")) onChange({});
          }}
          className="text-[9px] text-belt-red font-black uppercase tracking-widest hover:text-red-400 bg-belt-red/5 px-4 py-2 rounded-xl border border-belt-red/10 whitespace-nowrap"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {/* Front Label (OUTSIDE GRID) */}
        <div className="flex items-center justify-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-belt-red/20" />
          <span className="text-[9px] font-bold text-belt-red uppercase tracking-[0.4em] italic opacity-60">Audience / Front</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-belt-red/20" />
        </div>

        {/* Main Mat */}
        <div className="w-full relative aspect-[3/1] bg-[#0a0a0a] rounded-xl md:rounded-3xl border-2 md:border-4 border-belt-gray/40 overflow-hidden shadow-2xl cursor-crosshair select-none"
            ref={matRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              backgroundImage: "radial-gradient(circle, #222 1px, transparent 1px)",
              backgroundSize: "5% 15%"
            }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 -translate-y-1/2" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2" />
            </div>

            {/* Members (PERCENTAGE SIZED) */}
            {Object.entries(formation).map(([id, pos]) => {
              const member = members.find(m => m.id === id);
              if (!member) return null;

              return (
                <div
                  key={id}
                  onMouseDown={(e) => handleMouseDown(e, id)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-shadow ${
                    draggingMemberId === id ? "z-50 cursor-grabbing" : "z-10 cursor-grab"
                  }`}
                  style={{ 
                    left: `${pos.x}%`, 
                    top: `${pos.y}%`,
                    width: '3.5%', 
                    aspectRatio: '1/1'
                  }}
                >
                  <div className={`w-full h-full rounded-full border-[1.5px] md:border-2 flex items-center justify-center shadow-xl transition-all ${
                    draggingMemberId === id ? "bg-belt-red border-white ring-4 ring-belt-red/20" : "bg-belt-gold border-belt-black"
                  }`}>
                    <span className="text-belt-black font-black text-[max(6px,0.6vw)] leading-none">
                      {member.name.split(" ").map(n => n[0]).join("")}
                    </span>
                  </div>

                  {/* Popover */}
                  <div className={`absolute left-1/2 -translate-x-1/2 bg-belt-black/95 border border-belt-gray/50 rounded-lg p-2 min-w-[120px] md:min-w-[160px] shadow-2xl transition-all z-30 ${
                    draggingMemberId === id ? "opacity-0" : "opacity-0 group-hover:opacity-100"
                  } ${pos.y > 65 ? "bottom-full mb-2" : "top-full mt-2"}`}>
                    <p className="text-[8px] md:text-[10px] font-black text-belt-white uppercase mb-1 tracking-widest">{member.name}</p>
                    <input
                      type="text"
                      value={pos.action || ""}
                      onChange={(e) => {
                        e.stopPropagation();
                        onChange({ ...formation, [id]: { ...pos, action: e.target.value } });
                      }}
                      onMouseDown={e => e.stopPropagation()}
                      placeholder="Action..."
                      className="w-full bg-belt-gray/40 border-none text-[9px] md:text-[10px] text-belt-gold px-2 py-1 rounded outline-none"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newFormation = { ...formation };
                        delete newFormation[id];
                        onChange(newFormation);
                      }}
                      className="w-full mt-2 text-[8px] font-black text-red-500/50 hover:text-red-500 uppercase p-1 transition-all"
                    >
                      Remove
                    </button>
                  </div>
                  
                  {/* Action Badge */}
                  {pos.action && !draggingMemberId && (
                    <div className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap bg-belt-black/80 backdrop-blur-sm px-2 py-0.5 rounded border border-belt-gold/20 text-[6px] md:text-[8px] font-black text-belt-gold uppercase tracking-tighter pointer-events-none group-hover:opacity-0 transition-opacity ${pos.y > 65 ? "-top-5 md:-top-7" : "-bottom-5 md:-bottom-7"}`}>
                      {pos.action}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      </div>
    </div>
  );
}
