import { useEffect, useState } from 'react';
import { useRelays, useSaveRelay } from '../api/hooks';
import type { Relay, RelayCadence, RelayWarmup } from '../api/types';
import { Link, useSearchParams } from 'react-router';
import { Chip, ErrorState, Explain, Icon, Loading } from '../components/ui';
import { dateTime, num } from '../lib/format';
import { PRESETS, applyPreset, matchingPreset, type Preset } from '../lib/presets';
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

function PresetPicker({ disabled, current, onApply }: { disabled: boolean; current?: Preset; onApply: (p: Preset) => void }) {
  const [id, setId] = useState(current?.id ?? '');
  const chosen = PRESETS.find((p) => p.id === id);
  const group = (kind: Preset['kind']) => PRESETS.filter((p) => p.kind === kind).map((p) => <option key={p.id} value={p.id}>{p.name}</option>);
  return (
    <div className="preset">
      <div className="field">
        <label htmlFor="preset">Partir d’une préconfiguration</label>
        <div className="preset-row">
          <select id="preset" value={id} disabled={disabled} onChange={(e) => setId(e.target.value)}>
            <option value="">Choisir…</option>
            <optgroup label="Selon votre situation">{group('profile')}</optgroup>
            <optgroup label="Selon votre fournisseur">{group('provider')}</optgroup>
          </select>
          <button type="button" className="btn" disabled={disabled || !chosen} onClick={() => chosen && onApply(chosen)}>Appliquer</button>
        </div>
        <p className="hint">Remplit la cadence et le warm-up ci-dessous. Rien n’est enregistré avant de cliquer sur Enregistrer.</p>
      </div>
      {chosen && (
        <div className="preset-card">
          <p className="strong">{chosen.name}</p>
          <p className="small">{chosen.when}</p>
          {chosen.limits && <p className="small"><span className="strong">Limite du fournisseur :</span> {chosen.limits} Relais garde une marge d’environ 10 %.</p>}
          {chosen.source && <p className="small"><a className="link" href={chosen.source} target="_blank" rel="noreferrer">Source</a> · valeurs relevées en octobre 2026, à vérifier si votre offre a changé.</p>}
        </div>
      )}
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
  const [applied, setApplied] = useState<Preset | null>(null);
  const status = relay.status;
  const current = matchingPreset(cadence, warmup);

  const apply = (p: Preset) => {
    const next = applyPreset(p, cadence, warmup);
    setCadence(next.cadence);
    setWarmup(next.warmup);
    setApplied(p);
  };

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
        <>
          {relay.example && (
            <div className="alert alert-bad alert-stack" role="alert">
              <p className="strong">Aucun vrai serveur d’envoi : les campagnes ne partiront pas.</p>
              <p className="small">
                {relay.servers ? 'Les serveurs ci-dessous sont les exemples créés à l’installation.' : 'Le relais par défaut n’a aucun serveur actif.'}
                {' '}Ajoutez votre adresse d’envoi : elle remplacera les exemples.
              </p>
              {can('settings:manage') && <Link className="btn btn-primary self-start" to="/relais/nouveau"><Icon name="plus" /> Configurer mon serveur d’envoi</Link>}
            </div>
          )}
          <h3>Serveurs utilisés</h3>
          {(relay.members ?? []).length === 0 ? <p className="small muted">Aucun.</p> : (
            <ul className="member-list">
              {(relay.members ?? []).map((m) => (
                <li key={m.uuid || m.host}>
                  <span className="mono">{m.host}:{m.port}</span>
                  {m.name && <span className="sub">relais « {relayName(m)} »</span>}
                  {m.example && <Chip tone="warn">Exemple, à remplacer</Chip>}
                </li>
              ))}
            </ul>
          )}
          <p className="note">
            Le relais par défaut répartit les envois sur ces serveurs, au rythme global de l’instance. Pour qu’un serveur ait son propre
            rythme et son warm-up, créez-le avec « Nouveau relais ».
          </p>
          {can('settings:manage') && <Link className="btn self-start" to="/reglages?onglet=smtp">Modifier les serveurs</Link>}
        </>
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
          <Explain title="Pourquoi un relais à part pour les notifications ?">
            <p>
              Une confirmation d’inscription doit arriver dans la minute, même quand une grosse newsletter attend son tour ou que le
              relais des campagnes a atteint son quota du jour. Un relais dédié, sans cadence ni warm-up, garde ces e-mails rapides
              et protège leur réputation des aléas des campagnes.
            </p>
          </Explain>

          <h3>Préconfiguration</h3>
          <PresetPicker key={current?.id ?? 'none'} disabled={!canEdit} current={current} onApply={apply} />
          {applied && (
            <p className="saved" role="status"><Icon name="check" size={16} /> « {applied.name} » appliquée. Vérifiez les valeurs, puis enregistrez.</p>
          )}
          {!applied && current && <p className="small muted">Réglages actuels : « {current.name} ».</p>}

          <h3>Cadence</h3>
          <div className="grid-3">
            <NumberField id="per-min" label="Par minute" unit="e-mails" value={cadence.per_minute} onChange={(v) => setC({ per_minute: v })} />
            <NumberField id="per-hour" label="Par heure" unit="e-mails" value={cadence.per_hour} onChange={(v) => setC({ per_hour: v })} />
            <NumberField id="per-day" label="Par jour" unit="e-mails" value={cadence.per_day} onChange={(v) => setC({ per_day: v })} />
          </div>
          <p className="small muted">0 = pas de limite. Les e-mails sont espacés régulièrement dans la minute ; la limite la plus basse l’emporte.</p>
          <Explain title="À quoi sert la cadence ?" guide="cadence">
            <p>
              Votre fournisseur limite le nombre d’e-mails que vous pouvez envoyer (par exemple 200 par heure chez OVHcloud, 2 000
              par jour chez Google Workspace). Au-delà, il bloque le compte pendant des heures. La cadence garde vos campagnes sous
              ces limites et espace les envois, comme le ferait un expéditeur normal.
            </p>
            <p>Si vous ne connaissez pas les limites de votre fournisseur, choisissez-le dans les préconfigurations ci-dessus.</p>
          </Explain>

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
          <Explain title="Pourquoi limiter les jours et les heures ?" guide="cadence">
            <p>
              Un e-mail reçu à 3 h du matin attend des heures sous d’autres messages et a moins de chances d’être ouvert. Or les
              fournisseurs regardent si vos e-mails sont ouverts pour décider de les mettre en spam la fois suivante. Hors de la plage,
              la campagne attend simplement le prochain créneau.
            </p>
          </Explain>

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
          <Explain title="C’est quoi, le warm-up ? En ai-je besoin ?" guide="warmup">
            <p>
              Gmail, Outlook ou Orange se méfient d’un domaine ou d’un serveur qu’ils ne connaissent pas encore : s’il envoie d’un
              coup des milliers d’e-mails, ils les classent en spam. Le warm-up commence petit (par exemple 50 e-mails le premier
              jour) et augmente un peu chaque jour, le temps de gagner leur confiance.
            </p>
            <p>
              <span className="strong">Activez-le</span> pour un nouveau domaine, un nouveau serveur ou une liste restée sans nouvelles
              depuis des mois. <span className="strong">Inutile</span> pour un relais de notifications ou un prestataire comme Brevo qui
              gère déjà la réputation de ses serveurs.
            </p>
          </Explain>

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
              <Link className="btn" to="/reglages?onglet=smtp">Serveur et identifiants</Link>
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
  const { project, can } = useProject();
  const relays = useRelays(project.id);
  const [params] = useSearchParams();
  // ?relais=ovh selects a relay just created.
  const asked = params.get('relais');
  const [selected, setSelected] = useState<string | null>(null);
  // Unnamed servers are part of the default relay: they're listed in it.
  const list = (relays.data ?? []).filter((r) => r.pool || (r.name && r.name !== 'email'));
  const current = list.find((r) => (r.uuid || r.name) === selected)
    ?? (asked ? list.find((r) => r.name === asked || r.name === `email-${asked}`) : undefined)
    ?? list.find((r) => !r.pool) ?? list[0];
  const dedicated = list.filter((r) => !r.pool && r.name && r.name !== 'email').length;

  useEffect(() => setSelected(null), [project.id]);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>Relais d’envoi</h1>
        </div>
        <div className="row-gap">
          <Link className="btn" to="/guide"><Icon name="book" size={16} /> Comprendre le spam et le warm-up</Link>
          {can('settings:manage') && <Link className="btn btn-primary" to="/relais/nouveau"><Icon name="plus" /> Nouveau relais</Link>}
        </div>
      </header>

      <Explain title="Un relais, c’est quoi ?">
        <p>
          C’est le serveur qui remet vos e-mails aux boîtes de réception : votre messagerie (OVH, Google, Microsoft) ou un service
          d’envoi (Brevo, Mailjet, Amazon SES). Chaque relais a son rythme : combien d’e-mails par minute, par heure, par jour,
          à quelles heures, et une montée progressive (le warm-up) pour ne pas finir en spam.
        </p>
        <p>
          Le <span className="strong">relais par défaut</span> répartit les envois sur les serveurs partagés. Pour envoyer depuis
          une adresse précise avec son propre rythme, créez un relais avec « Nouveau relais » puis choisissez-le dans la campagne.
        </p>
      </Explain>

      {!relays.isPending && dedicated === 0 && can('settings:manage') && (
        <div className="panel empty-cta">
          <div>
            <p className="strong">Aucun relais dédié pour l’instant</p>
            <p className="small muted">Ajoutez l’adresse d’envoi de votre domaine en deux minutes : fournisseur, identifiants, rythme.</p>
          </div>
          <Link className="btn btn-primary" to="/relais/nouveau"><Icon name="plus" /> Créer un relais</Link>
        </div>
      )}

      {relays.isPending ? <Loading /> : relays.isError ? <ErrorState error={relays.error} retry={() => relays.refetch()} /> : (
        <div className="relays">
          <nav className="relay-list" aria-label="Relais">
            {list.map((r) => {
              const id = r.uuid || r.name;
              return (
                <button key={id} type="button" aria-current={current && (current.uuid || current.name) === id ? 'true' : undefined} onClick={() => setSelected(id)}>
                  <span className="relay-name">
                    <span className={`status-dot ${r.example ? 'bad' : !r.enabled ? 'off' : r.status && !r.status.open_now ? 'warn' : 'ok'}`} aria-hidden="true" />
                    <span className="strong">{relayName(r)}</span>
                    {r.project_id !== 0 && <Chip tone="brand">Projet</Chip>}
                  </span>
                  <span className="sub">
                    {r.pool ? (r.example ? 'Aucun vrai serveur : rien ne part' : `${r.servers ?? 0} serveur(s) partagé(s)`) : cadenceSummary(r.cadence, r.warmup)}
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
