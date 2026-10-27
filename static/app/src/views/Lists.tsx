import { useState } from 'react';
import { Link } from 'react-router';
import { useDeleteList, useLists, useSaveList } from '../api/hooks';
import type { List, ListInput } from '../api/types';
import { Chip, ErrorState, Explain, Field, Icon, Loading } from '../components/ui';
import { num } from '../lib/format';
import { useProject } from '../project';

const EMPTY: ListInput = { name: '', type: 'private', optin: 'single', status: 'active', tags: [], description: '' };

function ListForm({ list, onDone }: { list?: List; onDone: () => void }) {
  const { project } = useProject();
  const save = useSaveList(project.id);
  const [form, setForm] = useState<ListInput>(list
    ? { name: list.name, type: list.type === 'public' ? 'public' : 'private', optin: list.optin, status: list.status, tags: list.tags, description: list.description }
    : EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const set = (patch: Partial<ListInput>) => setForm({ ...form, ...patch });
  const nameError = !form.name.trim() ? 'Donnez un nom à la liste.' : '';

  const submit = () => {
    setSubmitted(true);
    if (nameError) return;
    save.mutate({ id: list?.id, list: { ...form, name: form.name.trim() } }, { onSuccess: onDone });
  };

  return (
    <section className="panel list-form" aria-label={list ? `Modifier ${list.name}` : 'Nouvelle liste'}>
      <h2>{list ? `Modifier « ${list.name} »` : 'Nouvelle liste'}</h2>
      <Field id="list-name" label="Nom">
        <input id="list-name" type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={submitted && !!nameError} />
      </Field>
      {submitted && nameError && <p className="field-error">{nameError}</p>}
      <div className="grid-2">
        <Field id="list-type" label="Visibilité" hint={form.type === 'public'
          ? 'Proposée sur le formulaire d’inscription public : chacun peut s’y inscrire.'
          : 'Invisible du public : seule l’équipe y ajoute des contacts (import, ajout manuel, API).'}>
          <select id="list-type" value={form.type} onChange={(e) => set({ type: e.target.value as ListInput['type'] })}>
            <option value="private">Privée</option>
            <option value="public">Publique</option>
          </select>
        </Field>
        <Field id="list-optin" label="Confirmation d’inscription" hint={form.optin === 'double'
          ? 'Le contact reçoit un e-mail et doit cliquer pour confirmer. Recommandé pour les listes publiques : moins de spam, meilleure délivrabilité.'
          : 'Le contact est inscrit tout de suite.'}>
          <select id="list-optin" value={form.optin} onChange={(e) => set({ optin: e.target.value as ListInput['optin'] })}>
            <option value="single">Simple</option>
            <option value="double">Double (confirmation par e-mail)</option>
          </select>
        </Field>
      </div>
      <Field id="list-desc" label="Description (facultatif)" hint="Affichée sous le nom de la liste sur le formulaire public.">
        <textarea id="list-desc" rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field id="list-tags" label="Étiquettes (facultatif)" hint="Séparées par des virgules.">
        <input id="list-tags" type="text" value={form.tags.join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
      </Field>
      {list && (
        <label className="switch" htmlFor="list-archived">
          <input id="list-archived" type="checkbox" checked={form.status === 'archived'} onChange={(e) => set({ status: e.target.checked ? 'archived' : 'active' })} />
          <span>Archivée (masquée des campagnes et du formulaire public)</span>
        </label>
      )}
      {save.isError && <ErrorState error={save.error} />}
      <div className="row-gap end">
        <button type="button" className="btn btn-ghost" onClick={onDone}>Annuler</button>
        <button type="button" className="btn btn-dark" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Enregistrement…' : list ? 'Enregistrer' : 'Créer la liste'}</button>
      </div>
    </section>
  );
}

export function Lists() {
  const { project, can } = useProject();
  const canEdit = can('lists:manage_all');
  const lists = useLists(project.id);
  const del = useDeleteList(project.id);
  const [editing, setEditing] = useState<List | 'new' | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <Link className="link back" to="/audience"><Icon name="back" size={15} /> Audience</Link>
          <h1>Listes</h1>
        </div>
        <div className="row-gap">
          <Link className="btn" to="/formulaire">Formulaire d’inscription</Link>
          {canEdit && <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" /> Nouvelle liste</button>}
        </div>
      </header>

      <Explain title="Listes publiques, privées, simple ou double confirmation">
        <p>
          Une liste regroupe des contacts qui reçoivent les mêmes campagnes. <span className="strong">Publique</span>, elle apparaît sur le
          formulaire d’inscription du projet ; <span className="strong">privée</span>, seule l’équipe y ajoute des contacts.
        </p>
        <p>
          En <span className="strong">double confirmation</span>, chaque nouvel inscrit confirme par un clic dans un e-mail : les fausses
          adresses et les inscriptions malveillantes n’arrivent jamais dans la liste, ce qui protège la réputation de vos envois.
        </p>
      </Explain>

      {editing && <ListForm key={editing === 'new' ? 'new' : editing.id} list={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}

      {lists.isPending ? <Loading /> : lists.isError ? <ErrorState error={lists.error} retry={() => lists.refetch()} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Liste</th><th>Visibilité</th><th>Confirmation</th><th className="right">Contacts</th><th className="right">Actions</th></tr></thead>
            <tbody>
              {lists.data.results.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link className="strong plain-link" to={`/audience?liste=${l.id}`}>{l.name}</Link>
                    {l.status === 'archived' && <> <Chip tone="neutral">Archivée</Chip></>}
                    {l.description && <span className="sub">{l.description}</span>}
                  </td>
                  <td>{l.type === 'public' ? 'Publique' : l.type === 'temporary' ? 'Temporaire' : 'Privée'}</td>
                  <td>{l.optin === 'double' ? 'Double' : 'Simple'}</td>
                  <td className="right num">{num(l.subscriber_count)}</td>
                  <td className="right">
                    {canEdit && (
                      <div className="row-gap end">
                        <button type="button" className="btn btn-sm" onClick={() => setEditing(l)}>Modifier</button>
                        {confirm === l.id ? (
                          <>
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => del.mutate(l.id, { onSettled: () => setConfirm(null) })}>Supprimer la liste</button>
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(null)}>Annuler</button>
                          </>
                        ) : <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(l.id)}>Supprimer</button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {lists.data.results.length === 0 && <tr><td colSpan={5} className="empty">Aucune liste. Créez-en une pour commencer.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {confirm !== null && <p className="small muted">Supprimer une liste ne supprime pas ses contacts : ils restent dans le projet.</p>}
      {del.isError && <ErrorState error={del.error} />}
    </div>
  );
}
