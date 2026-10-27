import { useState } from 'react';
import { Link } from 'react-router';
import { useImportLogs, useImportStatus, useLists, useStartImport, useStopImport } from '../api/hooks';
import type { ImportParams } from '../api/types';
import { ErrorState, Explain, Field, Icon, Loading, Progress } from '../components/ui';
import { num } from '../lib/format';
import { useProject } from '../project';

const SAMPLE = `email,name,attributes
lea@exemple.fr,Léa Martin,"{""ville"": ""Lyon""}"
paul@exemple.fr,Paul Durand,`;

export function Import() {
  const { project, can } = useProject();
  const canImport = can('subscribers:import');
  const lists = useLists(project.id);
  const status = useImportStatus(canImport);
  const running = status.data?.status === 'importing' || status.data?.status === 'stopping';
  const logs = useImportLogs(canImport && !!status.data && status.data.status !== 'none');
  const start = useStartImport();
  const stop = useStopImport();

  const [file, setFile] = useState<File | null>(null);
  const [params, setParams] = useState<ImportParams>({ mode: 'subscribe', subscription_status: 'unconfirmed', overwrite: false, delim: ',', lists: [] });
  const [submitted, setSubmitted] = useState(false);
  const set = (patch: Partial<ImportParams>) => setParams({ ...params, ...patch });
  const activeLists = (lists.data?.results ?? []).filter((l) => l.status === 'active');
  const errors = {
    file: !file ? 'Choisissez un fichier CSV (ou un ZIP qui en contient un).' : '',
    lists: params.mode === 'subscribe' && params.lists.length === 0 ? 'Choisissez au moins une liste.' : '',
  };

  if (!canImport) return <div className="view"><h1>Importer des contacts</h1><p className="muted">Vous n’avez pas le droit d’importer des contacts.</p></div>;

  const s = status.data;
  const submit = () => {
    setSubmitted(true);
    if (errors.file || errors.lists || !file) return;
    start.mutate({ file, params });
  };

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <Link className="link back" to="/audience"><Icon name="back" size={15} /> Audience</Link>
          <h1>Importer des contacts</h1>
          <p className="sub">Dans le projet {project.name}</p>
        </div>
      </header>

      {s && s.status !== 'none' && (
        <section className="panel" aria-live="polite">
          <h2>{running ? 'Import en cours' : s.status === 'finished' ? 'Import terminé' : s.status === 'failed' ? 'Import échoué' : 'Import'}</h2>
          <p className="small">{s.name} : <span className="num strong">{num(s.imported)}</span> contacts importés sur <span className="num">{num(s.total)}</span>.</p>
          <Progress value={s.imported} max={Math.max(s.total, 1)} tone={s.status === 'failed' ? 'warn' : running ? 'run' : 'ok'} label="Avancement de l’import" />
          {logs.data && <pre className="import-logs mono">{logs.data.trim().split('\n').slice(-12).join('\n')}</pre>}
          <div className="row-gap">
            <button type="button" className="btn" disabled={stop.isPending} onClick={() => stop.mutate()}>{running ? 'Arrêter l’import' : 'Nouvel import'}</button>
            {!running && <Link className="btn btn-ghost" to="/audience">Voir les contacts</Link>}
          </div>
        </section>
      )}

      {(!s || s.status === 'none') && (status.isPending ? <Loading /> : (
        <div className="grid-2 align-start">
          <section className="panel">
            <h2>Le fichier</h2>
            <Field id="imp-file" label="Fichier CSV ou ZIP">
              <input id="imp-file" type="file" accept=".csv,.zip,text/csv,application/zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
            {submitted && errors.file && <p className="field-error">{errors.file}</p>}
            <Field id="imp-delim" label="Séparateur de colonnes" hint="Excel en français enregistre souvent ses CSV avec des points-virgules.">
              <select id="imp-delim" value={params.delim} onChange={(e) => set({ delim: e.target.value })}>
                <option value=",">Virgule ( , )</option>
                <option value=";">Point-virgule ( ; )</option>
                <option value={'\t'}>Tabulation</option>
              </select>
            </Field>
            <Explain title="Le format du fichier">
              <p>La première ligne nomme les colonnes : <span className="mono">email</span> (obligatoire), <span className="mono">name</span>, et éventuellement <span className="mono">attributes</span> (en JSON).</p>
              <pre className="mono import-sample">{SAMPLE}</pre>
              <p>Un contact déjà présent dans le projet (même e-mail) n’est pas créé deux fois.</p>
            </Explain>
          </section>

          <section className="panel">
            <h2>Que faire des contacts</h2>
            <fieldset className="radio-row">
              <legend>Action</legend>
              <label><input type="radio" name="imp-mode" checked={params.mode === 'subscribe'} onChange={() => set({ mode: 'subscribe' })} /> Les inscrire à des listes</label>
              <label><input type="radio" name="imp-mode" checked={params.mode === 'blocklist'} onChange={() => set({ mode: 'blocklist' })} /> Les mettre en liste noire</label>
            </fieldset>
            {params.mode === 'subscribe' && (
              <>
                <p className="small strong">Listes</p>
                <ul className="check-list">
                  {activeLists.map((l) => (
                    <li key={l.id}>
                      <label className="switch" htmlFor={`imp-list-${l.id}`}>
                        <input id={`imp-list-${l.id}`} type="checkbox" checked={params.lists.includes(l.id)}
                          onChange={(e) => set({ lists: e.target.checked ? [...params.lists, l.id] : params.lists.filter((x) => x !== l.id) })} />
                        <span>{l.name}</span>
                      </label>
                    </li>
                  ))}
                  {activeLists.length === 0 && <li className="muted small">Aucune liste. <Link className="link" to="/listes">Créer une liste</Link></li>}
                </ul>
                {submitted && errors.lists && <p className="field-error">{errors.lists}</p>}
                <Field id="imp-substatus" label="Inscription" hint="« Confirmée » seulement si les personnes ont déjà donné leur accord : sinon, elles recevront un e-mail de confirmation (listes en double confirmation).">
                  <select id="imp-substatus" value={params.subscription_status} onChange={(e) => set({ subscription_status: e.target.value as ImportParams['subscription_status'] })}>
                    <option value="unconfirmed">À confirmer</option>
                    <option value="confirmed">Confirmée</option>
                  </select>
                </Field>
              </>
            )}
            <label className="switch" htmlFor="imp-overwrite">
              <input id="imp-overwrite" type="checkbox" checked={params.overwrite} onChange={(e) => set({ overwrite: e.target.checked })} />
              <span>Mettre à jour le nom et les attributs des contacts déjà présents</span>
            </label>
            {start.isError && <ErrorState error={start.error} />}
            <div className="row-gap end">
              <button type="button" className="btn btn-dark" disabled={start.isPending} onClick={submit}>{start.isPending ? 'Envoi du fichier…' : 'Lancer l’import'}</button>
            </div>
          </section>
        </div>
      ))}
    </div>
  );
}
