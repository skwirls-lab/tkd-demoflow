"use client";

import { useEffect, useState } from "react";
import { getAllMembers, Member, getAttendanceForDate, saveAttendanceRecord, getAllAttendanceRecords, GlobalAttendanceRecord } from "@/lib/firebase/firestore";
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
  const [activeTab, setActiveTab] = useState<"daily" | "history">("daily");
  const [historyRecords, setHistoryRecords] = useState<GlobalAttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    if (activeTab === "daily") {
      loadAttendance();
    } else if (activeTab === "history" && historyRecords.length === 0) {
      loadHistory();
    }
  }, [selectedDate, activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const records = await getAllAttendanceRecords();
      setHistoryRecords(records);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-belt-white uppercase tracking-tight">Roster</h1>
          <div className="flex gap-4 mt-2">
            <button 
              onClick={() => setActiveTab("daily")}
              className={`text-sm font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === "daily" ? "text-belt-white border-belt-red" : "text-belt-white/30 border-transparent hover:text-belt-white/60"}`}
            >
              Daily Log
            </button>
            <button 
              onClick={() => setActiveTab("history")}
              className={`text-sm font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === "history" ? "text-belt-white border-belt-red" : "text-belt-white/30 border-transparent hover:text-belt-white/60"}`}
            >
              History
            </button>
          </div>
        </div>
        <button onClick={handleAddMember} className="btn-primary whitespace-nowrap">
          <span className="text-xl mr-2">+</span> Add Member
        </button>
      </div>

      {activeTab === "daily" && (
        <>
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
      </>
    )}

      {activeTab === "history" && (
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="card text-center py-12"><p className="text-belt-white/40 font-black uppercase tracking-widest animate-pulse">Loading Records...</p></div>
          ) : (
            <div className="card overflow-x-auto pb-8">
              <div className="mb-4">
                <p className="text-[10px] font-black text-belt-gold uppercase tracking-[0.2em] mb-1">Rolling 6-Month Average</p>
                <p className="text-xs text-belt-white/60">Percentages are calculated using only practices from the last 6 months.</p>
              </div>
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr>
                    <th className="p-3 border-b border-belt-gray/50 text-xs font-black uppercase tracking-widest text-belt-white/60 sticky left-0 bg-belt-dark z-10">Member</th>
                    <th className="p-3 border-b border-belt-gray/50 text-xs font-black uppercase tracking-widest text-belt-white/60 sticky left-[120px] bg-belt-dark z-10">6mo %</th>
                    {Array.from(new Set(historyRecords.map(r => r.date))).sort((a, b) => b.localeCompare(a)).slice(0, 14).map(date => (
                      <th key={date} className="p-3 border-b border-belt-gray/50 text-[10px] font-black uppercase tracking-widest text-belt-white/40 text-center">
                        {new Date(date + "T12:00:00").toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.filter(m => m.status === "active").map(member => {
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split("T")[0];
                    
                    const memberRecords = historyRecords.filter(r => r.memberId === member.id);
                    const sixMonthRecords = memberRecords.filter(r => r.date >= sixMonthsAgoStr);
                    
                    const presentCount = sixMonthRecords.filter(r => r.present).length;
                    const totalCount = sixMonthRecords.length;
                    const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
                    
                    const recentDates = Array.from(new Set(historyRecords.map(r => r.date))).sort((a, b) => b.localeCompare(a)).slice(0, 14);
                    
                    return (
                      <tr key={member.id} className="hover:bg-belt-dark/50 transition-colors border-b border-belt-gray/20">
                        <td className="p-3 text-xs font-bold text-belt-white whitespace-nowrap sticky left-0 bg-belt-dark group-hover:bg-belt-dark/50 z-10">{member.name}</td>
                        <td className={`p-3 text-xs font-bold sticky left-[120px] bg-belt-dark group-hover:bg-belt-dark/50 z-10 ${percentage < 50 && totalCount > 0 ? 'text-belt-red' : 'text-green-500'}`}>
                          {totalCount > 0 ? `${percentage}%` : '-'}
                        </td>
                        {recentDates.map(date => {
                          const record = memberRecords.find(r => r.date === date);
                          return (
                            <td key={date} className="p-3 text-center">
                              {record ? (record.present ? <span className="text-green-500 font-bold text-lg">✓</span> : <span className="text-belt-red font-bold text-lg">✕</span>) : <span className="text-belt-white/10">-</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
