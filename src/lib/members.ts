import { Member } from "@/lib/firebase/firestore";

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((n) => n[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 3);

// Short labels for formation dots. Uses initials, but when two members share
// initials (e.g. two "JS"), falls back to the first two letters of the first
// name plus the last initial ("JoS" / "JaS") so they can be told apart.
export const getMemberLabels = (members: Member[]): Record<string, string> => {
  const byInitials: Record<string, Member[]> = {};
  members.forEach((m) => {
    const key = initialsOf(m.name);
    (byInitials[key] ||= []).push(m);
  });

  const labels: Record<string, string> = {};
  Object.entries(byInitials).forEach(([initials, group]) => {
    group.forEach((m) => {
      if (group.length === 1) {
        labels[m.id] = initials || "?";
        return;
      }
      const parts = m.name.trim().split(/\s+/);
      const first = parts[0] || "";
      const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
      labels[m.id] = `${first.slice(0, 2)}${last.toUpperCase()}`;
    });
  });
  return labels;
};

export const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};
