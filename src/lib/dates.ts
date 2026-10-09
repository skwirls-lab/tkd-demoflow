// Dates are stored as local "YYYY-MM-DD" strings. Never derive them from
// toISOString(), which is UTC and rolls over to tomorrow in the evening.

const pad = (n: number) => n.toString().padStart(2, "0");

export const toLocalDateString = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseLocalDate = (dateStr: string): Date => new Date(`${dateStr}T12:00:00`);

export const addDays = (dateStr: string, days: number): string => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
};

export const monthsAgo = (months: number): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return toLocalDateString(d);
};
