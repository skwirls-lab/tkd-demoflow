import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "./config";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "./config";

export interface UserData {
  uid: string;
  email: string;
  role: "admin" | "member";
  createdAt: string;
}

export const signIn = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const signUp = async (email: string, password: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Create user document in Firestore
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    role: "member",
    createdAt: new Date().toISOString(),
  });

  return user;
};

export const signOut = async () => {
  await firebaseSignOut(auth);
};

export const useAuthState = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const getUserData = async (uid: string): Promise<UserData | null> => {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists()) {
    return userDoc.data() as UserData;
  }
  return null;
};

export const isAdmin = async (uid: string): Promise<boolean> => {
  const userData = await getUserData(uid);
  return userData?.role === "admin";
};
