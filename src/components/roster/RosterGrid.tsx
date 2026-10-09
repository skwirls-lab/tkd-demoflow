"use client";

import { Member } from "@/lib/firebase/firestore";

interface RosterGridProps {
  members: (Member & { _attendancePresent?: boolean })[];
  onToggleAttendance: (memberId: string, present: boolean) => void;
  onEditMember?: (member: Member) => void;
}

export default function RosterGrid({
  members,
  onToggleAttendance,
  onEditMember,
}: RosterGridProps) {
  // Unmarked -> Present -> Absent -> Present ...
  const handleToggle = (member: Member & { _attendancePresent?: boolean }) => {
    const next = member._attendancePresent === undefined ? true : !member._attendancePresent;
    onToggleAttendance(member.id, next);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
      {members.map((member) => {
        const isPresent = member._attendancePresent;
        const inactive = member.status !== "active";
        return (
          <div key={member.id} className="relative">
            <button
              onClick={() => handleToggle(member)}
              className={`w-full relative rounded-xl overflow-hidden transition-all duration-200 touch-target text-left ${
                isPresent === undefined
                  ? "ring-2 ring-gray-600 opacity-70"
                  : isPresent
                    ? "ring-[3px] ring-green-500 opacity-100"
                    : "ring-[3px] ring-red-500 opacity-60"
              }`}
              aria-label={`${member.name} - ${
                isPresent === undefined ? "Not marked" : isPresent ? "Present" : "Absent"
              }. Tap to change.`}
            >
              {/* Photo */}
              <div className="aspect-square relative overflow-hidden bg-belt-gray">
                {member.photoUrl ? (
                  <img
                    src={member.photoUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl">🥋</span>
                  </div>
                )}

                {/* Status badge */}
                {isPresent !== undefined && (
                  <div className="absolute bottom-2 left-2">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg ${
                        isPresent ? "bg-green-500" : "bg-red-500"
                      }`}
                    >
                      <span className="text-white text-lg font-bold">{isPresent ? "✓" : "✗"}</span>
                    </div>
                  </div>
                )}
                {inactive && (
                  <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-widest bg-black/70 text-belt-white/70 px-1.5 py-0.5 rounded">
                    {member.status}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-3 bg-belt-dark">
                <p className="font-semibold text-belt-white text-sm truncate">{member.name}</p>
                <p className="text-xs text-belt-white/50 truncate">{member.rank}</p>
                {member.specialty && (
                  <p className="text-xs text-belt-gold/70 mt-1 truncate">{member.specialty}</p>
                )}
              </div>
            </button>

            {/* Edit: a separate, always-visible button (not nested in the toggle) */}
            {onEditMember && (
              <button
                onClick={() => onEditMember(member)}
                className="absolute top-1.5 right-1.5 w-10 h-10 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center"
                aria-label={`Edit ${member.name}`}
              >
                <span className="text-sm">✏️</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
