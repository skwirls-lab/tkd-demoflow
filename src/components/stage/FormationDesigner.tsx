"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Member } from "@/lib/firebase/firestore";
import { getMemberLabels } from "@/lib/members";

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

// Movement (px) before a press counts as a drag instead of a tap.
const DRAG_THRESHOLD = 5;

// Pick a free spot for a newly added member instead of stacking everyone at
// the center: walk rows from the middle outwards, columns from center out.
const findOpenSpot = (formation: Record<string, Position>): { x: number; y: number } => {
  const taken = Object.values(formation);
  const rows = [50, 30, 70, 15, 85];
  const cols = [50, 42, 58, 34, 66, 26, 74, 18, 82, 10, 90];
  for (const y of rows) {
    for (const x of cols) {
      if (!taken.some((p) => Math.abs(p.x - x) < 5 && Math.abs(p.y - y) < 10)) {
        return { x, y };
      }
    }
  }
  return { x: 50, y: 50 };
};

export default function FormationDesigner({ members, formation, onChange }: FormationDesignerProps) {
  const matRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pressRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);

  const labels = useMemo(() => getMemberLabels(members), [members]);
  const availableMembers = members.filter((m) => !formation[m.id]);
  const selectedMember = selectedId ? members.find((m) => m.id === selectedId) : null;
  const selectedPos = selectedId ? formation[selectedId] : null;

  // Deselect if the selected member is removed (or the segment changes).
  useEffect(() => {
    if (selectedId && !formation[selectedId]) setSelectedId(null);
  }, [formation, selectedId]);

  const positionFromPointer = (clientX: number, clientY: number) => {
    const rect = matRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pressRef.current = { id, startX: e.clientX, startY: e.clientY, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const press = pressRef.current;
    if (!press || !matRef.current) return;
    if (!press.moved) {
      if (Math.hypot(e.clientX - press.startX, e.clientY - press.startY) < DRAG_THRESHOLD) return;
      press.moved = true;
      setDraggingId(press.id);
    }
    const { x, y } = positionFromPointer(e.clientX, e.clientY);
    onChange({ ...formation, [press.id]: { ...formation[press.id], x, y } });
  };

  const handlePointerUp = () => {
    const press = pressRef.current;
    pressRef.current = null;
    setDraggingId(null);
    // A tap (no drag) selects / deselects the member.
    if (press && !press.moved) {
      setSelectedId((current) => (current === press.id ? null : press.id));
    }
  };

  const addMember = (memberId: string) => {
    onChange({ ...formation, [memberId]: findOpenSpot(formation) });
  };

  const addAll = () => {
    const next = { ...formation };
    availableMembers.forEach((m) => {
      next[m.id] = findOpenSpot(next);
    });
    onChange(next);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    const next = { ...formation };
    delete next[selectedId];
    onChange(next);
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Unplaced members */}
      <div className="w-full bg-belt-dark/60 rounded-2xl border border-belt-gray/30 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-black text-belt-gold uppercase tracking-[0.2em]">Roster</h3>
            <span className="text-[10px] text-belt-white/40 font-bold uppercase">
              {availableMembers.length} not placed · tap to add
            </span>
          </div>
          <div className="flex gap-2">
            {availableMembers.length > 0 && (
              <button
                onClick={addAll}
                className="h-9 px-3 text-[10px] text-belt-white font-black uppercase tracking-widest bg-belt-gray/50 hover:bg-belt-gray rounded-lg"
              >
                Add all
              </button>
            )}
            <button
              onClick={() => {
                if (Object.keys(formation).length && confirm("Clear everyone off the floor for this segment?")) onChange({});
              }}
              className="h-9 px-3 text-[10px] text-belt-red font-black uppercase tracking-widest bg-belt-red/5 hover:bg-belt-red/10 rounded-lg border border-belt-red/20"
            >
              Clear floor
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
          {availableMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => addMember(member.id)}
              className="flex items-center gap-1.5 pl-1 pr-3 h-9 bg-belt-gray/30 hover:bg-belt-red/20 border border-belt-gray/50 rounded-full transition-all active:scale-95"
            >
              <span className="w-7 h-7 rounded-full bg-belt-gray flex items-center justify-center text-[9px] font-black shrink-0">
                {labels[member.id]}
              </span>
              <span className="text-xs font-bold text-belt-white whitespace-nowrap">{member.name}</span>
            </button>
          ))}
          {availableMembers.length === 0 && (
            <p className="text-[11px] text-belt-white/30 italic uppercase py-1">Full team on floor</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-belt-red/20" />
          <span className="text-[9px] font-bold text-belt-red uppercase tracking-[0.4em] italic opacity-60">Audience / Front</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-belt-red/20" />
        </div>

        {/* Mat */}
        <div
          ref={matRef}
          onPointerDown={() => setSelectedId(null)}
          className="stage-mat w-full relative bg-[#0a0a0a] rounded-xl md:rounded-3xl border-2 md:border-4 border-belt-gray/40 overflow-hidden shadow-2xl select-none touch-none"
          style={{
            backgroundImage: "radial-gradient(circle, #222 1px, transparent 1px)",
            backgroundSize: "5% 15%",
          }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 -translate-y-1/2" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2" />
          </div>

          {Object.entries(formation).map(([id, pos]) => {
            const member = members.find((m) => m.id === id);
            if (!member) return null;
            const isDragging = draggingId === id;
            const isSelected = selectedId === id;

            return (
              <div
                key={id}
                onPointerDown={(e) => handlePointerDown(e, id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`stage-dot absolute -translate-x-1/2 -translate-y-1/2 touch-none ${
                  isDragging ? "z-50 cursor-grabbing" : isSelected ? "z-40 cursor-grab" : "z-10 cursor-grab"
                }`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <div
                  className={`w-full h-full rounded-full border-[1.5px] md:border-2 flex items-center justify-center shadow-xl transition-colors ${
                    isDragging
                      ? "bg-belt-red border-white ring-4 ring-belt-red/30"
                      : isSelected
                        ? "bg-belt-gold border-white ring-4 ring-white/30"
                        : "bg-belt-gold border-belt-black"
                  }`}
                >
                  <span className="stage-dot-label text-belt-black font-black">{labels[id]}</span>
                </div>

                {pos.action && !isDragging && (
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap bg-belt-black/80 px-1.5 py-0.5 rounded border border-belt-gold/20 text-[8px] md:text-[10px] font-black text-belt-gold uppercase tracking-tight pointer-events-none ${
                      pos.y > 65 ? "bottom-full mb-1" : "top-full mt-1"
                    }`}
                  >
                    {pos.action}
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(formation).length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-belt-white/20 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] pointer-events-none">
              Tap names above to place them
            </div>
          )}
        </div>
      </div>

      {/* Selected member editor (below the mat so it never gets clipped) */}
      {selectedMember && selectedPos ? (
        <div className="card p-3 flex flex-col sm:flex-row sm:items-center gap-2 border-belt-gold/40">
          <p className="text-xs font-black text-belt-white uppercase tracking-widest shrink-0 sm:w-40 truncate">
            {selectedMember.name}
          </p>
          <input
            type="text"
            value={selectedPos.action || ""}
            onChange={(e) =>
              onChange({ ...formation, [selectedMember.id]: { ...selectedPos, action: e.target.value } })
            }
            placeholder="Action (e.g. jump spin, hold board)"
            className="input-field flex-1 text-sm min-h-[44px] py-2"
          />
          <div className="flex gap-2">
            <button
              onClick={removeSelected}
              className="flex-1 sm:flex-none h-11 px-4 text-[11px] font-black text-red-400 uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 rounded-lg"
            >
              Remove
            </button>
            <button
              onClick={() => setSelectedId(null)}
              className="flex-1 sm:flex-none h-11 px-4 text-[11px] font-black text-belt-white uppercase tracking-widest bg-belt-gray hover:bg-gray-700 rounded-lg"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        Object.keys(formation).length > 0 && (
          <p className="text-[10px] text-belt-white/30 uppercase tracking-widest text-center">
            Drag to move · tap a dot to add an action or remove
          </p>
        )
      )}
    </div>
  );
}
