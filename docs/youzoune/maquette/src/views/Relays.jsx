import { relays, TODAY, DAY_LABELS } from '../data.js';
import { warmupCap, warmupDay, warmupDoneDay, hourlyRate, windowLabel, dailyLimit } from '../sending.js';
import { Icon, Field, QuotaMeter } from '../ui.jsx';

const { useState } = React;

const WEEK = [1, 2, 3, 4, 5, 6, 0];

function WarmupChart({ w, perDay, today }) {
  const days = 30;
  const W = 640, H = 200, L = 40, R = 12, T = 14, B = 28;
  const values = Array.from({ length: days }, (_, i) => Math.min(perDay, warmupCap(w, i + 1)));
  const max = Math.max(perDay, ...values, 1);
  const top = Math.ceil(max / 100) * 100;
  const bw = (W - L - R) / days;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const ticks = [0, top / 2, top];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Plafond journalier du warm-up sur ${days} jours, de ${values[0]} à ${values[days - 1]} e-mails`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
        </g>
      ))}
      {values.map((v, i) => (
        <rect key={i} x={L + i * bw + 1.5} y={y(v)} width={bw - 3} height={Math.max(0, y(0) - y(v))} rx="2"
          className={i + 1 === today ? 'bar bar-today' : i + 1 < today ? 'bar bar-past' : 'bar'} />
      ))}
      {[1, 10, 20, 30].map((d) => (
        <text key={d} x={L + (d - 0.5) * bw} y={H - 8} textAnchor="middle" className="axis">J{d}</text>
      ))}
    </svg>
  );
}

function NumberField({ id, label, value, onChange, unit, min = 0, max = 10000, step = 1 }) {
  return (
    <div className="field field-num">
      <label htmlFor={id}>{label}</label>
      <div className="input-unit">
        <input id={id} type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span>{unit}</span>
      </div>
    </div>
  );
}

export function Relays({ project }) {
  const list = relays.filter((r) => r.project === project.id || r.system);
  const [selId, setSelId] = useState(list[0].id);
  const [edits, setEdits] = useState({});
  const base = list.find((r) => r.id === selId);
  const r = { ...base, ...(edits[selId] || {}), warmup: { ...base.warmup, ...((edits[selId] || {}).warmup || {}) } };
  const set = (patch) => setEdits({ ...edits, [selId]: { ...(edits[selId] || {}), ...patch } });
  const setW = (patch) => set({ warmup: { ...((edits[selId] || {}).warmup || {}), ...patch } });
  const toggleDay = (d) => set({ days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] });

  const day = warmupDay(r, TODAY);
  const doneDay = warmupDoneDay({ ...r.warmup, cap: Math.min(r.warmup.cap, r.perDay) });

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>Relais d’envoi</h1>
        </div>
        <button type="button" className="btn btn-primary"><Icon name="plus" /> Ajouter un relais</button>
      </header>

      <div className="relays">
        <nav className="relay-list" aria-label="Relais">
          {list.map((x) => (
            <button key={x.id} type="button" aria-current={x.id === selId ? 'true' : undefined} onClick={() => setSelId(x.id)}>
              <span className="relay-name">
                <span className={`status-dot ${x.status === 'paused' ? 'warn' : 'ok'}`} aria-hidden="true" />
                <span className="strong">{x.name}</span>
              </span>
              <span className="sub">{x.system ? 'Notifications du système, tous projets' : `${hourlyRate(x)} / h · ${dailyLimit(x, TODAY)} / jour`}</span>
            </button>
          ))}
        </nav>

        <section className="panel relay-detail">
          <div className="relay-detail-head">
            <div>
              <h2>{r.name}</h2>
              <p className="sub mono">{r.host}</p>
            </div>
            {r.system
              ? <span className="chip chip-info"><Icon name="shield" size={13} />Relais système</span>
              : r.status === 'paused'
                ? <span className="chip chip-warn"><Icon name="pause" size={13} />En pause</span>
                : <span className="chip chip-ok"><Icon name="check" size={13} />Actif</span>}
          </div>

          {r.system && (
            <p className="note">Confirmations d’inscription, mots de passe et alertes de l’équipe partent toujours par ce relais. Aucune campagne ne peut l’utiliser.</p>
          )}

          <dl className="health">
            <div><dt>Aujourd’hui</dt><dd><QuotaMeter sent={r.sentToday} limit={r.status === 'paused' ? 0 : dailyLimit(r, TODAY)} /></dd></div>
            <div><dt>Rebonds sur 7 jours</dt><dd className={`num big ${r.bounceRate >= 3 ? 'bad' : ''}`}>{r.bounceRate.toLocaleString('fr-FR')} %</dd></div>
            <div><dt>Plaintes</dt><dd className="num big">{r.complaintRate.toLocaleString('fr-FR')} %</dd></div>
          </dl>

          <h3>Cadence</h3>
          <div className="grid-3">
            <NumberField id="per-min" label="Par minute" unit="e-mails" value={r.perMinute} onChange={(v) => set({ perMinute: v })} />
            <NumberField id="per-hour" label="Par heure" unit="e-mails" value={r.perHour} onChange={(v) => set({ perHour: v })} />
            <NumberField id="per-day" label="Par jour" unit="e-mails" value={r.perDay} onChange={(v) => set({ perDay: v })} />
          </div>
          <p className="small muted">Débit réel : {hourlyRate(r)} e-mails par heure (la limite la plus basse l’emporte).</p>

          <h3>Plage d’envoi</h3>
          <div className="day-toggles" role="group" aria-label="Jours d’envoi">
            {WEEK.map((d) => (
              <button key={d} type="button" aria-pressed={r.days.includes(d)} onClick={() => toggleDay(d)}>{DAY_LABELS[d]}</button>
            ))}
          </div>
          <div className="grid-3">
            <NumberField id="from-h" label="De" unit="h" min={0} max={23} value={r.fromHour} onChange={(v) => set({ fromHour: v })} />
            <NumberField id="to-h" label="À" unit="h" min={1} max={24} value={r.toHour} onChange={(v) => set({ toHour: v })} />
          </div>
          <p className="small muted">Envois {windowLabel(r, DAY_LABELS)}, heure de Paris. Hors plage, les campagnes attendent sans rien perdre.</p>

          {!r.system && (
            <>
              <div className="h3-row">
                <h3>Warm-up</h3>
                <label className="switch" htmlFor="wu-on">
                  <input id="wu-on" type="checkbox" checked={r.warmup.enabled} onChange={(e) => setW({ enabled: e.target.checked })} />
                  <span>{r.warmup.enabled ? 'Activé' : 'Désactivé'}</span>
                </label>
              </div>
              {r.warmup.enabled ? (
                <>
                  <div className="grid-3">
                    <NumberField id="wu-start" label="Volume du 1er jour" unit="e-mails" value={r.warmup.start} onChange={(v) => setW({ start: v })} />
                    <NumberField id="wu-growth" label="Hausse par jour" unit="%" max={100} value={r.warmup.growth} onChange={(v) => setW({ growth: v })} />
                    <NumberField id="wu-cap" label="Plafond" unit="e-mails" value={r.warmup.cap} onChange={(v) => setW({ cap: v })} />
                  </div>
                  <WarmupChart w={r.warmup} perDay={r.perDay} today={day} />
                  <p className="small">
                    Mis en service le {r.warmup.since.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}, aujourd’hui c’est le <span className="strong">jour {day}</span> : plafond de <span className="strong num">{dailyLimit(r, TODAY)}</span> e-mails.
                    {doneDay ? (day >= doneDay ? ' Le rythme de croisière est atteint.' : ` Rythme de croisière au jour ${doneDay}.`) : ''}
                  </p>
                </>
              ) : <p className="small muted">Le relais envoie directement à sa limite journalière.</p>}
            </>
          )}

          <div className="row-gap end">
            <button type="button" className="btn">Tester la connexion</button>
            <button type="button" className="btn btn-dark" disabled={!edits[selId]}>Enregistrer</button>
          </div>
        </section>
      </div>
    </div>
  );
}
