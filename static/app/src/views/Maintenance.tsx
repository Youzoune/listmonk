import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, query } from '../api/client';
import { ErrorState, Explain, Field, Icon, Loading } from '../components/ui';
import { num } from '../lib/format';
import { useProject } from '../project';

interface About {
  version: string;
  build: string;
  go_version: string;
  database: { version?: string } | null;
  system: { num_cpu?: number; memory_alloc_mb?: number; memory_from_os_mb?: number };
}

type Job = { id: string; label: string; hint: string; path: string; dated?: boolean };

const JOBS: Job[] = [
  { id: 'orphans', label: 'Supprimer les contacts sans liste', hint: 'Les contacts qui ne sont inscrits à aucune liste.', path: '/api/maintenance/subscribers/orphan' },
  { id: 'blocklisted', label: 'Supprimer les contacts en liste noire', hint: 'Ils ne pourront plus être bloqués s’ils se réinscrivent.', path: '/api/maintenance/subscribers/blocklisted' },
  { id: 'unconfirmed', label: 'Supprimer les inscriptions jamais confirmées', hint: 'Les inscriptions en double confirmation restées sans clic avant cette date.', path: '/api/maintenance/subscriptions/unconfirmed', dated: true },
  { id: 'analytics', label: 'Supprimer les statistiques anciennes', hint: 'Les ouvertures et clics enregistrés avant cette date (allège la base).', path: '/api/maintenance/analytics/all', dated: true },
];

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function CleanUp({ job }: { job: Job }) {
  const [date, setDate] = useState(monthsAgo(job.id === 'analytics' ? 12 : 3));
  const [confirm, setConfirm] = useState(false);
  const run = useMutation({
    mutationFn: () => api<{ count: number } | boolean>(`${job.path}${job.dated ? query({ before_date: new Date(`${date}T00:00:00`).toISOString() }) : ''}`, { method: 'DELETE' }),
    onSettled: () => setConfirm(false),
  });
  const count = run.data && typeof run.data === 'object' ? run.data.count : null;
  return (
    <li className="maint-job">
      <div>
        <p className="strong">{job.label}</p>
        <p className="small muted">{job.hint}</p>
        {run.isSuccess && <p className="saved small" role="status"><Icon name="check" size={14} /> Fait{count !== null ? ` : ${num(count)} supprimé${count > 1 ? 's' : ''}` : ''}.</p>}
        {run.isError && <ErrorState error={run.error} />}
      </div>
      <div className="row-gap end">
        {job.dated && (
          <Field id={`d-${job.id}`} label="Avant le">
            <input id={`d-${job.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
        {confirm
          ? <>
              <button type="button" className="btn btn-sm btn-danger" disabled={run.isPending} onClick={() => run.mutate()}>Confirmer</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(false)}>Annuler</button>
            </>
          : <button type="button" className="btn btn-sm" onClick={() => setConfirm(true)}>Lancer</button>}
      </div>
    </li>
  );
}

export function Maintenance() {
  const { can } = useProject();
  // /api/about answers without the usual { data } wrapper.
  const about = useQuery({ queryKey: ['about'], queryFn: async () => (await fetch('/api/about', { credentials: 'same-origin' })).json() as Promise<About> });
  const logs = useQuery({ queryKey: ['logs'], queryFn: () => api<string[]>('/api/logs'), enabled: can('settings:get') });

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Instance</p>
          <h1>Maintenance</h1>
        </div>
      </header>

      <section className="panel">
        <h2>Système</h2>
        {about.isPending ? <Loading /> : about.isError ? <ErrorState error={about.error} /> : (
          <dl className="facts facts-row">
            <div><dt>Version</dt><dd className="mono">{about.data.version}</dd></div>
            <div><dt>Base de données</dt><dd className="mono">{about.data.database?.version?.split(' on ')[0] ?? '—'}</dd></div>
            <div><dt>Mémoire utilisée</dt><dd className="num">{about.data.system?.memory_alloc_mb ?? '—'} Mo</dd></div>
            <div><dt>Go</dt><dd className="mono">{about.data.go_version}</dd></div>
          </dl>
        )}
      </section>

      {can('settings:maintain') && (
        <section className="panel">
          <h2>Nettoyage</h2>
          <Explain title="Avant de nettoyer">
            <p>Ces opérations suppriment des données de <span className="strong">toute l’instance</span>, tous projets confondus, et ne se défont pas. Une sauvegarde de la base (dans Coolify) est prudente avant.</p>
          </Explain>
          <ul className="maint-list">{JOBS.map((j) => <CleanUp key={j.id} job={j} />)}</ul>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Journal du serveur</h2>
          <button type="button" className="btn btn-sm" onClick={() => logs.refetch()}>Actualiser</button>
        </div>
        <p className="small muted">Les derniers messages de Relais : démarrages, envois, erreurs SMTP. Utile pour comprendre un envoi qui bloque.</p>
        {logs.isPending ? <Loading /> : logs.isError ? <ErrorState error={logs.error} /> : (
          <pre className="import-logs mono server-logs">{(logs.data ?? []).slice(-200).join('\n')}</pre>
        )}
      </section>
    </div>
  );
}
