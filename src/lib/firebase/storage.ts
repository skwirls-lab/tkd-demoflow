import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./config";

export const uploadAudio = async (file: File, routineName: string): Promise<string> => {
  const fileRef = ref(storage, `audio/${routineName}-${Date.now()}.mp3`);
  const snapshot = await uploadBytes(fileRef, file);
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
};

export const uploadPhoto = async (file: File, memberId: string): Promise<string> => {
  const fileRef = ref(storage, `photos/${memberId}.jpg`);
  const snapshot = await uploadBytes(fileRef, file);
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
};

export const deleteFile = async (url: string) => {
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch {
    // Silently fail - URL may not be a direct Firebase Storage path
  }
};
