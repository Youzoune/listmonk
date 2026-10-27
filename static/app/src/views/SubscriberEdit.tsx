import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteSubscriber, useLists, useSaveSubscriber, useSubscriber } from '../api/hooks';
import type { Subscriber, SubscriberInput } from '../api/types';
import { Chip, ErrorState, Field, Icon, Loading } from '../components/ui';
import { date } from '../lib/format';
import { attribsFromRows, attribsToRows, type AttrRow } from '../lib/subscribers';
import { useProject } from '../project';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUB_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
  confirmed: { label: 'Confirmé', tone: 'ok' },
  unconfirmed: { label: 'À confirmer', tone: 'warn' },
  unsubscribed: { label: 'Désinscrit', tone: 'neutral' },
};

export function SubscriberEdit() {
  const { id } = useParams();
  const isNew = id === undefined;
  const { project, can } = useProject();
  const navigate = useNavigate();
  const sub = useSubscriber(project.id, isNew ? null : Number(id));
  const lists = useLists(project.id);
  const save = useSaveSubscriber(project.id);
  const del = useDeleteSubscriber(project.id);
  const canEdit = can('subscribers:manage');

  const [form, setForm] = useState<Omit<SubscriberInput, 'attribs'> | null>(isNew
    ? { email: '', name: '', status: 'enabled', lists: [], preconfirm_subscriptions: false } : null);
  const [rows, setRows] = useState<AttrRow[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (form || !sub.data) return;
    const s: Subscriber = sub.data;
    setForm({ email: s.email, name: s.name, status: s.status, lists: s.lists.map((l) => l.id), preconfirm_subscriptions: false });
    setRows(attribsToRows(s.attribs));
  }, [sub.data, form]);

  if (!form) return <div className="view">{sub.isError ? <ErrorState error={sub.error} /> : <Loading />}</div>;

  const errors = {
    email: !EMAIL_RE.test(form.email.trim()) ? 'Une adresse e-mail valide, comme nom@exemple.fr.' : '',
    name: !form.name.trim() ? 'Indiquez un nom (il peut reprendre l’adresse e-mail).' : '',
    attribs: attribsFromRows(rows).error ?? '',
  };
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const toggleList = (lid: number, on: boolean) => set({ lists: on ? [...form.lists, lid] : form.lists.filter((x) => x !== lid) });

  const submit = () => {
    setSubmitted(true);
    if (errors.email || errors.name || errors.attribs) return;
    const attribs = attribsFromRows(rows).attribs ?? {};
    save.mutate(
      { id: isNew ? undefined : Number(id), sub: { ...form, email: form.email.trim(), name: form.name.trim(), attribs } },
      { onSuccess: (s) => { if (isNew) navigate(`/audience/${s.id}`, { replace: true }); } },
    );
  };

  const current = sub.data;
  const activeLists = (lists.data?.results ?? []).filter((l) => l.status === 'active' || form.lists.includes(l.id));

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <Link className="link back" to="/audience"><Icon name="back" size={15} /> Audience</Link>
          <h1>{isNew ? 'Nouveau contact' : current?.name || 'Contact'}</h1>
          {current && <p className="sub mono">{current.email} · ajouté le {date(current.created_at)}</p>}
        </div>
        {canEdit && (
          <div className="row-gap">
            {save.isSuccess && <span className="saved" role="status"><Icon name="check" size={16} /> Enregistré</span>}
            <button type="button" className="btn btn-dark" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Enregistrement…' : isNew ? 'Ajouter le contact' : 'Enregistrer'}</button>
          </div>
        )}
      </header>
      {save.isError && <ErrorState error={save.error} />}

      <div className="grid-2 align-start">
        <section className="panel">
          <h2>Coordonnées</h2>
          <Field id="sub-email" label="E-mail">
            <input id="sub-email" type="email" value={form.email} disabled={!canEdit} onChange={(e) => set({ email: e.target.value })} aria-invalid={submitted && !!errors.email} />
          </Field>
          {submitted && errors.email && <p className="field-error">{errors.email}</p>}
          <Field id="sub-name" label="Nom">
            <input id="sub-name" type="text" value={form.name} disabled={!canEdit} onChange={(e) => set({ name: e.target.value })} aria-invalid={submitted && !!errors.name} />
          </Field>
          {submitted && errors.name && <p className="field-error">{errors.name}</p>}
          <Field id="sub-status" label="Statut" hint={form.status === 'blocklisted'
            ? 'En liste noire, le contact ne reçoit plus rien de ce projet et ne peut pas se réinscrire.'
            : form.status === 'disabled' ? 'Désactivé, le contact ne reçoit plus de campagnes, sans être sur liste noire.' : undefined}>
            <select id="sub-status" value={form.status} disabled={!canEdit} onChange={(e) => set({ status: e.target.value as SubscriberInput['status'] })}>
              <option value="enabled">Actif</option>
              <option value="disabled">Désactivé</option>
              <option value="blocklisted">Liste noire</option>
            </select>
          </Field>

          <h3>Attributs</h3>
          <p className="small muted">Des informations libres, utilisables dans les e-mails : {'{{ .Subscriber.Attribs.ville }}'}.</p>
          <div className="attr-rows">
            {rows.map((r, i) => (
              <div key={i} className="attr-row">
                <input type="text" aria-label="Nom de l’attribut" placeholder="ville" value={r.key} disabled={!canEdit}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                <input type="text" aria-label="Valeur" placeholder="Lyon" value={r.value} disabled={!canEdit}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                {canEdit && <button type="button" className="btn btn-sm btn-ghost" aria-label="Retirer l’attribut" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>}
              </div>
            ))}
          </div>
          {canEdit && <button type="button" className="btn btn-sm" onClick={() => setRows([...rows, { key: '', value: '' }])}><Icon name="plus" size={14} /> Ajouter un attribut</button>}
          {errors.attribs && <p className="field-error">{errors.attribs}</p>}
        </section>

        <div className="stack">
          <section className="panel">
            <h2>Listes</h2>
            {lists.isPending ? <Loading /> : (
              <ul className="check-list">
                {activeLists.map((l) => {
                  const subscription = current?.lists.find((x) => x.id === l.id);
                  const st = subscription && SUB_STATUS[subscription.subscription_status];
                  return (
                    <li key={l.id}>
                      <label className="switch" htmlFor={`sub-list-${l.id}`}>
                        <input id={`sub-list-${l.id}`} type="checkbox" checked={form.lists.includes(l.id)} disabled={!canEdit}
                          onChange={(e) => toggleList(l.id, e.target.checked)} />
                        <span>{l.name}</span>
                      </label>
                      {st && <Chip tone={st.tone}>{st.label}</Chip>}
                    </li>
                  );
                })}
                {activeLists.length === 0 && <li className="muted small">Aucune liste dans ce projet. <Link className="link" to="/listes">Créer une liste</Link></li>}
              </ul>
            )}
            <label className="switch" htmlFor="sub-preconfirm">
              <input id="sub-preconfirm" type="checkbox" checked={form.preconfirm_subscriptions} disabled={!canEdit}
                onChange={(e) => set({ preconfirm_subscriptions: e.target.checked })} />
              <span>Confirmer d’office les inscriptions (sans e-mail de confirmation)</span>
            </label>
            <p className="hint">À cocher seulement si la personne a déjà donné son accord, par exemple sur un bulletin papier.</p>
          </section>

          {!isNew && canEdit && (
            <section className="panel danger-zone">
              <h2>Supprimer le contact</h2>
              <p className="muted small">Le contact et son historique (ouvertures, clics) sont supprimés de ce projet. Pour juste ne plus lui écrire, mettez-le en liste noire.</p>
              {del.isError && <ErrorState error={del.error} />}
              {confirmDelete ? (
                <div className="row-gap">
                  <button type="button" className="btn btn-danger" disabled={del.isPending} onClick={() => del.mutate(Number(id), { onSuccess: () => navigate('/audience') })}>Supprimer définitivement</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Annuler</button>
                </div>
              ) : <button type="button" className="btn" onClick={() => setConfirmDelete(true)}>Supprimer le contact…</button>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
