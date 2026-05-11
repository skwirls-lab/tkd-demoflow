"use client";

import { useEffect, useState } from "react";
import { getAllNotes, addNote, deleteNote, Note, searchNotes } from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

export default function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteTags, setNewNoteTags] = useState("");

  useEffect(() => {
    loadNotes();
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await searchNotes(searchQuery);
      setNotes(data);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!user || !newNoteContent.trim()) return;

    try {
      const tags = newNoteTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t !== "");
      
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-belt-white uppercase tracking-tight">
          Team Notes
        </h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="w-12 h-12 bg-belt-red text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <span className="text-2xl">+</span>
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8 relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes or tags..."
          className="input-field pl-12"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40">🔍</span>
      </form>

      {/* Notes Grid */}
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
        ) : notes.length > 0 ? (
          notes.map((note) => (
            <div key={note.id} className="card bg-belt-dark/60 hover:border-belt-gray transition-colors group relative">
              <p className="text-belt-white/90 whitespace-pre-wrap mb-4">
                {note.content}
              </p>
              
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-bold uppercase px-2 py-1 bg-belt-gray text-belt-gold rounded border border-belt-gold/20"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-belt-gray/30 flex justify-between items-center">
                <span className="text-xs text-belt-white/30">
                  {new Date(note.timestamp).toLocaleDateString()} at {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                
                <button
                  onClick={() => setNoteToDelete(note.id)}
                  className="text-xs text-red-500/50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 card border-dashed">
            <p className="text-belt-white/30 italic">No notes found matching your search.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {noteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in duration-200">
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
              <button
                onClick={() => setNoteToDelete(null)}
                className="btn-secondary flex-1"
              >
                Keep it
              </button>
              <button
                onClick={handleDeleteNote}
                className="btn-danger flex-1"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-lg space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-xl">New Note</h2>
              <button onClick={() => setShowAddModal(false)} className="text-belt-white/40">✕</button>
            </div>

            <div className="space-y-4">
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Write your note here..."
                rows={5}
                className="input-field resize-none"
              />
              <input
                type="text"
                value={newNoteTags}
                onChange={(e) => setNewNoteTags(e.target.value)}
                placeholder="Tags (comma separated: formation, board, 2024)"
                className="input-field"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAddNote} className="btn-primary flex-1">Post Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
