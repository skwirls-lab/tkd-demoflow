"use client";

import { useEffect, useState } from "react";
import { getAllMembers, Member, addAttendanceRecord } from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

export default function AttendanceHistoryPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const { user } = useAuth();

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const data = await getAllMembers();
      setMembers(data);
    } catch (error) {
      console.error("Failed to load members:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (memberId: string) => {
    const next = !attendance[memberId];
    setAttendance((prev) => ({ ...prev, [memberId]: next }));

    if (user) {
      try {
        await addAttendanceRecord(memberId, {
          date: selectedDate,
          present: next,
          recordedBy: user.uid,
        });
      } catch (error) {
        console.error("Failed to save attendance:", error);
      }
    }
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const markedCount = Object.keys(attendance).length;

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-belt-white">Attendance</h1>
          <p className="text-belt-white/60 mt-1">
            {markedCount}/{members.length} marked • {presentCount} present
          </p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-belt-gray border border-gray-700 rounded-lg px-4 py-3 text-belt-white min-h-[48px]"
        />
      </div>

      {/* Progress Bar */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-belt-white/60">Progress</span>
          <span className="text-sm font-semibold text-belt-white">
            {markedCount}/{members.length}
          </span>
        </div>
        <div className="w-full bg-belt-gray rounded-full h-3">
          <div
            className="bg-belt-red h-3 rounded-full transition-all duration-300"
            style={{ width: `${members.length > 0 ? (markedCount / members.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card animate-pulse flex items-center gap-4">
              <div className="w-12 h-12 bg-belt-gray rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-belt-gray rounded w-1/3 mb-2" />
                <div className="h-3 bg-belt-gray rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Member List */}
      {!loading && (
        <div className="space-y-3">
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => handleToggle(member.id)}
              className={`card w-full flex items-center gap-4 transition-all ${
                attendance[member.id]
                  ? "ring-2 ring-green-500"
                  : attendance[member.id] === false
                    ? "ring-2 ring-red-500"
                    : "hover:ring-1 hover:ring-gray-600"
              }`}
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full overflow-hidden bg-belt-gray flex-shrink-0">
                {member.photoUrl ? (
                  <img
                    src={member.photoUrl}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span>🥋</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-left">
                <p className="font-semibold text-belt-white">{member.name}</p>
                <p className="text-sm text-belt-white/50">{member.rank}</p>
              </div>

              {/* Status Indicator */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  attendance[member.id]
                    ? "bg-green-500"
                    : attendance[member.id] === false
                      ? "bg-red-500"
                      : "bg-belt-gray"
                }`}
              >
                {attendance[member.id] ? (
                  <span className="text-white">✓</span>
                ) : attendance[member.id] === false ? (
                  <span className="text-white">✗</span>
                ) : (
                  <span className="text-belt-white/30">○</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
