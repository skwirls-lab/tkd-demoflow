"use client";

import { useEffect, useState } from "react";
import { getAllMembers, Member, getAttendanceForDate, saveAttendanceRecord } from "@/lib/firebase/firestore";
import RosterGrid from "@/components/roster/RosterGrid";
import MemberModal from "@/components/roster/MemberModal";
import { useAuth } from "@/contexts/AuthContext";

export default function RosterPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const { user } = useAuth();

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [selectedDate]);

  const loadAttendance = async () => {
    try {
      const records = await getAttendanceForDate(selectedDate);
      setAttendance(records);
    } catch (error) {
      console.error("Failed to load attendance:", error);
    }
  };

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

  const handleAddMember = () => {
    setEditingMember(null);
    setShowModal(true);
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setShowModal(true);
  };

  const handleAttendanceToggle = async (memberId: string, present: boolean) => {
    if (!user) return;

    // Optimistic update
    setAttendance((prev) => ({ ...prev, [memberId]: present }));

    try {
      await saveAttendanceRecord(memberId, selectedDate, present, user.uid);
    } catch (error) {
      console.error("Failed to save attendance:", error);
      // Revert on error
      loadAttendance();
    }
  };

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-belt-white">Roster</h1>
          <p className="text-belt-white/60 mt-1">
            {members.filter((m) => m.status === "active").length} active members
          </p>
        </div>
        <button onClick={handleAddMember} className="btn-primary">
          <span className="text-xl mr-2">+</span> Add Member
        </button>
      </div>

      {/* Attendance Date Selector */}
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-belt-white/60">Attendance Date</p>
            <p className="text-lg font-semibold text-belt-white">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-belt-gray border border-gray-700 rounded-lg px-4 py-2 text-belt-white min-h-[48px]"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-belt-dark rounded-xl p-4 animate-pulse"
            >
              <div className="aspect-square bg-belt-gray rounded-lg mb-3" />
              <div className="h-4 bg-belt-gray rounded w-3/4 mb-2" />
              <div className="h-3 bg-belt-gray rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Member Grid */}
      {!loading && members.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-4xl mb-4">🥋</p>
          <p className="text-belt-white/60 text-lg">No members yet</p>
          <button onClick={handleAddMember} className="btn-primary mt-4">
            Add Your First Member
          </button>
        </div>
      )}

      {!loading && members.length > 0 && (
        <RosterGrid
          members={members.map(m => ({ ...m, _attendancePresent: attendance[m.id] }))}
          onToggleAttendance={handleAttendanceToggle}
          onEditMember={handleEditMember}
        />
      )}

      {/* Member Modal */}
      {showModal && (
        <MemberModal
          member={editingMember}
          onClose={() => setShowModal(false)}
          onSave={loadMembers}
        />
      )}
    </div>
  );
}
