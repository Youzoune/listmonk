import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client';
import { useSaveProject, useSaveSettings, useSettings } from '../api/hooks';
import type { SmtpServer } from '../api/types';
import { Chip, ErrorState, Explain, Field, Icon, Loading } from '../components/ui';
import { num } from '../lib/format';
import { LISTMONK_EXPORT_SCRIPT } from '../lib/listmonkExport';
import { isStockTemplate, missingBrands, suggestProject } from '../lib/migration';
import { slugify } from '../lib/projects';
import { settingsForSave } from '../lib/settings';
import { freeRelayName, newSmtpServer } from '../lib/smtp';
import { useProject } from '../project';

interface Source { url: string; username: string; token: string }
interface OldList { id: number; name: string; type: string; optin: string; subscriber_count: number }
interface OldTemplate { id: number; name: string; type: string; is_default: boolean }
interface OldCampaign { id: number; name: string; status: string; sent: number; lists: number[]; list_names: string[] }
interface OldSmtp { name: string; enabled: boolean; host: string; port: number; auth_protocol: SmtpServer['auth_protocol']; username: string;
  tls_type: SmtpServer['tls_type']; tls_skip_verify: boolean; max_conns: number; idle_timeout: string; wait_timeout: string;
  max_msg_retries: number; msg_retry_delay: string; hello_hostname: string }
interface Check { source?: string; lists: OldList[]; subscribers: number; templates: OldTemplate[]; campaigns: OldCampaign[]; smtp: OldSmtp[] | null; smtp_error: string }
interface Run {
  running: boolean; step: string; counts: Record<string, number>; total_subscribers: number; errors: string[];
  started_at: string; finished_at: string | null;
}

const COUNT_LABELS: [string, string][] = [
  ['lists', 'listes créées'], ['lists_existing', 'listes déjà là'],
  ['subscribers', 'contacts importés'], ['subscribers_existing', 'contacts déjà là (abonnements complétés)'], ['subscribers_skipped', 'contacts sans liste importée'],
  ['templates', 'modèles créés'], ['templates_existing', 'modèles déjà là'],
  ['campaigns', 'campagnes créées en brouillon'], ['campaigns_existing', 'campagnes déjà là'], ['campaigns_skipped', 'campagnes ignorées'],
];

function useImportRun(poll: boolean) {
  return useQuery({
    queryKey: ['listmonk-import'],
    queryFn: () => api<Run | null>('/api/import/listmonk'),
    refetchInterval: (q) => (poll || q.state.data?.running ? 1500 : false),
  });
}

// Brings another listmonk instance (lists, contacts, templates, campaigns,
// SMTP servers) into Relais, one project per brand.
export function ListmonkImport() {
  const { projects, can } = useProject();
  const qc = useQueryClient();
  const saveProject = useSaveProject();
  const [src, setSrc] = useState<Source>({ url: 'https://', username: '', token: '' });
  const check = useMutation({ mutationFn: (s: Source) => api<Check>('/api/import/listmonk/check', { method: 'POST', json: s }) });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api<Check>('/api/import/listmonk/file', { method: 'POST', body: form });
    },
  });
  const [copied, setCopied] = useState(false);
  const [listTo, setListTo] = useState<Record<number, number>>({});
  const [tplTo, setTplTo] = useState<Record<number, number>>({});
  const [withCampaigns, setWithCampaigns] = useState(true);
  const start = useMutation({
    mutationFn: () => api<Run>('/api/import/listmonk', {
      method: 'POST',
      json: {
        source: fromFile ? { url: '', username: '', token: '' } : src,
        from_file: fromFile,
        lists: Object.entries(listTo).map(([id, project_id]) => ({ id: Number(id), project_id })),
        templates: Object.entries(tplTo).map(([id, project_id]) => ({ id: Number(id), project_id })),
        campaigns: withCampaigns,
      },
    }),
    // Shows the new import at once, not the last one.
    onSuccess: (r) => qc.setQueryData(['listmonk-import'], r),
  });
  const run = useImportRun(start.isSuccess);
  const r = run.data;
  // The last of the two ways used: the API, or an export file.
  const fromFile = !!upload.data && (upload.submittedAt > check.submittedAt);
  const data = fromFile ? upload.data : check.data ?? upload.data;

  // Each list and template goes to the project of its brand by default.
  useEffect(() => {
    if (!data) return;
    setListTo(Object.fromEntries(data.lists.map((l) => [l.id, suggestProject(l.name, projects) ?? 0])));
    setTplTo(Object.fromEntries(data.templates.filter((t) => !isStockTemplate(t.name)).map((t) => [t.id, suggestProject(t.name, projects) ?? 0])));
  }, [data, projects]);

  const missing = useMemo(() => (data ? missingBrands([...data.lists.map((l) => l.name), ...data.templates.map((t) => t.name)], projects) : []), [data, projects]);
  const createMissing = async () => {
    for (const name of missing) {
      await saveProject.mutateAsync({ project: { name, slug: slugify(name), domain: null, description: `Importé de ${src.url}` } });
    }
    await qc.invalidateQueries({ queryKey: ['projects'] });
  };

  if (!can('settings:manage')) return <div className="view"><h1>Importer depuis listmonk</h1><p className="muted">Il faut le droit de modifier les réglages.</p></div>;

  const chosenLists = Object.values(listTo).filter((p) => p > 0).length;
  const contacts = data ? data.lists.filter((l) => (listTo[l.id] ?? 0) > 0).reduce((n, l) => n + l.subscriber_count, 0) : 0;
  const finished = r && !r.running && r.finished_at;

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <Link className="link back" to="/maintenance"><Icon name="back" size={15} /> Maintenance</Link>
          <h1>Importer depuis listmonk</h1>
        </div>
      </header>
      <p className="muted">
        Reprend une autre instance listmonk : listes, contacts avec leurs désinscriptions, modèles, campagnes (en brouillon : rien
        n’est envoyé) et serveurs d’envoi. Les données passent directement d’un serveur à l’autre. L’import peut être relancé : ce qui
        existe déjà n’est pas dupliqué.
      </p>

      <section className="panel list-form" aria-label="Connexion à l’ancienne instance">
        <h2>1. L’ancienne instance</h2>
        <Explain title="Créer l’accès API dans l’ancienne instance">
          <ol className="steps-list">
            <li>Dans l’ancienne instance, ouvrez Utilisateurs › Nouveau.</li>
            <li>Choisissez le type « Utilisateur API » et un rôle qui peut tout lire (Super Admin, le plus simple).</li>
            <li>Copiez le jeton affiché une seule fois, puis collez-le ci-dessous avec le nom de l’utilisateur.</li>
          </ol>
        </Explain>
        <div className="grid-2">
          <Field id="lm-url" label="Adresse de l’instance">
            <input id="lm-url" type="url" className="mono" value={src.url} onChange={(e) => setSrc({ ...src, url: e.target.value })} placeholder="https://listmonk.exemple.fr" />
          </Field>
          <Field id="lm-user" label="Utilisateur API">
            <input id="lm-user" type="text" autoComplete="off" value={src.username} onChange={(e) => setSrc({ ...src, username: e.target.value })} />
          </Field>
        </div>
        <Field id="lm-token" label="Jeton de l’utilisateur API">
          <input id="lm-token" type="password" autoComplete="off" value={src.token} onChange={(e) => setSrc({ ...src, token: e.target.value })} />
        </Field>
        {check.isError && <ErrorState error={check.error} />}
        <div className="row-gap end">
          <button type="button" className="btn btn-dark" disabled={check.isPending || !src.url.startsWith('http') || !src.username || !src.token}
            onClick={() => check.mutate(src)}>{check.isPending ? 'Connexion…' : 'Se connecter et lire le contenu'}</button>
        </div>

        <h3>Ou sans accès API : un fichier d’export</h3>
        <ol className="steps-list small">
          <li>Ouvrez l’ancienne instance (page d’administration) dans votre navigateur, connecté.</li>
          <li>Ouvrez la console du navigateur (Cmd ⌥ J sur Mac, Ctrl Maj J sur Windows), collez le script et appuyez sur Entrée.</li>
          <li>Un fichier <span className="mono">listmonk-export-….json</span> se télécharge : déposez-le ci-dessous.</li>
        </ol>
        <div className="row-gap">
          <button type="button" className="btn btn-sm" onClick={async () => {
            try { await navigator.clipboard.writeText(LISTMONK_EXPORT_SCRIPT); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* shown below */ }
          }}>{copied ? 'Script copié' : 'Copier le script d’export'}</button>
          <label className="btn btn-sm" htmlFor="lm-file">
            {upload.isPending ? 'Lecture…' : 'Déposer le fichier d’export'}
            <input id="lm-file" type="file" accept="application/json,.json" hidden onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = '';
            }} />
          </label>
        </div>
        <details className="small"><summary>Voir le script</summary><pre className="import-logs mono">{LISTMONK_EXPORT_SCRIPT}</pre></details>
        {upload.isError && <ErrorState error={upload.error} />}
        {upload.data && <p className="saved small" role="status"><Icon name="check" size={14} /> Fichier lu{upload.data.source ? ` : export de ${upload.data.source}` : ''}.</p>}
      </section>

      {data && (
        <section className="panel list-form" aria-label="Répartition par projet">
          <h2>2. Où ranger chaque liste</h2>
          <p className="small muted">{num(data.subscribers)} contacts, {data.lists.length} listes, {data.templates.length} modèles et {data.campaigns.length} campagnes trouvés.</p>
          {missing.length > 0 && (
            <div className="alert alert-info alert-stack">
              <p>Ces marques n’ont pas encore de projet : <span className="strong">{missing.join(', ')}</span>.</p>
              <button type="button" className="btn btn-sm btn-primary self-start" disabled={saveProject.isPending} onClick={createMissing}>
                <Icon name="plus" size={14} /> Créer {missing.length > 1 ? `les ${missing.length} projets` : 'le projet'}
              </button>
              {saveProject.isError && <ErrorState error={saveProject.error} />}
            </div>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Liste</th><th className="right">Contacts</th><th>Projet</th></tr></thead>
              <tbody>
                {data.lists.map((l) => (
                  <tr key={l.id}>
                    <td><label htmlFor={`lm-list-${l.id}`} className="strong">{l.name}</label><span className="sub">{l.type === 'public' ? 'Publique' : 'Privée'} · {l.optin === 'double' ? 'double confirmation' : 'simple'}</span></td>
                    <td className="right num">{num(l.subscriber_count)}</td>
                    <td>
                      <select id={`lm-list-${l.id}`} value={listTo[l.id] ?? 0} onChange={(e) => setListTo({ ...listTo, [l.id]: Number(e.target.value) })}>
                        <option value={0}>Ne pas importer</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Modèles</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Modèle</th><th>Projet</th></tr></thead>
              <tbody>
                {data.templates.map((t) => (
                  <tr key={t.id}>
                    <td><label htmlFor={`lm-tpl-${t.id}`} className="strong">{t.name}</label>{isStockTemplate(t.name) && <span className="sub">Modèle livré avec listmonk, déjà présent ici</span>}</td>
                    <td>
                      <select id={`lm-tpl-${t.id}`} value={tplTo[t.id] ?? 0} onChange={(e) => setTplTo({ ...tplTo, [t.id]: Number(e.target.value) })}>
                        <option value={0}>Ne pas importer</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="switch" htmlFor="lm-campaigns">
            <input id="lm-campaigns" type="checkbox" checked={withCampaigns} onChange={(e) => setWithCampaigns(e.target.checked)} />
            <span>Importer les {data.campaigns.length} campagnes, en brouillon</span>
          </label>
          <p className="small muted">
            Rien n’est envoyé. Une campagne déjà envoyée garde la trace dans son nom (« envoyée le … sur l’ancienne instance ») pour ne
            pas la renvoyer par erreur aux mêmes personnes.
          </p>
          {start.isError && <ErrorState error={start.error} />}
          <div className="row-gap end">
            <button type="button" className="btn btn-primary" disabled={start.isPending || !!r?.running || chosenLists === 0} onClick={() => start.mutate()}>
              {r?.running ? 'Import en cours…' : `Importer ${chosenLists} liste${chosenLists > 1 ? 's' : ''} (${num(contacts)} abonnements)`}
            </button>
          </div>
        </section>
      )}

      {start.isPending ? <section className="panel"><Loading label="Démarrage de l’import…" /></section> : r && <Progress run={r} />}
      {finished && data?.smtp && data.smtp.length > 0 && <SmtpImport servers={data.smtp} />}
      {data && !data.smtp && data.smtp_error && (
        <p className="small muted">Les serveurs d’envoi n’ont pas pu être lus ({data.smtp_error}) : donnez le droit « réglages » à l’utilisateur API pour les reprendre aussi.</p>
      )}
    </div>
  );
}

function Progress({ run }: { run: Run }) {
  const done = (run.counts.subscribers ?? 0) + (run.counts.subscribers_existing ?? 0) + (run.counts.subscribers_skipped ?? 0);
  return (
    <section className="panel list-form" aria-label="Avancement de l’import">
      <div className="panel-head">
        <h2>3. Import</h2>
        {run.running ? <Chip tone="run" icon="play">{run.step}</Chip> : run.step === 'Terminé' ? <Chip tone="ok" icon="check">Terminé</Chip> : <Chip tone="bad">{run.step}</Chip>}
      </div>
      {run.total_subscribers > 0 && (
        <div className="quota">
          <div className="quota-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (done / run.total_subscribers) * 100)}%` }} /></div>
          <div className="quota-legend num"><span>{num(done)} contacts lus sur {num(run.total_subscribers)}</span></div>
        </div>
      )}
      <dl className="facts facts-row">
        {COUNT_LABELS.filter(([k]) => run.counts[k]).map(([k, label]) => (
          <div key={k}><dt>{label}</dt><dd className="num">{num(run.counts[k])}</dd></div>
        ))}
      </dl>
      {run.errors.length > 0 && (
        <Explain title={`${run.errors.length} remarque${run.errors.length > 1 ? 's' : ''}`}>
          <ul className="small">{run.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </Explain>
      )}
      {!run.running && run.step === 'Terminé' && (
        <div className="row-gap">
          <Link className="btn" to="/audience">Voir les contacts</Link>
          <Link className="btn" to="/campagnes">Voir les campagnes</Link>
        </div>
      )}
    </section>
  );
}

// The other instance's SMTP servers become relays here, turned off until
// their password is typed (it can't be read through the API).
function SmtpImport({ servers }: { servers: OldSmtp[] }) {
  const settings = useSettings(true);
  const save = useSaveSettings();
  const existing = settings.data?.smtp ?? [];
  const todo = servers.filter((s) => !existing.some((e) => e.host === s.host && e.username === s.username && e.port === s.port));

  const add = () => {
    if (!settings.data) return;
    const taken: { name: string }[] = [...existing];
    const added = todo.map((s) => {
      const name = freeRelayName(s.name.replace(/^email-/, '') || s.host.split('.')[0], taken);
      taken.push({ name });
      return {
        ...newSmtpServer(), name, enabled: false, host: s.host, port: s.port, auth_protocol: s.auth_protocol, username: s.username,
        tls_type: s.tls_type, tls_skip_verify: s.tls_skip_verify, max_conns: s.max_conns || 10, idle_timeout: s.idle_timeout || '15s',
        wait_timeout: s.wait_timeout || '5s', max_msg_retries: s.max_msg_retries ?? 2, msg_retry_delay: s.msg_retry_delay || '5s',
        hello_hostname: s.hello_hostname ?? '', exclude_from_default: true,
      } satisfies SmtpServer;
    });
    const out = settingsForSave({ ...settings.data, smtp: [...settings.data.smtp, ...added] });
    if ('settings' in out) save.mutate(out.settings);
  };

  return (
    <section className="panel list-form" aria-label="Serveurs d’envoi de l’ancienne instance">
      <h2>4. Les serveurs d’envoi</h2>
      {settings.isPending ? <Loading /> : (
        <>
          <ul className="member-list">
            {servers.map((s) => (
              <li key={`${s.host}-${s.username}-${s.port}`}>
                <span className="strong">{s.name.replace(/^email-/, '') || s.host}</span>
                <span className="mono small">{s.host}:{s.port}</span>
                <span className="sub">{s.username}</span>
                {!todo.includes(s) && <Chip tone="ok" icon="check">Déjà ajouté</Chip>}
              </li>
            ))}
          </ul>
          {save.isSuccess ? (
            <p className="saved small" role="status"><Icon name="check" size={14} /> Ajoutés, désactivés. Saisissez leur mot de passe et activez-les dans <Link className="link" to="/reglages?onglet=smtp">Réglages › Serveurs SMTP</Link>.</p>
          ) : todo.length > 0 && (
            <>
              <p className="small muted">
                Ils sont ajoutés comme relais désactivés : l’ancienne instance ne donne pas leurs mots de passe. Il suffira de les saisir
                dans Réglages › Serveurs SMTP puis de les activer.
              </p>
              {save.isError && <ErrorState error={save.error} />}
              <button type="button" className="btn btn-dark self-start" disabled={save.isPending} onClick={add}>
                {save.isPending ? 'Ajout…' : `Ajouter ${todo.length} serveur${todo.length > 1 ? 's' : ''} comme relais`}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
