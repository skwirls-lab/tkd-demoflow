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
  const handleToggle = (member: Member & { _attendancePresent?: boolean }) => {
    const next = member._attendancePresent === undefined ? true : !member._attendancePresent;
    onToggleAttendance(member.id, next);
  };

  const handleEdit = (e: React.MouseEvent, member: Member) => {
    e.stopPropagation();
    onEditMember?.(member);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {members.map((member) => {
        const isPresent = member._attendancePresent;
        return (
          <button
            key={member.id}
            onClick={() => handleToggle(member)}
            className={`relative rounded-xl overflow-hidden transition-all duration-200 touch-target text-left group ${
              isPresent === undefined
                ? "ring-2 ring-gray-600 opacity-60"
                : isPresent
                  ? "ring-2 ring-green-500 opacity-100"
                  : "ring-2 ring-red-500 opacity-60"
            }`}
            aria-label={`${member.name} - ${
              isPresent === undefined
                ? "Not marked"
                : isPresent
                  ? "Present"
                  : "Absent"
            }`}
          >
            {/* Photo */}
            <div className="aspect-square relative overflow-hidden bg-belt-gray">
              {member.photoUrl ? (
                <img
                  src={member.photoUrl}
                  alt={member.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl">🥋</span>
                </div>
              )}

              {/* Status Overlay */}
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                  isPresent === undefined ? "opacity-0" : "opacity-40"
                }`}
              >
                {isPresent === true && (
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl">✓</span>
                  </div>
                )}
                {isPresent === false && (
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl">✗</span>
                  </div>
                )}
              </div>

              {/* Edit Button (Admin Only) */}
              {onEditMember && (
                <div
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleEdit(e, member)}
                >
                  <div className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center cursor-pointer touch-target">
                    <span className="text-sm">✏️</span>
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3 bg-belt-dark">
              <p className="font-semibold text-belt-white text-sm truncate">
                {member.name}
              </p>
              <p className="text-xs text-belt-white/50">{member.rank}</p>
              {member.specialty && (
                <p className="text-xs text-belt-gold/70 mt-1 truncate">
                  {member.specialty}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
