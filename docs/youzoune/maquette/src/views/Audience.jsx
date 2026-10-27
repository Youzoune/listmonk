import { contacts, lists } from '../data.js';
import { Icon, StatusChip, EngagementDots } from '../ui.jsx';

const { useState } = React;

const SEGMENTS = [
  { id: 'all', label: 'Tous', test: () => true },
  { id: 'hot', label: 'Engagés', test: (c) => c.engagement >= 2 && c.status !== 'unsubscribed' },
  { id: 'replied', label: 'Ont répondu', test: (c) => c.status === 'replied' },
  { id: 'never', label: 'Jamais contactés', test: (c) => c.last.startsWith('pas encore') },
  { id: 'issues', label: 'Rebonds et désinscrits', test: (c) => c.status === 'bounced' || c.status === 'unsubscribed' },
];

export function Audience({ project }) {
  const [seg, setSeg] = useState('all');
  const [q, setQ] = useState('');
  const pcs = contacts.filter((c) => c.project === project.id);
  const pl = lists.filter((l) => l.project === project.id);
  const s = SEGMENTS.find((x) => x.id === seg);
  const shown = pcs.filter((c) => s.test(c) && (q === '' || `${c.name} ${c.email} ${c.org} ${c.city}`.toLowerCase().includes(q.toLowerCase())));
  const total = pl.reduce((n, l) => n + l.count, 0);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>Audience</h1>
        </div>
        <div className="row-gap">
          <button type="button" className="btn">Importer un fichier</button>
          <button type="button" className="btn btn-primary"><Icon name="plus" /> Ajouter un contact</button>
        </div>
      </header>

      <div className="list-strip">
        {pl.map((l) => (
          <div key={l.id} className="list-card">
            <span className="sub">{l.kind}</span>
            <span className="strong">{l.name}</span>
            <span className="num list-count">{l.count.toLocaleString('fr-FR')}</span>
          </div>
        ))}
        <div className="list-card list-total">
          <span className="sub">Total projet</span>
          <span className="strong">Contacts uniques</span>
          <span className="num list-count">{total.toLocaleString('fr-FR')}</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Segments">
          {SEGMENTS.map((x) => (
            <button key={x.id} type="button" aria-pressed={seg === x.id} onClick={() => setSeg(x.id)}>
              {x.label} <span className="count num">{pcs.filter(x.test).length}</span>
            </button>
          ))}
        </div>
        <label className="search" htmlFor="aud-search">
          <Icon name="search" />
          <input id="aud-search" type="search" placeholder="Nom, e-mail, organisation, ville" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Contact</th>
              <th scope="col">Organisation</th>
              <th scope="col">Statut</th>
              <th scope="col">Engagement</th>
              <th scope="col">Dernière activité</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.email}>
                <td>
                  <span className="strong">{c.name}</span>
                  <span className="sub mono">{c.email}</span>
                </td>
                <td>
                  <span>{c.org}</span>
                  <span className="sub">{c.city} · {c.lists.map((id) => lists.find((l) => l.id === id).name).join(', ')}</span>
                </td>
                <td><StatusChip status={c.status} /></td>
                <td><EngagementDots level={c.engagement} /></td>
                <td className="muted">{c.last}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan="5" className="empty">Aucun contact dans ce segment.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted">Un contact appartient à un seul projet : se désinscrire de {project.name} n’a aucun effet sur les autres projets.</p>
    </div>
  );
}
