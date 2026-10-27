import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { apiHTML } from '../api/client';
import { useSaveTemplate, useTemplate, useTemplateAction, useTemplates } from '../api/hooks';
import type { Template, TemplateType } from '../api/types';
import { Chip, ErrorState, Explain, Field, Icon, Loading } from '../components/ui';
import { date } from '../lib/format';
import { STARTERS, TEMPLATE_TAGS, TEMPLATE_TYPES, templateErrors } from '../lib/templates';
import { useProject } from '../project';

// Renders a template preview in a sandboxed frame.
function Preview({ type, body, id }: { type: TemplateType; body?: string; id?: number }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const out = body !== undefined
          ? await apiHTML('/api/templates/preview', { template_type: type, body })
          : await fetch(`/api/templates/${id}/preview`, { credentials: 'same-origin' }).then((r) => r.text());
        if (live) { setHtml(out); setError(''); }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Aperçu impossible.');
      }
    }, body !== undefined ? 500 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [type, body, id]);

  return (
    <div className="tpl-preview">
      {error ? <p className="field-error">{error}</p> : <iframe title="Aperçu du modèle" sandbox="" srcDoc={html} />}
    </div>
  );
}

export function Templates() {
  const { project, can } = useProject();
  const canEdit = can('templates:manage');
  const list = useTemplates(project.id);
  const action = useTemplateAction(project.id);
  const navigate = useNavigate();
  const [previewing, setPreviewing] = useState<Template | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const duplicate = async (t: Template) => {
    navigate(`/modeles/nouveau?depuis=${t.id}`);
  };

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>Modèles d’e-mail</h1>
        </div>
        {canEdit && (
          <div className="row-gap">
            <Link className="btn" to="/modeles/nouveau?type=tx">Modèle transactionnel</Link>
            <Link className="btn btn-primary" to="/modeles/nouveau"><Icon name="plus" /> Nouveau modèle</Link>
          </div>
        )}
      </header>

      <Explain title="À quoi sert un modèle ?">
        <p>
          Un modèle est l’habillage commun de vos e-mails : logo, couleurs, pied de page avec le lien de désinscription. Chaque campagne
          choisit son modèle et n’a plus qu’à écrire son texte, qui vient à la place de la balise de contenu. Le modèle « par défaut » est
          proposé aux nouvelles campagnes du projet.
        </p>
      </Explain>

      {list.isPending ? <Loading /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nom</th><th>Type</th><th>Modifié</th><th className="right">Actions</th></tr></thead>
            <tbody>
              {list.data.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="strong">{t.name}</span> {t.is_default && <Chip tone="brand">Par défaut</Chip>}
                  </td>
                  <td>{TEMPLATE_TYPES[t.type]?.label ?? t.type}</td>
                  <td className="num">{date(t.updated_at)}</td>
                  <td className="right">
                    <div className="row-gap end">
                      <button type="button" className="btn btn-sm" onClick={() => setPreviewing(t)}>Aperçu</button>
                      {canEdit && t.type !== 'campaign_visual' && <Link className="btn btn-sm" to={`/modeles/${t.id}`}>Modifier</Link>}
                      {canEdit && (t.type === 'campaign_visual'
                        ? <button type="button" className="btn btn-sm" title="Le modèle visuel est copié en modèle HTML modifiable ici." onClick={() => duplicate(t)}>Copier en HTML</button>
                        : <button type="button" className="btn btn-sm" onClick={() => duplicate(t)}>Dupliquer</button>)}
                      {canEdit && t.type === 'campaign' && !t.is_default && (
                        <button type="button" className="btn btn-sm" disabled={action.isPending} onClick={() => action.mutate({ id: t.id, action: 'default' })}>Par défaut</button>
                      )}
                      {canEdit && !t.is_default && (confirmDelete === t.id ? (
                        <>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => action.mutate({ id: t.id, action: 'delete' }, { onSettled: () => setConfirmDelete(null) })}>Confirmer</button>
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(null)}>Annuler</button>
                        </>
                      ) : <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(t.id)}>Supprimer</button>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {action.isError && <ErrorState error={action.error} />}

      {previewing && (
        <section className="panel" aria-label={`Aperçu de ${previewing.name}`}>
          <div className="panel-head">
            <h2>Aperçu : {previewing.name}</h2>
            <button type="button" className="btn btn-sm" onClick={() => setPreviewing(null)}>Fermer</button>
          </div>
          <Preview type={previewing.type} id={previewing.id} />
        </section>
      )}
    </div>
  );
}

export function TemplateEdit() {
  const { id } = useParams();
  const isNew = id === undefined;
  const [params] = useSearchParams();
  const fromId = Number(params.get('depuis')) || null;
  const { project, can } = useProject();
  const navigate = useNavigate();
  const existing = useTemplate(project.id, isNew ? fromId : Number(id));
  const save = useSaveTemplate(project.id);

  const startType: 'campaign' | 'tx' = params.get('type') === 'tx' ? 'tx' : 'campaign';
  const [form, setForm] = useState<{ name: string; type: TemplateType; subject: string; body: string } | null>(
    isNew && !fromId ? { name: '', type: startType, ...STARTERS[startType] } : null,
  );
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (form || !existing.data) return;
    const t = existing.data;
    // A visual template (block editor) is copied as an HTML campaign template.
    const type = t.type === 'campaign_visual' ? 'campaign' : t.type;
    setForm({ name: isNew ? `Copie de ${t.name}` : t.name, type, subject: t.subject ?? '', body: t.body ?? '' });
  }, [existing.data, form, isNew]);

  if (!can('templates:manage')) return <div className="view"><h1>Modèle</h1><p className="muted">Vous n’avez pas accès aux modèles.</p></div>;
  if (!form) return <div className="view">{existing.isError ? <ErrorState error={existing.error} /> : <Loading />}</div>;

  const errors = templateErrors(form);
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const submit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    save.mutate({ id: isNew ? undefined : Number(id), tpl: form }, { onSuccess: (t) => { if (isNew) navigate(`/modeles/${t.id}`, { replace: true }); } });
  };
  const tags = TEMPLATE_TAGS.filter((t) => t.types.includes(form.type));

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <Link className="link back" to="/modeles"><Icon name="back" size={15} /> Modèles</Link>
          <h1>{isNew ? 'Nouveau modèle' : form.name || 'Modèle'}</h1>
        </div>
        <div className="row-gap">
          {save.isSuccess && <span className="saved" role="status"><Icon name="check" size={16} /> Enregistré</span>}
          <button type="button" className="btn btn-dark" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </header>
      {save.isError && <ErrorState error={save.error} />}

      <div className="tpl-layout">
        <section className="panel tpl-form">
          <Field id="tpl-name" label="Nom">
            <input id="tpl-name" type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={submitted && !!errors.name} />
          </Field>
          {submitted && errors.name && <p className="field-error">{errors.name}</p>}
          <p className="small muted">{TEMPLATE_TYPES[form.type].label} · {TEMPLATE_TYPES[form.type].hint}</p>
          {form.type === 'tx' && (
            <>
              <Field id="tpl-subject" label="Objet de l’e-mail">
                <input id="tpl-subject" type="text" value={form.subject} onChange={(e) => set({ subject: e.target.value })} aria-invalid={submitted && !!errors.subject} />
              </Field>
              {submitted && errors.subject && <p className="field-error">{errors.subject}</p>}
            </>
          )}
          <Field id="tpl-body" label="Code HTML">
            <textarea id="tpl-body" className="mono code-area" rows={22} spellCheck={false} value={form.body} onChange={(e) => set({ body: e.target.value })}
              aria-invalid={submitted && !!errors.body} />
          </Field>
          {(submitted || form.body) && errors.body && <p className="field-error">{errors.body}</p>}
          <Explain title="Les balises utilisables">
            <dl className="tag-list">
              {tags.map((t) => (
                <div key={t.tag}>
                  <dt><button type="button" className="var-chip mono" onClick={() => set({ body: `${form.body}${t.tag}` })} title="Ajouter à la fin du code">{t.tag}</button></dt>
                  <dd>{t.what}</dd>
                </div>
              ))}
            </dl>
          </Explain>
        </section>
        <section className="panel tpl-side">
          <h2>Aperçu</h2>
          <p className="small muted">Avec un contenu d’exemple à la place du texte de la campagne.</p>
          <Preview type={form.type} body={form.body} />
          {!isNew && existing.data && <p className="small muted">Créé le {date(existing.data.created_at)}.</p>}
        </section>
      </div>
    </div>
  );
}
