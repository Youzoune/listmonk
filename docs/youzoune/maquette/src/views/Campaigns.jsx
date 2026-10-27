import { campaigns, relays, lists, TODAY } from '../data.js';
import { estimateEnd, formatEnd } from '../sending.js';
import { Icon, StatusChip, Progress } from '../ui.jsx';

const { useState } = React;

const FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'running', label: 'En cours' },
  { id: 'scheduled', label: 'Planifiées' },
  { id: 'draft', label: 'Brouillons' },
  { id: 'finished', label: 'Terminées' },
];

const pct = (n, d) => (d > 0 ? `${Math.round((n / d) * 100)} %` : '—');

export function Campaigns({ project, go }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const pc = campaigns.filter((c) => c.project === project.id);
  const shown = pc.filter((c) =>
    (filter === 'all' || c.status === filter || (filter === 'running' && c.status === 'paused')) &&
    (q === '' || (c.name + ' ' + c.subject).toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>Campagnes</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => go('nouvelle')}>
          <Icon name="plus" /> Nouvelle campagne
        </button>
      </header>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filtrer par statut">
          {FILTERS.map((f) => {
            const n = f.id === 'all' ? pc.length : pc.filter((c) => c.status === f.id || (f.id === 'running' && c.status === 'paused')).length;
            return (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label} <span className="count num">{n}</span>
              </button>
            );
          })}
        </div>
        <label className="search" htmlFor="camp-search">
          <Icon name="search" />
          <input id="camp-search" type="search" placeholder="Rechercher une campagne" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Campagne</th>
              <th scope="col">Statut</th>
              <th scope="col">Audience</th>
              <th scope="col">Relais</th>
              <th scope="col">Avancement</th>
              <th scope="col" className="right">Ouverture</th>
              <th scope="col" className="right">Réponses</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const relay = relays.find((r) => r.id === c.relay);
              const list = lists.find((l) => l.id === c.list);
              const est = c.status === 'running' ? estimateEnd(relay, c.total - c.sent, TODAY, relay.sentToday) : null;
              return (
                <tr key={c.id}>
                  <td>
                    <span className="strong">{c.name}</span>
                    <span className="sub">{c.subject}</span>
                  </td>
                  <td><StatusChip status={c.status} /></td>
                  <td>
                    <span>{list.name}</span>
                    <span className="sub num">{list.count} contacts</span>
                  </td>
                  <td>{relay ? <span className="mono-chip">{relay.name}</span> : <span className="muted">À choisir</span>}</td>
                  <td className="cell-progress">
                    {c.status === 'draft' ? <span className="muted">—</span> : (
                      <>
                        <Progress value={c.sent} max={c.total} tone={c.status === 'paused' ? 'warn' : c.status === 'finished' ? 'ok' : 'run'} label={`${c.sent} sur ${c.total}`} />
                        <span className="sub num">{c.sent} / {c.total} · {est ? `fin ${formatEnd(est.end)}` : c.eta}</span>
                      </>
                    )}
                  </td>
                  <td className="right num">{pct(c.opens, c.sent)}</td>
                  <td className="right num">{c.sent ? c.replies : '—'}</td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan="7" className="empty">Aucune campagne ne correspond à ce filtre.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
