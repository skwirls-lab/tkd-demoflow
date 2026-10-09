"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllNotes, addNote, deleteNote, Note, getUserEmails } from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

export default function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteTags, setNewNoteTags] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadNotes();
    getUserEmails().then(setAuthors).catch(() => {});
  }, []);

  const loadNotes = async () => {
    try {
      const data = await getAllNotes();
      setNotes(data);
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter as you type (notes are already loaded, no need to hit the server).
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes.filter((n) => {
      if (activeTag && !n.tags.includes(activeTag)) return false;
      if (!q) return true;
      return n.content.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q));
    });
  }, [notes, searchQuery, activeTag]);

  const authorName = (uid: string) => {
    const email = authors[uid];
    if (!email) return null;
    return uid === user?.uid ? "You" : email.split("@")[0];
  };

  const handleAddNote = async () => {
    if (!user || !newNoteContent.trim() || posting) return;

    setPosting(true);
    try {
      const tags = Array.from(
        new Set(
          newNoteTags
            .split(",")
            .map((t) => t.trim().replace(/^#/, ""))
            .filter((t) => t !== "")
        )
      );

      await addNote({
        content: newNoteContent.trim(),
        tags,
        authorId: user.uid,
      });

      setNewNoteContent("");
      setNewNoteTags("");
      setShowAddModal(false);
      loadNotes();
    } catch (error) {
      console.error("Failed to add note:", error);
      alert("Couldn't post the note. Check your connection and try again.");
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      await deleteNote(noteToDelete);
      setNoteToDelete(null);
      loadNotes();
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-black text-belt-white uppercase tracking-tight">
          Team Notes
        </h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="h-12 px-5 bg-belt-red text-white rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform font-black uppercase text-xs tracking-widest"
          aria-label="New note"
        >
          <span className="text-2xl leading-none">+</span> New
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4 relative">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes or tags..."
          className="input-field pl-12"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40 pointer-events-none">🔍</span>
      </div>

      {activeTag && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-belt-white/50">Showing</span>
          <button
            onClick={() => setActiveTag(null)}
            className="h-9 px-3 text-xs font-bold uppercase bg-belt-gold/20 text-belt-gold rounded-lg border border-belt-gold/40"
          >
            #{activeTag} ✕
          </button>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse space-y-3">
              <div className="h-4 bg-belt-gray rounded w-full" />
              <div className="h-4 bg-belt-gray rounded w-2/3" />
              <div className="flex gap-2">
                <div className="h-6 bg-belt-gray rounded w-16" />
                <div className="h-6 bg-belt-gray rounded w-16" />
              </div>
            </div>
          ))
        ) : filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <div key={note.id} className="card bg-belt-dark/60 hover:border-belt-gray transition-colors group relative">
              <p className="text-belt-white/90 whitespace-pre-wrap mb-4 break-words">
                {note.content}
              </p>

              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {note.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(tag)}
                      className="text-[11px] font-bold uppercase px-2.5 py-1.5 bg-belt-gray text-belt-gold rounded border border-belt-gold/20 hover:border-belt-gold/60"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-belt-gray/30 flex justify-between items-center gap-3">
                <span className="text-xs text-belt-white/40">
                  {authorName(note.authorId) && (
                    <span className="text-belt-white/60 font-semibold">{authorName(note.authorId)} · </span>
                  )}
                  {new Date(note.timestamp).toLocaleDateString()} at{" "}
                  {new Date(note.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>

                <button
                  onClick={() => setNoteToDelete(note.id)}
                  className="hover-reveal h-9 px-3 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 card border-dashed">
            <p className="text-belt-white/30 italic">
              {notes.length === 0 ? "No notes yet. Tap + New to add one." : "No notes match your search."}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {noteToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-6 border-red-900/50">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <h2 className="font-bold text-xl text-belt-white">Delete Note?</h2>
              <p className="text-belt-white/60 text-sm mt-2">
                This action cannot be undone. This note will be permanently removed from the team board.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setNoteToDelete(null)} className="btn-secondary flex-1">
                Keep it
              </button>
              <button onClick={handleDeleteNote} className="btn-danger flex-1">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-lg space-y-5 rounded-b-none sm:rounded-xl safe-bottom-pad">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-xl">New Note</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-10 h-10 flex items-center justify-center text-belt-white/50 hover:text-belt-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Write your note here..."
                rows={5}
                autoFocus
                className="input-field resize-none"
              />
              <input
                type="text"
                value={newNoteTags}
                onChange={(e) => setNewNoteTags(e.target.value)}
                placeholder="Tags, comma separated (formation, boards)"
                className="input-field"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleAddNote}
                disabled={posting || !newNoteContent.trim()}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {posting ? "Posting…" : "Post Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
