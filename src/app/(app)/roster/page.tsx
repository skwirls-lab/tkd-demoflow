"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAllMembers, Member, getAttendanceForDate, saveAttendanceRecord, getAllAttendanceRecords, GlobalAttendanceRecord } from "@/lib/firebase/firestore";
import RosterGrid from "@/components/roster/RosterGrid";
import MemberModal from "@/components/roster/MemberModal";
import { useAuth } from "@/contexts/AuthContext";
import { toLocalDateString, parseLocalDate, addDays, monthsAgo } from "@/lib/dates";

const HISTORY_COLUMNS = 14;

export default function RosterPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString());
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"daily" | "history">("daily");
  const [historyRecords, setHistoryRecords] = useState<GlobalAttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [historySort, setHistorySort] = useState<"name" | "lowest">("name");
  const attendanceRequestRef = useRef(0);
  const { user } = useAuth();

  const today = toLocalDateString();

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    if (activeTab === "daily") {
      loadAttendance();
    } else {
      // Always refetch so attendance just taken shows up.
      loadHistory();
    }
  }, [selectedDate, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Ignore responses for a date that's no longer selected.
    const requestId = ++attendanceRequestRef.current;
    try {
      const records = await getAttendanceForDate(selectedDate);
      if (requestId === attendanceRequestRef.current) setAttendance(records);
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
      alert("Couldn't save attendance. Check your connection.");
      loadAttendance();
    }
  };

  const activeMembers = useMemo(() => members.filter((m) => m.status === "active"), [members]);
  const shownMembers = useMemo(() => {
    const pool = showAll ? members : activeMembers;
    const q = search.trim().toLowerCase();
    return q ? pool.filter((m) => m.name.toLowerCase().includes(q)) : pool;
  }, [members, activeMembers, showAll, search]);

  const presentCount = activeMembers.filter((m) => attendance[m.id] === true).length;
  const absentCount = activeMembers.filter((m) => attendance[m.id] === false).length;
  const unmarked = activeMembers.filter((m) => attendance[m.id] === undefined);

  const markRestAbsent = async () => {
    if (!user || unmarked.length === 0) return;
    if (!confirm(`Mark ${unmarked.length} unmarked member${unmarked.length > 1 ? "s" : ""} as absent?`)) return;
    setAttendance((prev) => {
      const next = { ...prev };
      unmarked.forEach((m) => (next[m.id] = false));
      return next;
    });
    try {
      await Promise.all(unmarked.map((m) => saveAttendanceRecord(m.id, selectedDate, false, user.uid)));
    } catch (error) {
      console.error("Failed to save attendance:", error);
      alert("Some records didn't save. Check your connection.");
      loadAttendance();
    }
  };

  // ---- History stats ----
  // A "practice" is any date with at least one attendance record. A member who
  // wasn't marked on a practice date (after they joined) counts as absent, so
  // percentages aren't inflated when only the present kids get tapped.
  const history = useMemo(() => {
    const windowStart = monthsAgo(6);
    const practiceDates = Array.from(new Set(historyRecords.map((r) => r.date))).sort((a, b) => b.localeCompare(a));
    const windowDates = practiceDates.filter((d) => d >= windowStart);
    const recentDates = practiceDates.slice(0, HISTORY_COLUMNS);
    const recordMap = new Map(historyRecords.map((r) => [`${r.memberId}|${r.date}`, r.present]));

    const rows = activeMembers.map((member) => {
      const joined = member.joinedAt ? toLocalDateString(new Date(member.joinedAt)) : "";
      const isEligible = (date: string) => date >= joined || recordMap.has(`${member.id}|${date}`);
      const eligible = windowDates.filter(isEligible);
      const present = eligible.filter((d) => recordMap.get(`${member.id}|${d}`) === true).length;
      const last4 = eligible.slice(0, 4);
      const presentLast4 = last4.filter((d) => recordMap.get(`${member.id}|${d}`) === true).length;
      return {
        member,
        percentage: eligible.length > 0 ? Math.round((present / eligible.length) * 100) : null,
        present,
        total: eligible.length,
        last4: last4.length ? `${presentLast4}/${last4.length}` : "-",
        last4Low: last4.length >= 2 && presentLast4 / last4.length < 0.5,
        cells: recentDates.map((date) => {
          const value = recordMap.get(`${member.id}|${date}`);
          if (value === true) return "present" as const;
          if (value === false) return "absent" as const;
          return isEligible(date) ? ("unmarked" as const) : ("before-join" as const);
        }),
      };
    });

    if (historySort === "lowest") {
      rows.sort((a, b) => (a.percentage ?? 101) - (b.percentage ?? 101));
    }
    return { rows, recentDates };
  }, [historyRecords, activeMembers, historySort]);

  const tabClass = (active: boolean) =>
    `text-sm font-black uppercase tracking-widest py-2 border-b-2 transition-all ${
      active ? "text-belt-white border-belt-red" : "text-belt-white/30 border-transparent hover:text-belt-white/60"
    }`;

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-belt-white uppercase tracking-tight">Roster</h1>
          <div className="flex gap-5 mt-1">
            <button onClick={() => setActiveTab("daily")} className={tabClass(activeTab === "daily")}>
              Daily Log
            </button>
            <button onClick={() => setActiveTab("history")} className={tabClass(activeTab === "history")}>
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
          <div className="card mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                className="w-12 h-12 shrink-0 rounded-lg bg-belt-gray hover:bg-gray-700 text-belt-white font-black"
                aria-label="Previous week"
              >
                ‹
              </button>
              <label className="flex-1 min-w-0 text-center cursor-pointer relative">
                <p className="text-[11px] text-belt-white/50 uppercase tracking-widest font-bold">
                  {selectedDate === today ? "Today" : "Attendance date"}
                </p>
                <p className="text-base md:text-lg font-semibold text-belt-white truncate">
                  {parseLocalDate(selectedDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  aria-label="Pick attendance date"
                />
              </label>
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                className="w-12 h-12 shrink-0 rounded-lg bg-belt-gray hover:bg-gray-700 text-belt-white font-black"
                aria-label="Next week"
              >
                ›
              </button>
            </div>
            {selectedDate !== today && (
              <button
                onClick={() => setSelectedDate(today)}
                className="mt-3 w-full h-10 rounded-lg bg-belt-red/10 text-belt-red text-xs font-black uppercase tracking-widest"
              >
                Jump to today
              </button>
            )}
          </div>

          {/* Summary */}
          {!loading && activeMembers.length > 0 && (
            <div className="card mb-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-4 text-sm font-bold">
                  <span className="text-green-500">✓ {presentCount} present</span>
                  <span className="text-red-400">✗ {absentCount} absent</span>
                  <span className="text-belt-white/40">{unmarked.length} unmarked</span>
                </div>
                {unmarked.length > 0 && (presentCount > 0 || absentCount > 0) && (
                  <button
                    onClick={markRestAbsent}
                    className="h-10 px-3 rounded-lg bg-belt-gray hover:bg-gray-700 text-belt-white text-[11px] font-black uppercase tracking-widest"
                  >
                    Mark rest absent
                  </button>
                )}
              </div>
              <div className="w-full bg-belt-gray rounded-full h-2 overflow-hidden flex">
                <div className="bg-green-500 h-2" style={{ width: `${(presentCount / activeMembers.length) * 100}%` }} />
                <div className="bg-red-500 h-2" style={{ width: `${(absentCount / activeMembers.length) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Search + filter */}
          {!loading && members.length > 0 && (
            <div className="flex gap-2 mb-4">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members…"
                className="input-field flex-1"
              />
              <div className="flex rounded-lg overflow-hidden border border-gray-700 shrink-0">
                {([false, true] as const).map((all) => (
                  <button
                    key={String(all)}
                    onClick={() => setShowAll(all)}
                    className={`px-3 text-xs font-black uppercase tracking-wider ${
                      showAll === all ? "bg-belt-red text-white" : "bg-belt-gray text-belt-white/50"
                    }`}
                  >
                    {all ? "All" : "Active"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-belt-dark rounded-xl p-4 animate-pulse">
                  <div className="aspect-square bg-belt-gray rounded-lg mb-3" />
                  <div className="h-4 bg-belt-gray rounded w-3/4 mb-2" />
                  <div className="h-3 bg-belt-gray rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!loading && members.length === 0 && (
            <div className="card text-center py-12">
              <p className="text-4xl mb-4">🥋</p>
              <p className="text-belt-white/60 text-lg">No members yet</p>
              <button onClick={handleAddMember} className="btn-primary mt-4 mx-auto">
                Add Your First Member
              </button>
            </div>
          )}

          {!loading && members.length > 0 && shownMembers.length === 0 && (
            <p className="text-center text-belt-white/40 py-10">No members match.</p>
          )}

          {!loading && shownMembers.length > 0 && (
            <RosterGrid
              members={shownMembers.map((m) => ({ ...m, _attendancePresent: attendance[m.id] }))}
              onToggleAttendance={handleAttendanceToggle}
              onEditMember={handleEditMember}
            />
          )}
        </>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          {loadingHistory && historyRecords.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-belt-white/40 font-black uppercase tracking-widest animate-pulse">Loading Records...</p>
            </div>
          ) : (
            <div className="card pb-6">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black text-belt-gold uppercase tracking-[0.2em] mb-1">Rolling 6-Month Attendance</p>
                  <p className="text-xs text-belt-white/60 max-w-md">
                    Counts every practice in the last 6 months since the member joined. Not being marked on a practice day
                    counts as absent (shown as a faded ✗). &quot;Last 4&quot; is the most recent four practices.
                  </p>
                </div>
                <div className="flex rounded-lg overflow-hidden border border-gray-700 shrink-0 self-start">
                  {(["name", "lowest"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setHistorySort(key)}
                      className={`h-9 px-3 text-[11px] font-black uppercase tracking-wider ${
                        historySort === key ? "bg-belt-red text-white" : "bg-belt-gray text-belt-white/50"
                      }`}
                    >
                      {key === "name" ? "A–Z" : "Lowest %"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 md:p-3 border-b border-belt-gray/50 text-[11px] font-black uppercase tracking-widest text-belt-white/60 sticky left-0 bg-belt-dark z-10 w-[120px] min-w-[120px] max-w-[120px]">
                        Member
                      </th>
                      <th className="p-2 md:p-3 border-b border-belt-gray/50 text-[11px] font-black uppercase tracking-widest text-belt-white/60 text-center">6mo</th>
                      <th className="p-2 md:p-3 border-b border-belt-gray/50 text-[11px] font-black uppercase tracking-widest text-belt-white/60 text-center whitespace-nowrap">Last 4</th>
                      {history.recentDates.map((date) => (
                        <th key={date} className="p-2 border-b border-belt-gray/50 text-[10px] font-black uppercase tracking-wider text-belt-white/40 text-center whitespace-nowrap">
                          {parseLocalDate(date).toLocaleDateString(undefined, { weekday: "short" })}
                          <br />
                          {parseLocalDate(date).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.rows.map((row) => (
                      <tr key={row.member.id} className="border-b border-belt-gray/20">
                        <td className="p-2 md:p-3 text-xs font-bold text-belt-white sticky left-0 bg-belt-dark z-10 w-[120px] min-w-[120px] max-w-[120px] truncate" title={row.member.name}>
                          {row.member.name}
                        </td>
                        <td
                          className={`p-2 md:p-3 text-xs font-bold text-center ${
                            row.percentage === null ? "text-belt-white/30" : row.percentage < 50 ? "text-belt-red" : row.percentage < 75 ? "text-belt-gold" : "text-green-500"
                          }`}
                          title={row.total ? `${row.present} of ${row.total} practices` : undefined}
                        >
                          {row.percentage === null ? "-" : `${row.percentage}%`}
                        </td>
                        <td className={`p-2 md:p-3 text-xs font-bold text-center font-mono ${row.last4Low ? "text-belt-red" : "text-belt-white/70"}`}>
                          {row.last4}
                        </td>
                        {row.cells.map((cell, i) => (
                          <td key={history.recentDates[i]} className="p-2 text-center">
                            {cell === "present" && <span className="text-green-500 font-bold text-lg">✓</span>}
                            {cell === "absent" && <span className="text-belt-red font-bold text-lg">✕</span>}
                            {cell === "unmarked" && <span className="text-belt-red/40 font-bold text-lg" title="Not marked — counted absent">✕</span>}
                            {cell === "before-join" && <span className="text-belt-white/10">·</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {history.rows.length === 0 && (
                <p className="text-center text-belt-white/40 py-8 text-sm">No active members.</p>
              )}
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
