"use client";

import { useState } from "react";
import { Member, addMember, updateMember, deleteMember } from "@/lib/firebase/firestore";
import { uploadPhoto } from "@/lib/firebase/storage";

interface MemberModalProps {
  member: Member | null;
  onClose: () => void;
  onSave: () => void;
}

export default function MemberModal({ member, onClose, onSave }: MemberModalProps) {
  const [name, setName] = useState(member?.name || "");
  const [rank, setRank] = useState(member?.rank || "");
  const [specialty, setSpecialty] = useState(member?.specialty || "");
  const [status, setStatus] = useState<"active" | "inactive" | "graduated">(
    member?.status || "active"
  );
  const [photoUrl, setPhotoUrl] = useState(member?.photoUrl || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const ranks = [
    "White Belt",
    "Yellow Stripe",
    "Yellow Belt",
    "Orange Stripe",
    "Orange Belt",
    "Green Stripe",
    "Green Belt",
    "Blue Stripe",
    "Blue Belt",
    "Brown Stripe",
    "Brown Belt",
    "Red Stripe",
    "Red Belt",
    "Red with Gup",
    "Black Stripe",
    "Black Stripe with Gup",
    "Semi-Black",
    "Black Belt 1st Dan",
    "Black Belt 2nd Dan",
    "Black Belt 3rd Dan",
    "Black Belt 4th Dan",
    "Black Belt 5th Dan",
    "Black Belt 6th Dan",
    "Black Belt 7th Dan",
    "Black Belt 8th Dan",
    "Black Belt 9th Dan",
    "Black Belt 10th Dan",
  ];

  const specialties = [
    "",
    "Board Breaking",
    "Kicking",
    "Forms (Poomsae)",
    "Sparring",
    "Self Defense",
    "Demonstration",
    "Acrobatics",
    "Weapon Forms",
  ];

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const tempId = member?.id || `temp-${Date.now()}`;
      const url = await uploadPhoto(file, tempId);
      setPhotoUrl(url);
    } catch (error) {
      console.error("Failed to upload photo:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !rank) return;

    setSaving(true);
    try {
      if (member) {
        await updateMember(member.id, {
          name: name.trim(),
          rank,
          specialty: specialty.trim(),
          status,
          photoUrl,
        });
      } else {
        await addMember({
          name: name.trim(),
          rank,
          specialty: specialty.trim(),
          status,
          photoUrl,
          joinedAt: new Date().toISOString(),
        });
      }
      onSave();
      onClose();
    } catch (error) {
      console.error("Failed to save member:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!member) return;
    if (!confirm(`Are you sure you want to delete ${member.name}?`)) return;

    setSaving(true);
    try {
      await deleteMember(member.id);
      onSave();
      onClose();
    } catch (error) {
      console.error("Failed to delete member:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="card max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-belt-white">
            {member ? "Edit Member" : "Add Member"}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-belt-white/60 hover:text-belt-white touch-target"
          >
            ✕
          </button>
        </div>

        {/* Photo Upload */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-belt-gray mb-3 relative">
            {photoUrl ? (
              <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-3xl">🥋</span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-belt-red border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <label className="btn-secondary text-sm cursor-pointer">
            <span className="mr-2">📷</span> Upload Photo
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-belt-white/80 mb-1">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
            placeholder="Member name"
          />
        </div>

        {/* Rank */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-belt-white/80 mb-1">
            Rank *
          </label>
          <select
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            className="input-field"
          >
            <option value="">Select rank...</option>
            {ranks.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Specialty */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-belt-white/80 mb-1">
            Specialty
          </label>
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="input-field"
          >
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s || "None"}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-belt-white/80 mb-1">
            Status
          </label>
          <div className="flex gap-2">
            {(["active", "inactive", "graduated"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors touch-target ${
                  status === s
                    ? s === "active"
                      ? "bg-green-600 text-white"
                      : s === "inactive"
                        ? "bg-yellow-600 text-white"
                        : "bg-blue-600 text-white"
                    : "bg-belt-gray text-belt-white/60"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !rank}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {saving ? "Saving..." : member ? "Update" : "Add Member"}
            </button>
          </div>
          
          {member && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="w-full py-3 text-red-500 text-sm font-medium hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Delete Member
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
