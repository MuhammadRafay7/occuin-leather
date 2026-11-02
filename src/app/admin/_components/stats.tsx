import Link from "next/link";
import { linkClass } from "./ui";

export function Stat({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  return (
    <div className="adm-stat">
      <p className="adm-stat-label">{label}</p>
      <p className="adm-stat-value">{href ? <Link href={href} className={linkClass}>{value}</Link> : value}</p>
      {note ? <p className="adm-stat-note">{note}</p> : null}
    </div>
  );
}

export function changeNote(current: number, previous: number, label: string) {
  if (previous === 0) return current === 0 ? `No change on ${label}` : `Nothing on ${label}`;
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}% on ${label}`;
}
