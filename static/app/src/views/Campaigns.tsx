import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useCampaigns } from '../api/hooks';
import type { CampaignStatus } from '../api/types';
import { CampaignChip, ErrorState, Icon, Loading, Pager, Progress } from '../components/ui';
import { date, dateTime, num, percent, relayLabel } from '../lib/format';
import { useProject } from '../project';

const FILTERS: { id: string; label: string; status?: CampaignStatus[] }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'running', label: 'En cours', status: ['running', 'paused'] },
  { id: 'scheduled', label: 'Planifiées', status: ['scheduled'] },
  { id: 'draft', label: 'Brouillons', status: ['draft'] },
  { id: 'finished', label: 'Terminées', status: ['finished', 'cancelled'] },
];
const PER_PAGE = 20;

export function Campaigns() {
  const { project, can } = useProject();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.find((f) => f.id === params.get('statut')) ?? FILTERS[0];
  const page = Number(params.get('page')) || 1;
  const [q, setQ] = useState(params.get('q') ?? '');

  // Debounce the search box into the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (q) next.set('q', q); else next.delete('q');
      if ((params.get('q') ?? '') !== q) {
        next.delete('page');
        setParams(next, { replace: true });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, params, setParams]);

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next);
  };

  const res = useCampaigns(project.id, { status: filter.status, search: params.get('q') ?? '', page, perPage: PER_PAGE });
  // Set by the new-campaign wizard after a successful save.
  const flash = useLocation().state as { created?: string; status?: CampaignStatus } | null;
  const created = flash?.created;
  const createdText = flash?.status === 'running' ? 'est lancée' : flash?.status === 'scheduled' ? 'est planifiée' : 'est enregistrée en brouillon';

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>Campagnes</h1>
        </div>
        {can('campaigns:manage_all', 'campaigns:manage') && (
          <Link className="btn btn-primary" to="/campagnes/nouvelle"><Icon name="plus" /> Nouvelle campagne</Link>
        )}
      </header>

      {created && (
        <div className="alert alert-ok" role="status">
          <Icon name="check" />
          <p>« {created} » {createdText}.</p>
        </div>
      )}

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filtrer par statut">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter.id === f.id} onClick={() => set('statut', f.id === 'all' ? null : f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="search" htmlFor="camp-search">
          <Icon name="search" />
          <input id="camp-search" type="search" placeholder="Nom ou objet" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {res.isPending ? <Loading /> : res.isError ? <ErrorState error={res.error} retry={() => res.refetch()} /> : (
        <>
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
                  <th scope="col" className="right">Clics</th>
                  <th scope="col" className="right">Rebonds</th>
                </tr>
              </thead>
              <tbody>
                {res.data.results.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="strong plain-link" to={`/campagnes/${c.id}`}>{c.name}</Link>
                      <span className="sub">{c.subject}</span>
                    </td>
                    <td>
                      <CampaignChip status={c.status} />
                      {c.status === 'scheduled' && <span className="sub">{dateTime(c.send_at)}</span>}
                    </td>
                    <td>
                      {c.lists.length ? c.lists.map((l) => <span key={l.id} className="block">{l.name}</span>) : <span className="muted">Aucune liste</span>}
                    </td>
                    <td><span className="mono-chip">{relayLabel(c.messenger)}</span></td>
                    <td>
                      {c.status === 'draft' || c.status === 'scheduled' ? <span className="sub">Créée le {date(c.created_at)}</span> : (
                        <div className="cell-progress">
                          <Progress value={c.sent} max={c.to_send} tone={c.status === 'paused' ? 'warn' : c.status === 'finished' ? 'ok' : 'run'} label={`${c.sent} sur ${c.to_send}`} />
                          <span className="sub num">{num(c.sent)} / {num(c.to_send)}</span>
                        </div>
                      )}
                    </td>
                    <td className="right num">{percent(c.views, c.sent)}</td>
                    <td className="right num">{c.sent ? num(c.clicks) : '—'}</td>
                    <td className={`right num ${c.sent >= 20 && c.bounces / c.sent >= 0.03 ? 'text-bad' : ''}`}>{c.sent ? num(c.bounces) : '—'}</td>
                  </tr>
                ))}
                {res.data.results.length === 0 && (
                  <tr><td colSpan={8} className="empty">Aucune campagne ne correspond à ce filtre.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={page} perPage={PER_PAGE} total={res.data.total} onPage={(p) => set('page', String(p))} />
        </>
      )}
    </div>
  );
}
