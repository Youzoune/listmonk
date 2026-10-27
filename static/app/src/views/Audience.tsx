import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { query } from '../api/client';
import { useLists, useSubscribers } from '../api/hooks';
import type { Subscriber } from '../api/types';
import { Chip, ErrorState, Field, Icon, Loading, Pager } from '../components/ui';
import { date, num } from '../lib/format';
import { useProject } from '../project';

const PER_PAGE = 25;

const STATUSES = [
  { id: '', label: 'Tous' },
  { id: 'enabled', label: 'Actifs' },
  { id: 'blocklisted', label: 'Liste noire' },
  { id: 'disabled', label: 'Désactivés' },
];

function SubscriberStatus({ s }: { s: Subscriber }) {
  if (s.status === 'blocklisted') return <Chip tone="bad" icon="x">Liste noire</Chip>;
  if (s.status === 'disabled') return <Chip tone="neutral">Désactivé</Chip>;
  if (s.lists.length > 0 && s.lists.every((l) => l.subscription_status === 'unsubscribed')) return <Chip tone="neutral" icon="back">Désinscrit</Chip>;
  if (s.lists.some((l) => l.subscription_status === 'unconfirmed')) return <Chip tone="warn" icon="clock">À confirmer</Chip>;
  return <Chip tone="ok" icon="check">Actif</Chip>;
}

const attr = (s: Subscriber, k: string) => (typeof s.attribs[k] === 'string' ? (s.attribs[k] as string) : '');

export function Audience() {
  const { project, can } = useProject();
  const [params, setParams] = useSearchParams();
  const status = params.get('statut') ?? '';
  const listId = Number(params.get('liste')) || undefined;
  const page = Number(params.get('page')) || 1;
  const [q, setQ] = useState(params.get('q') ?? '');
  const sql = params.get('sql') ?? '';
  const [sqlDraft, setSqlDraft] = useState(sql);
  const [advanced, setAdvanced] = useState(!!sql);
  const canSql = can('subscribers:sql_query');

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') === q) return;
      const next = new URLSearchParams(params);
      if (q) next.set('q', q); else next.delete('q');
      next.delete('page');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [q, params, setParams]);

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next);
  };

  const lists = useLists(project.id);
  const subs = useSubscribers(project.id, { search: params.get('q') ?? '', sql: canSql ? sql : '', status, listId, page, perPage: PER_PAGE });
  const activeLists = (lists.data?.results ?? []).filter((l) => l.status === 'active');

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>Audience</h1>
        </div>
        <div className="row-gap">
          <Link className="btn" to="/listes">Gérer les listes</Link>
          {can('bounces:get') && <Link className="btn btn-ghost" to="/rebonds">Rebonds</Link>}
          {can('subscribers:import') && <Link className="btn" to="/audience/import">Importer un fichier</Link>}
          {can('subscribers:manage') && <Link className="btn btn-primary" to="/audience/nouveau"><Icon name="plus" /> Nouveau contact</Link>}
        </div>
      </header>

      {lists.isError ? <ErrorState error={lists.error} /> : (
        <div className="list-strip" role="group" aria-label="Filtrer par liste">
          <button type="button" className={`list-card ${!listId ? 'is-on' : ''}`} aria-pressed={!listId} onClick={() => set('liste', null)}>
            <span className="sub">Toutes les listes</span>
            <span className="strong">Contacts du projet</span>
            <span className="num list-count">{subs.data && !listId && !status && !params.get('q') ? num(subs.data.total) : '—'}</span>
          </button>
          {activeLists.map((l) => (
            <button key={l.id} type="button" className={`list-card ${listId === l.id ? 'is-on' : ''}`} aria-pressed={listId === l.id} onClick={() => set('liste', String(l.id))}>
              <span className="sub">{l.type === 'public' ? 'Publique' : 'Privée'}</span>
              <span className="strong">{l.name}</span>
              <span className="num list-count">{num(l.subscriber_count)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filtrer par statut">
          {STATUSES.map((s) => (
            <button key={s.id} type="button" aria-pressed={status === s.id} onClick={() => set('statut', s.id || null)}>{s.label}</button>
          ))}
        </div>
        <label className="search" htmlFor="aud-search">
          <Icon name="search" />
          <input id="aud-search" type="search" placeholder="Nom ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {canSql && (
          <button type="button" className="btn btn-sm btn-ghost" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>Recherche avancée</button>
        )}
      </div>
      {canSql && advanced && (
        <form className="panel sql-search" onSubmit={(e) => { e.preventDefault(); set('sql', sqlDraft.trim() || null); }}>
          <Field id="aud-sql" label="Condition SQL sur les contacts"
            hint={<>Par exemple <span className="mono">subscribers.attribs-&gt;&gt;'ville' = 'Rouen'</span> ou <span className="mono">subscribers.created_at &gt; NOW() - INTERVAL '30 days'</span>.</>}>
            <textarea id="aud-sql" rows={2} className="mono" spellCheck={false} value={sqlDraft} onChange={(e) => setSqlDraft(e.target.value)} />
          </Field>
          <div className="row-gap end">
            {sql && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setSqlDraft(''); set('sql', null); }}>Effacer</button>}
            <button type="submit" className="btn btn-sm btn-dark">Rechercher</button>
          </div>
        </form>
      )}

      {subs.isPending ? <Loading /> : subs.isError ? <ErrorState error={subs.error} retry={() => subs.refetch()} /> : (
        <>
          <div className="row-gap between">
            <p className="small muted num">{num(subs.data.total)} contact{subs.data.total > 1 ? 's' : ''}</p>
            {subs.data.total > 0 && (
              // The project travels in the relais_project cookie, so a plain link downloads the file.
              <a className="btn btn-sm btn-ghost" download
                href={`/api/subscribers/export${query({ search: params.get('q') ?? '', query: canSql ? sql : '', status, list_id: listId })}`}>
                Exporter en CSV
              </a>
            )}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Contact</th>
                  <th scope="col">Organisation</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Listes</th>
                  <th scope="col">Mis à jour</th>
                </tr>
              </thead>
              <tbody>
                {subs.data.results.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link className="strong plain-link" to={`/audience/${s.id}`}>{s.name}</Link>
                      <span className="sub mono">{s.email}</span>
                    </td>
                    <td>
                      <span>{attr(s, 'organisation') || <span className="muted">—</span>}</span>
                      {attr(s, 'ville') && <span className="sub">{attr(s, 'ville')}</span>}
                    </td>
                    <td><SubscriberStatus s={s} /></td>
                    <td>
                      {s.lists.map((l) => (
                        <span key={l.id} className={`block small ${l.subscription_status === 'unsubscribed' ? 'struck' : ''}`}>{l.name}</span>
                      ))}
                    </td>
                    <td className="muted small">{date(s.updated_at)}</td>
                  </tr>
                ))}
                {subs.data.results.length === 0 && <tr><td colSpan={5} className="empty">Aucun contact ne correspond.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={page} perPage={PER_PAGE} total={subs.data.total} onPage={(p) => set('page', String(p))} />
        </>
      )}
    </div>
  );
}
