import type { MemberState } from '@workspace/api-client-react';

export function fmtKm(meters: number): string {
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return km < 9.5 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function fmtDur(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} sec`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function fmtClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const day = same(d, today)
    ? 'Today'
    : same(d, tomorrow)
      ? 'Tomorrow'
      : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${fmtClock(iso)}`;
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 90) return '1 min ago';
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export type StatusInfo = { label: string; kind: 'moving' | 'stopped' | 'stale' | 'off' | 'invited' };

export function statusInfo(m: MemberState): StatusInfo {
  switch (m.status) {
    case 'moving':
      return { label: 'Moving', kind: 'moving' };
    case 'stopped':
      return {
        label: m.statusSinceS != null ? `Stopped · ${fmtDur(m.statusSinceS)}` : 'Stopped',
        kind: 'stopped',
      };
    case 'not_updating':
      return {
        label: m.lastFixAt ? `Not updating · last seen ${timeAgo(m.lastFixAt)}` : 'Not updating',
        kind: 'stale',
      };
    case 'not_joined':
      return { label: 'Invited — has not joined yet', kind: 'invited' };
    default:
      return { label: 'Not sharing location', kind: 'off' };
  }
}

/** "12 km behind · ~22 min (est)" relative to the viewer. */
export function gapLabel(m: MemberState): string | null {
  if (m.isSelf || m.gapM == null) return null;
  const dist = fmtKm(Math.abs(m.gapM));
  if (m.offRoute) return `${dist} away · off-route`;
  const dir = m.gapM >= 0 ? 'ahead' : 'behind';
  const time = m.gapS != null ? ` · ~${fmtDur(m.gapS)} (est)` : '';
  return `${dist} ${dir}${time}`;
}
