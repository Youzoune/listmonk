import { useState } from 'react';
import { Link } from 'react-router';
import { useBounceAction, useBounces } from '../api/hooks';
import { Chip, ErrorState, Explain, Loading, Pager } from '../components/ui';
import { dateTime, num } from '../lib/format';
import { useProject } from '../project';

const TYPES = {
  hard: { label: 'Définitif', tone: 'bad' as const },
  soft: { label: 'Temporaire', tone: 'warn' as const },
  complaint: { label: 'Plainte (spam)', tone: 'bad' as const },
};

export function Bounces() {
  const { project, can } = useProject();
  const [page, setPage] = useState(1);
  const bounces = useBounces(project.id, page);
  const action = useBounceAction(project.id);
  const [selected, setSelected] = useState<number[]>([]);
  const canManage = can('bounces:manage');
  const rows = bounces.data?.results ?? [];
  const all = rows.length > 0 && rows.every((b) => selected.includes(b.id));

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <Link className="link back" to="/audience">Audience</Link>
          <h1>Rebonds</h1>
        </div>
      </header>

      <Explain title="C’est quoi, un rebond ?">
        <p>
          Un rebond est un e-mail refusé par le serveur du destinataire. <span className="strong">Définitif</span> : l’adresse n’existe pas ou plus.
          <span className="strong"> Temporaire</span> : boîte pleine, serveur indisponible. <span className="strong">Plainte</span> : la personne a
          cliqué sur « spam ». Relais met automatiquement en liste noire selon les règles des réglages ; au-delà de 2 % de rebonds, nettoyez vos listes.
        </p>
      </Explain>

      {canManage && selected.length > 0 && (
        <div className="panel schedule-bar">
          <span className="small strong">{num(selected.length)} sélectionné{selected.length > 1 ? 's' : ''}</span>
          <button type="button" className="btn btn-sm" disabled={action.isPending} onClick={() => action.mutate({ ids: selected, action: 'blocklist' }, { onSuccess: () => setSelected([]) })}>Mettre les contacts en liste noire</button>
          <button type="button" className="btn btn-sm btn-ghost" disabled={action.isPending} onClick={() => action.mutate({ ids: selected, action: 'delete' }, { onSuccess: () => setSelected([]) })}>Supprimer les rebonds</button>
        </div>
      )}
      {action.isError && <ErrorState error={action.error} />}

      {bounces.isPending ? <Loading /> : bounces.isError ? <ErrorState error={bounces.error} retry={() => bounces.refetch()} /> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {canManage && <th><input type="checkbox" aria-label="Tout sélectionner" checked={all} onChange={(e) => setSelected(e.target.checked ? rows.map((b) => b.id) : [])} /></th>}
                  <th>Contact</th><th>Type</th><th>Campagne</th><th>Source</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    {canManage && <td><input type="checkbox" aria-label={`Sélectionner ${b.email}`} checked={selected.includes(b.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, b.id] : selected.filter((x) => x !== b.id))} /></td>}
                    <td><Link className="plain-link mono small" to={`/audience/${b.subscriber_id}`}>{b.email}</Link></td>
                    <td><Chip tone={TYPES[b.type]?.tone ?? 'neutral'}>{TYPES[b.type]?.label ?? b.type}</Chip></td>
                    <td className="small">{b.campaign ? <Link className="plain-link" to={`/campagnes/${b.campaign.id}`}>{b.campaign.name}</Link> : '—'}</td>
                    <td className="small muted">{b.source}</td>
                    <td className="small muted">{dateTime(b.created_at)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={canManage ? 6 : 5} className="empty">Aucun rebond. Bonne nouvelle !</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={page} perPage={30} total={bounces.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
