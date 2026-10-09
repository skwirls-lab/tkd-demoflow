import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./config";

export const uploadAudio = async (file: File, routineName: string): Promise<string> => {
  const ext = file.name.match(/\.[^/.]+$/)?.[0] || ".mp3";
  const safeName = routineName.replace(/[^\w\- ]+/g, "").trim() || "track";
  const fileRef = ref(storage, `audio/${safeName}-${Date.now()}${ext}`);
  const snapshot = await uploadBytes(fileRef, file, { contentType: file.type || undefined });
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
};

// Phone photos are often 5-10MB. Shrink to a square-ish thumbnail before upload
// so the roster grid loads fast. Falls back to the original file if the
// browser can't decode it (e.g. HEIC on some devices).
const resizeImage = (file: File, maxSize = 600): Promise<Blob> =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob || file);
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

export const uploadPhoto = async (file: File, memberId: string): Promise<string> => {
  const blob = await resizeImage(file);
  const fileRef = ref(storage, `photos/${memberId}.jpg`);
  const snapshot = await uploadBytes(fileRef, blob, { contentType: blob.type || "image/jpeg" });
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
