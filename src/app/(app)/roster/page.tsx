"use client";

import { useEffect, useState } from "react";
import { getAllMembers, Member } from "@/lib/firebase/firestore";
import RosterGrid from "@/components/roster/RosterGrid";
import MemberModal from "@/components/roster/MemberModal";
import { useAuth } from "@/contexts/AuthContext";

export default function RosterPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const { isAdmin } = useAuth();

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

  const handleAddMember = () => {
    setEditingMember(null);
    setShowModal(true);
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setShowModal(true);
  };

  const handleAttendanceToggle = async (memberId: string, present: boolean) => {
    // Optimistic update
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, _attendancePresent: present } : m
      )
    );

    // TODO: Save attendance record to Firestore
    console.log(`Attendance toggled for ${memberId}: ${present ? "Present" : "Absent"}`);
  };

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-belt-white">Roster</h1>
          <p className="text-belt-white/60 mt-1">
            {members.filter((m) => m.status === "active").length} active members
          </p>
        </div>
        {isAdmin && (
          <button onClick={handleAddMember} className="btn-primary">
            <span className="text-xl mr-2">+</span> Add Member
          </button>
        )}
      </div>

      {/* Attendance Date Selector */}
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-belt-white/60">Attendance Date</p>
            <p className="text-lg font-semibold text-belt-white">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <input
            type="date"
            className="bg-belt-gray border border-gray-700 rounded-lg px-4 py-2 text-belt-white min-h-[48px]"
            defaultValue={new Date().toISOString().split("T")[0]}
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
          {isAdmin && (
            <button onClick={handleAddMember} className="btn-primary mt-4">
              Add Your First Member
            </button>
          )}
        </div>
      )}

      {!loading && members.length > 0 && (
        <RosterGrid
          members={members}
          onToggleAttendance={handleAttendanceToggle}
          onEditMember={isAdmin ? handleEditMember : undefined}
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
