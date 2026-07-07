// Small shared helpers for the Projects feature.

/** Get 1-2 char initials from a name (e.g. "Alex Smith" -> "AS"). */
export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** ISO string (or null) -> "yyyy-MM-dd" for native date inputs. */
export function isoToDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Use local date parts so the value matches what the user expects.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Native date input value ("yyyy-MM-dd") -> ISO string, or null if empty/invalid. */
export function dateInputToISO(value: string): string | null {
  if (!value) return null;
  const d = new Date(value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
