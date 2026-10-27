// Shared building blocks: icons, logo, status chips, meters and charts.

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  send: 'M21 3 10 14M21 3l-7 18-4-7-7-4z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.9M15.5 3.1a3.5 3.5 0 0 1 0 6.8',
  relay: 'M4 7h11M4 7l3-3M4 7l3 3M20 17H9M20 17l-3-3M20 17l-3 3',
  page: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
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
  filter: 'M4 5h16l-6 7v6l-4 2v-8z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
};

export function Icon({ name, size = 18, label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : 'true'} role={label ? 'img' : undefined}
      aria-label={label} className="icon">
      <path d={ICONS[name]} />
    </svg>
  );
}

// Logo: a rising ramp of four bars (the warm-up), handed over to the next one.
export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <rect x="7" y="18" width="3.6" height="7" rx="1.8" fill="var(--brand-ink)" />
      <rect x="12.4" y="14" width="3.6" height="11" rx="1.8" fill="var(--brand-ink)" />
      <rect x="17.8" y="10" width="3.6" height="15" rx="1.8" fill="var(--brand-ink)" />
      <path d="M23.2 7.5h3.3v3.3" fill="none" stroke="var(--brand-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26.5 7.5 21.6 12.4" fill="none" stroke="var(--brand-ink)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 28 }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">relais</span>
    </span>
  );
}

const STATUS = {
  running: { label: 'En cours', tone: 'run', icon: 'play' },
  scheduled: { label: 'Planifiée', tone: 'info', icon: 'clock' },
  finished: { label: 'Terminée', tone: 'ok', icon: 'check' },
  draft: { label: 'Brouillon', tone: 'neutral', icon: 'page' },
  paused: { label: 'En pause', tone: 'warn', icon: 'pause' },
  active: { label: 'Actif', tone: 'ok', icon: 'check' },
  replied: { label: 'A répondu', tone: 'brand', icon: 'mail' },
  unsubscribed: { label: 'Désinscrit', tone: 'neutral', icon: 'back' },
  bounced: { label: 'Rebond', tone: 'bad', icon: 'alert' },
};

export function StatusChip({ status }) {
  const s = STATUS[status];
  return (
    <span className={`chip chip-${s.tone}`}>
      <Icon name={s.icon} size={13} />
      {s.label}
    </span>
  );
}

export function Progress({ value, max, tone = 'fg', label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`progress progress-${tone}`} role="progressbar" aria-valuemin="0" aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

// Daily quota meter: what was sent, what is left today and the ceiling.
export function QuotaMeter({ sent, limit }) {
  const pct = limit > 0 ? Math.min(100, (sent / limit) * 100) : 0;
  return (
    <div className="quota">
      <div className="quota-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <div className="quota-legend num">
        <span><strong>{sent}</strong> envoyés</span>
        <span>{Math.max(0, limit - sent)} restants sur {limit}</span>
      </div>
    </div>
  );
}

export function Sparkline({ values, label, tone = 'fg' }) {
  const w = 120, h = 36, pad = 3;
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

export function EngagementDots({ level }) {
  return (
    <span className="dots" role="img" aria-label={`Engagement ${level} sur 3`}>
      {[1, 2, 3].map((i) => <span key={i} className={i <= level ? 'on' : ''} />)}
    </span>
  );
}

export function ProjectBadge({ project, size = 28 }) {
  return (
    <span className="project-badge" style={{ background: project.color, width: size, height: size }} aria-hidden="true">
      {project.initials}
    </span>
  );
}

export function Field({ id, label, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}
