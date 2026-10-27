import { useEffect, useState } from 'react';
import { useRelays, useSaveRelay } from '../api/hooks';
import type { Relay, RelayCadence, RelayWarmup } from '../api/types';
import { Chip, ErrorState, Icon, Loading } from '../components/ui';
import { dateTime, num } from '../lib/format';
import { DAY_NAMES, EMPTY_CADENCE, EMPTY_WARMUP, WEEK, cadenceSummary, relayName, toCadence, today, windowSummary } from '../lib/relays';
import { dailyLimit, warmupCap, warmupDay, warmupDoneDay } from '../lib/sending';
import { useProject } from '../project';

const TIMEZONES = ['Europe/Paris', 'Europe/Brussels', 'Europe/Zurich', 'Europe/London', 'America/Montreal', 'Africa/Casablanca', 'UTC'];

function QuotaMeter({ sent, limit }: { sent: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (sent / limit) * 100) : 0;
  return (
    <div className="quota">
      {limit > 0 && <div className="quota-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>}
      <div className="quota-legend num">
        <span><strong>{num(sent)}</strong> envoyé{sent > 1 ? 's' : ''} aujourd’hui</span>
        <span>{limit > 0 ? `${num(Math.max(0, limit - sent))} restants sur ${num(limit)}` : 'pas de plafond journalier'}</span>
      </div>
    </div>
  );
}

function WarmupChart({ cadence, warmup }: { cadence: RelayCadence; warmup: RelayWarmup }) {
  const days = 30;
  const W = 640, H = 200, L = 44, R = 12, T = 14, B = 28;
  const c = toCadence(cadence, warmup);
  const values = Array.from({ length: days }, (_, i) => Math.min(c.perDay, warmupCap(c.warmup, i + 1)));
  const top = Math.max(10, Math.ceil(Math.max(...values, 1) / 10) * 10);
  const bw = (W - L - R) / days;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const current = warmupDay(c, new Date());
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
      aria-label={`Plafond journalier sur ${days} jours, de ${values[0]} à ${values[days - 1]} e-mails`}>
      {[0, top / 2, top].map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" className="axis">{Math.round(t)}</text>
        </g>
      ))}
      {values.map((v, i) => (
        <rect key={i} x={L + i * bw + 1.5} y={y(v)} width={bw - 3} height={Math.max(0, y(0) - y(v))} rx="2"
          className={i + 1 === current ? 'bar bar-today' : i + 1 < current ? 'bar bar-past' : 'bar'} />
      ))}
      {[1, 10, 20, 30].map((d) => (
        <text key={d} x={L + (d - 0.5) * bw} y={H - 8} textAnchor="middle" className="axis">J{d}</text>
      ))}
    </svg>
  );
}

function NumberField({ id, label, value, onChange, unit, min = 0, max = 100000, step = 1, hint }:
  { id: string; label: string; value: number; onChange: (v: number) => void; unit: string; min?: number; max?: number; step?: number; hint?: string }) {
  return (
    <div className="field field-num">
      <label htmlFor={id}>{label}</label>
      <div className="input-unit">
        <input id={id} type="number" min={min} max={max} step={step} value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))} />
        <span>{unit}</span>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function RelayEditor({ relay }: { relay: Relay }) {
  const { project, projects, can } = useProject();
  const canEdit = can('settings:manage') && !relay.pool;
  const save = useSaveRelay(project.id);
  const [cadence, setCadence] = useState<RelayCadence>({ ...EMPTY_CADENCE, ...relay.cadence, days: relay.cadence.days ?? [] });
  // A warm-up that was never set up starts from sensible values instead of zeros.
  const [warmup, setWarmup] = useState<RelayWarmup>(relay.warmup.start > 0 ? { ...EMPTY_WARMUP, ...relay.warmup } : { ...EMPTY_WARMUP, enabled: relay.warmup.enabled });
  const [projectId, setProjectId] = useState(relay.project_id);
  const [system, setSystem] = useState(relay.system);
  const status = relay.status;

  const setC = (patch: Partial<RelayCadence>) => setCadence({ ...cadence, ...patch });
  const setW = (patch: Partial<RelayWarmup>) => setWarmup({ ...warmup, ...patch });
  // No day chosen means every day: clicking a day then leaves it out.
  const toggleDay = (d: number) => {
    const days = (cadence.days ?? []).length ? cadence.days ?? [] : WEEK;
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    setC({ days: next.length === 7 ? [] : next });
  };
  const allDays = (cadence.days ?? []).length === 0;

  const c = toCadence(cadence, warmup);
  const day = warmupDay(c, new Date());
  const doneDay = warmupDoneDay({ ...c.warmup, cap: Math.min(c.warmup.cap, c.perDay) });
  const limitToday = dailyLimit(c, new Date());

  const submit = () => save.mutate({
    uuid: relay.uuid,
    relay: {
      project_id: projectId,
      cadence: { ...cadence, days: cadence.days ?? [] },
      warmup: warmup.enabled && !warmup.since ? { ...warmup, since: today() } : warmup,
      system: system && projectId === 0,
    },
  });
  const saved = save.data;

  return (
    <section className="panel relay-detail">
      <div className="relay-detail-head">
        <div>
          <h2>{relayName(relay)}</h2>
          <p className="sub mono">{relay.pool ? `${relay.servers ?? 0} serveur(s) partagé(s)` : `${relay.host}:${relay.port}`}</p>
        </div>
        <div className="row-gap">
          {relay.system && <Chip tone="info" icon="shield">Notifications système</Chip>}
          {!relay.enabled ? <Chip tone="neutral">Désactivé</Chip>
            : status && !status.open_now ? <Chip tone="warn" icon="clock">Hors plage d’envoi</Chip>
              : <Chip tone="ok" icon="check">Actif</Chip>}
        </div>
      </div>

      {status && (
        <dl className="health">
          <div><dt>Aujourd’hui</dt><dd><QuotaMeter sent={status.sent_today} limit={status.limit_today} /></dd></div>
          {status.warmup_day > 0 && (
            <div><dt>Warm-up</dt><dd className="num big">Jour {status.warmup_day}{status.warmup_done_day ? ` / ${status.warmup_done_day}` : ''}</dd></div>
          )}
          {status.has_cadence && new Date(status.next_send_at).getTime() > Date.now() + 60_000 && (
            <div><dt>Prochain envoi possible</dt><dd>{dateTime(status.next_send_at)}</dd></div>
          )}
        </dl>
      )}

      {relay.pool ? (
        <p className="note">
          Le relais par défaut répartit les envois sur les serveurs SMTP partagés. Il suit la cadence globale de l’instance.
          Pour régler une cadence ou un warm-up, donnez un nom au serveur dans l’ancienne interface et choisissez-le dans la campagne.
        </p>
      ) : (
        <>
          <h3>Projet</h3>
          <div className="field">
            <label htmlFor="relay-project">Utilisable par</label>
            <select id="relay-project" value={projectId} disabled={!canEdit} onChange={(e) => setProjectId(Number(e.target.value))}>
              <option value={0}>Tous les projets (relais partagé)</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name} seulement</option>)}
            </select>
            <p className="hint">Un relais réservé à un projet sort du relais par défaut : aucun autre projet ne peut l’utiliser.</p>
          </div>
          <label className="switch" htmlFor="relay-system">
            <input id="relay-system" type="checkbox" checked={system && projectId === 0} disabled={!canEdit || projectId !== 0}
              onChange={(e) => setSystem(e.target.checked)} />
            <span>Envoyer les notifications système par ce relais (confirmations d’inscription, alertes de l’équipe)</span>
          </label>

          <h3>Cadence</h3>
          <div className="grid-3">
            <NumberField id="per-min" label="Par minute" unit="e-mails" value={cadence.per_minute} onChange={(v) => setC({ per_minute: v })} />
            <NumberField id="per-hour" label="Par heure" unit="e-mails" value={cadence.per_hour} onChange={(v) => setC({ per_hour: v })} />
            <NumberField id="per-day" label="Par jour" unit="e-mails" value={cadence.per_day} onChange={(v) => setC({ per_day: v })} />
          </div>
          <p className="small muted">0 = pas de limite. Les e-mails sont espacés régulièrement dans la minute ; la limite la plus basse l’emporte.</p>

          <h3>Plage d’envoi</h3>
          <div className="day-toggles" role="group" aria-label="Jours d’envoi">
            {WEEK.map((d) => (
              <button key={d} type="button" aria-pressed={allDays || (cadence.days ?? []).includes(d)} disabled={!canEdit} onClick={() => toggleDay(d)}>{DAY_NAMES[d]}</button>
            ))}
          </div>

          <div className="grid-3">
            <NumberField id="from-h" label="De" unit="h" max={23} value={cadence.from_hour} onChange={(v) => setC({ from_hour: Math.min(23, v) })} />
            <NumberField id="to-h" label="À" unit="h" max={24} value={cadence.to_hour} onChange={(v) => setC({ to_hour: Math.min(24, v) })} />
            <div className="field">
              <label htmlFor="tz">Fuseau horaire</label>
              <select id="tz" value={cadence.timezone || 'Europe/Paris'} disabled={!canEdit} onChange={(e) => setC({ timezone: e.target.value })}>
                {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <p className="small muted">{windowSummary(cadence) ? `Envois ${windowSummary(cadence)}.` : 'Envois tous les jours, à toute heure.'} « De 0 à 0 » veut dire toute la journée.</p>

          <div className="h3-row">
            <h3>Warm-up</h3>
            <label className="switch" htmlFor="wu-on">
              <input id="wu-on" type="checkbox" checked={warmup.enabled} disabled={!canEdit} onChange={(e) => setW({ enabled: e.target.checked })} />
              <span>{warmup.enabled ? 'Activé' : 'Désactivé'}</span>
            </label>
          </div>
          {warmup.enabled ? (
            <>
              <div className="grid-3">
                <NumberField id="wu-start" label="Volume du 1er jour" unit="e-mails" min={1} value={warmup.start} onChange={(v) => setW({ start: v })} />
                <NumberField id="wu-growth" label="Hausse par jour" unit="%" max={1000} value={warmup.growth} onChange={(v) => setW({ growth: v })} />
                <NumberField id="wu-cap" label="Plafond" unit="e-mails" min={1} value={warmup.cap} onChange={(v) => setW({ cap: v })} />
              </div>
              <div className="field">
                <label htmlFor="wu-since">Mis en service le</label>
                <input id="wu-since" type="date" value={warmup.since || today()} disabled={!canEdit} onChange={(e) => setW({ since: e.target.value })} />
              </div>
              <WarmupChart cadence={cadence} warmup={warmup} />
              <p className="small">
                Aujourd’hui : <span className="strong">jour {Math.max(day, 0)}</span>, plafond de{' '}
                <span className="strong num">{Number.isFinite(limitToday) ? num(limitToday) : '—'}</span> e-mails.
                {doneDay ? (day >= doneDay ? ' Le rythme de croisière est atteint.' : ` Rythme de croisière au jour ${doneDay}.`) : ''}
              </p>
            </>
          ) : <p className="small muted">Sans warm-up, le relais envoie directement jusqu’à sa limite journalière.</p>}

          <p className="small muted">En une ligne : {cadenceSummary(cadence, warmup)}.</p>

          {save.isError && <ErrorState error={save.error} />}
          {save.isSuccess && (
            <p className="saved" role="status">
              <Icon name="check" size={16} />
              {typeof saved === 'object' && saved?.needs_restart
                ? 'Enregistré. Des campagnes sont en cours : les changements s’appliqueront au prochain redémarrage.'
                : 'Enregistré et appliqué.'}
            </p>
          )}
          {canEdit && (
            <div className="row-gap end">
              <a className="btn" href="/admin/settings">Serveur et identifiants</a>
              <button type="button" className="btn btn-dark" disabled={save.isPending} onClick={submit}>
                {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function Relays() {
  const { project } = useProject();
  const relays = useRelays(project.id);
  const [selected, setSelected] = useState<string | null>(null);
  const list = relays.data ?? [];
  const current = list.find((r) => (r.uuid || r.name) === selected) ?? list.find((r) => !r.pool) ?? list[0];

  useEffect(() => setSelected(null), [project.id]);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>Relais d’envoi</h1>
        </div>
      </header>

      {relays.isPending ? <Loading /> : relays.isError ? <ErrorState error={relays.error} retry={() => relays.refetch()} /> : (
        <div className="relays">
          <nav className="relay-list" aria-label="Relais">
            {list.map((r) => {
              const id = r.uuid || r.name;
              return (
                <button key={id} type="button" aria-current={current && (current.uuid || current.name) === id ? 'true' : undefined} onClick={() => setSelected(id)}>
                  <span className="relay-name">
                    <span className={`status-dot ${!r.enabled ? 'off' : r.status && !r.status.open_now ? 'warn' : 'ok'}`} aria-hidden="true" />
                    <span className="strong">{relayName(r)}</span>
                    {r.project_id !== 0 && <Chip tone="brand">Projet</Chip>}
                  </span>
                  <span className="sub">
                    {r.pool ? `${r.servers ?? 0} serveur(s) partagé(s)` : cadenceSummary(r.cadence, r.warmup)}
                    {r.status ? ` · ${num(r.status.sent_today)} aujourd’hui` : ''}
                  </span>
                </button>
              );
            })}
          </nav>
          {current && <RelayEditor key={`${current.uuid || current.name}-${JSON.stringify(current.cadence)}-${JSON.stringify(current.warmup)}-${current.project_id}-${current.system}`} relay={current} />}
        </div>
      )}
    </div>
  );
}
