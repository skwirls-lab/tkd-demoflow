import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";

// ========================
// Members Collection
// ========================

export interface Member {
  id: string;
  name: string;
  photoUrl: string;
  rank: string;
  specialty: string;
  status: "active" | "inactive" | "graduated";
  joinedAt: string;
}

export const membersCollection = collection(db, "members");

export const addMember = async (member: Omit<Member, "id">) => {
  const docRef = await addDoc(membersCollection, {
    ...member,
    joinedAt: new Date().toISOString(),
  });
  return docRef.id;
};

export const updateMember = async (id: string, data: Partial<Member>) => {
  const memberRef = doc(db, "members", id);
  await updateDoc(memberRef, data);
};

export const deleteMember = async (id: string) => {
  const memberRef = doc(db, "members", id);
  await deleteDoc(memberRef);
};

export const getMember = async (id: string): Promise<Member | null> => {
  const memberRef = doc(db, "members", id);
  const memberDoc = await getDoc(memberRef);
  if (memberDoc.exists()) {
    return { id: memberDoc.id, ...memberDoc.data() } as Member;
  }
  return null;
};

export const getAllMembers = async (): Promise<Member[]> => {
  const q = query(membersCollection, orderBy("name"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Member));
};

// ========================
// Attendance Sub-collection
// ========================

export interface AttendanceRecord {
  date: string;
  present: boolean;
  recordedBy: string;
  recordedAt: string;
}

export const addAttendanceRecord = async (
  memberId: string,
  record: Omit<AttendanceRecord, "recordedAt">
) => {
  const attendanceRef = collection(db, `members/${memberId}/attendance`);
  await addDoc(attendanceRef, {
    ...record,
    recordedAt: new Date().toISOString(),
  });
};

export const getAttendanceHistory = async (
  memberId: string
): Promise<AttendanceRecord[]> => {
  const attendanceRef = collection(db, `members/${memberId}/attendance`);
  const q = query(attendanceRef, orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as AttendanceRecord);
};

// ========================
// Routines Collection
// ========================

export interface RoutineEvent {
  timestamp: number; // seconds from start
  label: string;
  type: "formation" | "technique" | "board" | "transition" | "music" | "other";
}

export interface Routine {
  id: string;
  name: string;
  audioUrl: string;
  events: RoutineEvent[];
  createdAt: string;
  createdBy: string;
}

export const routinesCollection = collection(db, "routines");

export const addRoutine = async (routine: Omit<Routine, "id" | "createdAt">) => {
  const docRef = await addDoc(routinesCollection, {
    ...routine,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

export const updateRoutine = async (id: string, data: Partial<Routine>) => {
  const routineRef = doc(db, "routines", id);
  await updateDoc(routineRef, data);
};

export const deleteRoutine = async (id: string) => {
  const routineRef = doc(db, "routines", id);
  await deleteDoc(routineRef);
};

export const getRoutine = async (id: string): Promise<Routine | null> => {
  const routineRef = doc(db, "routines", id);
  const routineDoc = await getDoc(routineRef);
  if (routineDoc.exists()) {
    return { id: routineDoc.id, ...routineDoc.data() } as Routine;
  }
  return null;
};

export const getAllRoutines = async (): Promise<Routine[]> => {
  const q = query(routinesCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Routine));
};

// ========================
// Notes Collection
// ========================

export interface Note {
  id: string;
  authorId: string;
  content: string;
  timestamp: string;
  tags: string[];
}

export const notesCollection = collection(db, "notes");

export const addNote = async (note: Omit<Note, "id" | "timestamp">) => {
  const docRef = await addDoc(notesCollection, {
    ...note,
    timestamp: new Date().toISOString(),
  });
  return docRef.id;
};

export const deleteNote = async (id: string) => {
  const noteRef = doc(db, "notes", id);
  await deleteDoc(noteRef);
};

export const getAllNotes = async (): Promise<Note[]> => {
  const q = query(notesCollection, orderBy("timestamp", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Note));
};

export const searchNotes = async (
  queryText: string,
  tagFilter?: string
): Promise<Note[]> => {
  let q = query(notesCollection, orderBy("timestamp", "desc"));
  if (tagFilter) {
    q = query(notesCollection, where("tags", "array-contains", tagFilter));
  }
  const snapshot = await getDocs(q);
  let notes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Note));
  if (queryText) {
    const lower = queryText.toLowerCase();
    notes = notes.filter(
      (n) =>
        n.content.toLowerCase().includes(lower) ||
        n.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }
  return notes;
};
