// Shared building blocks: icons, logo, status chips, meters, charts and states.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { CampaignStatus } from '../api/types';

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  send: 'M21 3 10 14M21 3l-7 18-4-7-7-4z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.9M15.5 3.1a3.5 3.5 0 0 1 0 6.8',
  relay: 'M4 7h11M4 7l3-3M4 7l3 3M20 17H9M20 17l-3-3M20 17l-3 3',
  page: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  layers: 'M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
  brand: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  chevron: 'M6 9l6 6 6-6',
  check: 'M5 12.5 10 17 19 7',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  pause: 'M9 5v14M15 5v14',
  play: 'M7 4v16l13-8z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  x: 'M6 6l12 12M18 6 6 18',
  out: 'M10 17l5-5-5-5M15 12H3M21 4v16',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7M8 11h5',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined}
      aria-label={label} className="icon">
      <path d={ICONS[name]} />
    </svg>
  );
}

// The Relais mark: a rising ramp (the warm-up) handing over to the next bar.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <rect x="7" y="18" width="3.6" height="7" rx="1.8" fill="var(--brand-ink)" />
      <rect x="12.4" y="14" width="3.6" height="11" rx="1.8" fill="var(--brand-ink)" />
      <rect x="17.8" y="10" width="3.6" height="15" rx="1.8" fill="var(--brand-ink)" />
      <path d="M23.2 7.5h3.3v3.3M26.5 7.5 21.6 12.4" fill="none" stroke="var(--brand-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-word">relais</span>
    </span>
  );
}

type Tone = 'run' | 'info' | 'ok' | 'neutral' | 'warn' | 'bad' | 'brand';

const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: Tone; icon: IconName }> = {
  running: { label: 'En cours', tone: 'run', icon: 'play' },
  scheduled: { label: 'Planifiée', tone: 'info', icon: 'clock' },
  finished: { label: 'Terminée', tone: 'ok', icon: 'check' },
  draft: { label: 'Brouillon', tone: 'neutral', icon: 'page' },
  paused: { label: 'En pause', tone: 'warn', icon: 'pause' },
  cancelled: { label: 'Annulée', tone: 'bad', icon: 'x' },
};

export function Chip({ tone, icon, children }: { tone: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`chip chip-${tone}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function CampaignChip({ status }: { status: CampaignStatus }) {
  const s = CAMPAIGN_STATUS[status];
  return <Chip tone={s.tone} icon={s.icon}>{s.label}</Chip>;
}

export function Progress({ value, max, tone = 'run', label }: { value: number; max: number; tone?: string; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`progress progress-${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Sparkline({ values, label, tone = 'fg' }: { values: number[]; label: string; tone?: 'fg' | 'bad' }) {
  const w = 120, h = 36, pad = 3;
  if (values.length < 2) return <span className="sub">Pas encore de données</span>;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / (values.length - 1), h - pad - (v / max) * (h - pad * 2)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={`spark spark-${tone}`}>
      <path d={area} className="spark-area" />
      <path d={line} className="spark-line" fill="none" />
      <circle cx={last[0]} cy={last[1]} r="3" className="spark-dot" />
    </svg>
  );
}

const PROJECT_COLORS = ['#2F7D5B', '#5B4BC4', '#B4532A', '#1F6F9E', '#8E3B74', '#5E6B1F'];

export function projectColor(id: number) {
  return PROJECT_COLORS[(id - 1) % PROJECT_COLORS.length];
}

export function ProjectBadge({ id, name, size = 28 }: { id: number; name: string; size?: number }) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(' ').filter(Boolean);
  const letters = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
  return (
    <span className="project-badge" style={{ background: projectColor(id), width: size, height: size }} aria-hidden="true">
      {letters}
    </span>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return <p className="state state-loading" role="status">{label}</p>;
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Erreur inconnue.';
  return (
    <div className="state state-error" role="alert">
      <Icon name="alert" />
      <p>Le chargement a échoué : {message}</p>
      {retry && <button type="button" className="btn btn-sm" onClick={retry}>Réessayer</button>}
    </div>
  );
}

export function Pager({ page, perPage, total, onPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Précédent</button>
      <span className="small muted num">Page {page} sur {pages}</span>
      <button type="button" className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Suivant</button>
    </nav>
  );
}

// Marks a part of a screen that waits for a backend lot.
export function Upcoming({ lot, children }: { lot: string; children: ReactNode }) {
  return (
    <div className="upcoming-note">
      <span className="chip chip-brand">{lot}</span>
      <p className="small">{children}</p>
    </div>
  );
}

// A short plain-language explanation, folded by default, with a link to the
// matching section of the guide.
export function Explain({ title, guide, children }: { title: string; guide?: string; children: ReactNode }) {
  return (
    <details className="explain">
      <summary><Icon name="help" size={16} /> {title}</summary>
      <div className="explain-body">
        {children}
        {guide && <p><Link className="link" to={`/guide#${guide}`}>Lire la suite dans le guide</Link></p>}
      </div>
    </details>
  );
}
