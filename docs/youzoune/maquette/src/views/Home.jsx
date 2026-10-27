import { campaigns, relays, lists, week, TODAY } from '../data.js';
import { dailyLimit, estimateEnd, formatEnd, warmupDay, warmupDoneDay } from '../sending.js';
import { Icon, StatusChip, Progress, QuotaMeter, Sparkline } from '../ui.jsx';

const sum = (a) => a.reduce((x, y) => x + y, 0);

export function Home({ project, go }) {
  const pc = campaigns.filter((c) => c.project === project.id);
  const pr = relays.filter((r) => r.project === project.id);
  const running = pc.filter((c) => c.status === 'running' || c.status === 'paused');
  const upcoming = pc.filter((c) => c.status === 'scheduled');
  const w = week[project.id];
  const sentWeek = pc.reduce((n, c) => n + c.sent, 0);

  const alerts = [];
  pr.forEach((r) => {
    if (r.bounceRate >= 3) alerts.push({ tone: 'bad', text: `${r.name} : ${r.bounceRate.toLocaleString('fr-FR')} % de rebonds sur 7 jours. Les envois sont en pause au-delà de 3 %.`, action: 'Voir le relais', to: 'relais' });
  });
  pc.filter((c) => c.status === 'draft' && !c.relay).forEach((c) => {
    alerts.push({ tone: 'warn', text: `« ${c.name} » n'a pas encore de relais d'envoi.`, action: 'Compléter', to: 'nouvelle' });
  });

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Mardi 27 octobre · 10 h 15</p>
          <h1>Aujourd’hui sur {project.name}</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => go('nouvelle')}>
          <Icon name="plus" /> Nouvelle campagne
        </button>
      </header>

      {alerts.length > 0 && (
        <section className="alerts" aria-label="À surveiller">
          {alerts.map((a, i) => (
            <div key={i} className={`alert alert-${a.tone}`}>
              <Icon name="alert" />
              <p>{a.text}</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(a.to)}>{a.action}</button>
            </div>
          ))}
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Envois du jour, par relais</h2>
          <button type="button" className="link" onClick={() => go('relais')}>Gérer les relais <Icon name="arrow" size={15} /></button>
        </div>
        <div className="relay-today">
          {pr.map((r) => {
            const limit = r.status === 'paused' ? 0 : dailyLimit(r, TODAY);
            const day = warmupDay(r, TODAY);
            const done = warmupDoneDay(r.warmup);
            return (
              <div key={r.id} className="relay-today-item">
                <div className="relay-today-top">
                  <strong>{r.name}</strong>
                  {r.status === 'paused'
                    ? <span className="chip chip-warn"><Icon name="pause" size={13} />En pause</span>
                    : r.warmup.enabled && day < done
                      ? <span className="chip chip-brand">Warm-up · jour {day} sur {done}</span>
                      : <span className="chip chip-ok"><Icon name="check" size={13} />Rythme de croisière</span>}
                </div>
                {r.status === 'paused'
                  ? <p className="muted small">Aucun envoi tant que le taux de rebond n'est pas revenu sous 3 %.</p>
                  : <QuotaMeter sent={r.sentToday} limit={limit} />}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>En cours d'envoi</h2>
            <button type="button" className="link" onClick={() => go('campagnes')}>Toutes les campagnes <Icon name="arrow" size={15} /></button>
          </div>
          {running.length === 0 ? <p className="muted">Aucune campagne en cours.</p> : (
            <ul className="stack-list">
              {running.map((c) => {
                const relay = relays.find((r) => r.id === c.relay);
                const est = c.status === 'running' ? estimateEnd(relay, c.total - c.sent, TODAY, relay.sentToday) : null;
                return (
                  <li key={c.id} className="running">
                    <div className="running-top">
                      <span className="strong">{c.name}</span>
                      <StatusChip status={c.status} />
                    </div>
                    <Progress value={c.sent} max={c.total} tone={c.status === 'paused' ? 'warn' : 'run'} label={`${c.sent} sur ${c.total} envoyés`} />
                    <p className="muted small num">
                      {c.sent} / {c.total} envoyés · via {relay.name}
                      {est ? ` · fin estimée ${formatEnd(est.end)}` : ` · ${c.eta}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          {upcoming.length > 0 && (
            <div className="upcoming">
              <h3>Prochains départs</h3>
              {upcoming.map((c) => (
                <div key={c.id} className="upcoming-item">
                  <Icon name="clock" size={16} />
                  <span>
                    <span className="strong">{c.name}</span>
                    <span className="sub num">{c.eta} · {lists.find((l) => l.id === c.list).count} destinataires</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Les 7 derniers jours</h2>
          </div>
          <dl className="kpis">
            <div>
              <dt>Ouvertures</dt>
              <dd className="num">{sum(w.opens)}</dd>
              <Sparkline values={w.opens} label="Ouvertures par jour sur 7 jours" tone="fg" />
            </div>
            <div>
              <dt>Clics</dt>
              <dd className="num">{sum(w.clicks)}</dd>
              <Sparkline values={w.clicks} label="Clics par jour sur 7 jours" tone="fg" />
            </div>
            <div>
              <dt>Rebonds</dt>
              <dd className="num">{sum(w.bounces)}</dd>
              <Sparkline values={w.bounces} label="Rebonds par jour sur 7 jours" tone="bad" />
            </div>
          </dl>
          <p className="muted small num">{sentWeek.toLocaleString('fr-FR')} e-mails envoyés sur les campagnes de ce projet.</p>
        </section>
      </div>
    </div>
  );
}
