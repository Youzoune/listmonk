import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiHTML } from '../api/client';
import {
  useCampaign, useCampaignAnalytics, useCampaignStatus, useCloneCampaign, useDeleteCampaign, useLists, useSaveCampaign,
  useServerConfig, useTemplates, useTestCampaign,
} from '../api/hooks';
import type { AnalyticsCount, Campaign } from '../api/types';
import { CampaignChip, ErrorState, Explain, Field, Icon, Loading, Progress } from '../components/ui';
import { campaignHTMLToText, textToCampaignHTML } from '../lib/body';
import { FormatBar, FormatHelp } from '../components/FormatBar';
import { ACTIONS, ACTION_LABEL, ACTION_STATUS, analyticsRange, isEditable, rate, type CampaignAction } from '../lib/campaigns';
import { count, dateTime, num, relayLabel } from '../lib/format';
import { fromTemplate, toTemplate } from '../lib/variables';
import { useProject } from '../project';

function nextHour() {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

function DayBars({ views, clicks }: { views: AnalyticsCount[]; clicks: AnalyticsCount[] }) {
  const days = useMemo(() => {
    const m = new Map<string, { v: number; c: number }>();
    for (const x of views) m.set(x.timestamp.slice(0, 10), { v: (m.get(x.timestamp.slice(0, 10))?.v ?? 0) + x.count, c: m.get(x.timestamp.slice(0, 10))?.c ?? 0 });
    for (const x of clicks) m.set(x.timestamp.slice(0, 10), { v: m.get(x.timestamp.slice(0, 10))?.v ?? 0, c: (m.get(x.timestamp.slice(0, 10))?.c ?? 0) + x.count });
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-30);
  }, [views, clicks]);
  if (days.length === 0) return <p className="muted small">Pas encore d’ouvertures ni de clics.</p>;
  const max = Math.max(1, ...days.map(([, d]) => d.v));
  const W = 640, H = 160, B = 22, bw = (W - 8) / days.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Ouvertures et clics sur ${days.length} jours`}>
      {days.map(([day, d], i) => {
        const hv = ((H - B - 8) * d.v) / max;
        const hc = ((H - B - 8) * d.c) / max;
        return (
          <g key={day}>
            <rect x={4 + i * bw + 2} y={H - B - hv} width={Math.max(2, bw / 2 - 3)} height={hv} rx="2" className="bar bar-past"><title>{`${day} : ${d.v} ouvertures`}</title></rect>
            <rect x={4 + i * bw + bw / 2} y={H - B - hc} width={Math.max(2, bw / 2 - 3)} height={hc} rx="2" className="bar bar-today"><title>{`${day} : ${d.c} clics`}</title></rect>
          </g>
        );
      })}
      <text x={4} y={H - 6} className="axis">{days[0][0].slice(5).split('-').reverse().join('/')}</text>
      <text x={W - 4} y={H - 6} textAnchor="end" className="axis">{days[days.length - 1][0].slice(5).split('-').reverse().join('/')}</text>
    </svg>
  );
}

function Preview({ campaign, body, templateId }: { campaign: Campaign; body: string; templateId: number | null }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const out = await apiHTML(`/api/campaigns/${campaign.id}/preview`, {
          body, content_type: campaign.content_type, template_id: templateId ? String(templateId) : '',
        });
        if (live) { setHtml(out); setError(''); }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Aperçu impossible.');
      }
    }, 500);
    return () => { live = false; clearTimeout(t); };
  }, [campaign.id, campaign.content_type, body, templateId]);
  return <div className="tpl-preview">{error ? <p className="field-error">{error}</p> : <iframe title="Aperçu de la campagne" sandbox="" srcDoc={html} />}</div>;
}

export function CampaignDetail() {
  const { id } = useParams();
  const cid = Number(id);
  const { project, can } = useProject();
  const navigate = useNavigate();
  const camp = useCampaign(project.id, cid);
  const lists = useLists(project.id);
  const templates = useTemplates(project.id);
  const config = useServerConfig(project.id);
  const save = useSaveCampaign(project.id);
  const status = useCampaignStatus(project.id);
  const del = useDeleteCampaign(project.id);
  const clone = useCloneCampaign(project.id);
  const test = useTestCampaign();
  const range = camp.data ? analyticsRange(camp.data.created_at) : null;
  const analytics = useCampaignAnalytics(project.id, can('campaigns:get_analytics') ? cid : null, range);

  const [draft, setDraft] = useState<{ name: string; subject: string; from: string; lists: number[]; templateId: number | null; text: string | null; html: string; archive: boolean } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [sendAt, setSendAt] = useState(nextHour);
  const [scheduling, setScheduling] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!camp.data || draft) return;
    const c = camp.data;
    const text = c.content_type === 'richtext' ? campaignHTMLToText(c.body) : null;
    setDraft({
      name: c.name, subject: fromTemplate(c.subject), from: c.from_email, lists: c.lists.map((l) => l.id),
      templateId: c.template_id ?? null, text, html: c.body, archive: !!c.archive,
    });
  }, [camp.data, draft]);

  if (camp.isPending) return <div className="view"><Loading /></div>;
  if (camp.isError) return <div className="view"><ErrorState error={camp.error} retry={() => camp.refetch()} /></div>;
  const c = camp.data;
  const editable = isEditable(c.status) && can('campaigns:manage', 'campaigns:manage_all');
  const canSend = can('campaigns:send');
  const body = draft ? (draft.text !== null ? textToCampaignHTML(draft.text) : draft.html) : c.body;

  const payload = (): Record<string, unknown> => ({
    ...c,
    name: draft?.name.trim() || c.name,
    subject: draft ? toTemplate(draft.subject.trim()) : c.subject,
    from_email: draft?.from ?? c.from_email,
    lists: draft?.lists ?? c.lists.map((l) => l.id),
    template_id: draft?.templateId ?? c.template_id ?? null,
    body,
    archive: draft?.archive ?? c.archive,
  });

  const problems = draft ? [
    !draft.subject.trim() && 'Écrivez un objet.',
    draft.lists.length === 0 && 'Choisissez au moins une liste.',
    body.replace(/<[^>]+>/g, '').trim().length < 3 && 'Écrivez le texte du message.',
  ].filter(Boolean) as string[] : [];

  const run = async (a: CampaignAction) => {
    if (a === 'cancel' && !confirmCancel) { setConfirmCancel(true); return; }
    setConfirmCancel(false);
    if (a === 'schedule') {
      if (!scheduling) { setScheduling(true); return; }
      await save.mutateAsync({ id: c.id, campaign: { ...payload(), send_at: new Date(sendAt).toISOString() } });
      setScheduling(false);
    } else if (a === 'start' && editable) {
      // "Now" drops a departure date left by an earlier scheduling.
      await save.mutateAsync({ id: c.id, campaign: { ...payload(), send_at: null } });
    }
    status.mutate({ id: c.id, status: ACTION_STATUS[a] });
  };

  const actions = ACTIONS[c.status].filter((a) => canSend || a === 'pause' || a === 'unschedule');
  const relays = (config.data?.messengers ?? []);
  const campaignTemplates = (templates.data ?? []).filter((t) => t.type === 'campaign' || t.type === 'campaign_visual');
  const activeLists = (lists.data?.results ?? []).filter((l) => l.status === 'active' || draft?.lists.includes(l.id));

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <Link className="link back" to="/campagnes"><Icon name="back" size={15} /> Campagnes</Link>
          <h1 className="with-badge">{c.name} <CampaignChip status={c.status} /></h1>
          <p className="sub">
            {c.lists.map((l) => l.name).join(', ') || 'Aucune liste'} · relais {relayLabel(c.messenger)}
            {c.send_at && c.status === 'scheduled' && <> · départ le {dateTime(c.send_at)}</>}
            {c.started_at && <> · lancée le {dateTime(c.started_at)}</>}
          </p>
        </div>
        <div className="row-gap">
          {actions.map((a) => (
            <button key={a} type="button" className={a === 'start' || a === 'resume' ? 'btn btn-primary' : a === 'cancel' ? 'btn btn-ghost' : 'btn'}
              disabled={status.isPending || save.isPending || ((a === 'start' || a === 'schedule') && problems.length > 0)} onClick={() => run(a)}>
              {a === 'cancel' && confirmCancel ? 'Confirmer l’annulation' : a === 'schedule' && scheduling ? 'Confirmer la programmation' : ACTION_LABEL[a]}
            </button>
          ))}
          {can('campaigns:manage', 'campaigns:manage_all') && (
            <button type="button" className="btn" disabled={clone.isPending} onClick={() => clone.mutate(c, { onSuccess: (n) => { setDraft(null); navigate(`/campagnes/${n.id}`); } })}>Dupliquer</button>
          )}
        </div>
      </header>

      {scheduling && (
        <div className="panel schedule-bar">
          <Field id="send-at" label="Date et heure de départ">
            <input id="send-at" type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
          </Field>
          <button type="button" className="btn btn-ghost" onClick={() => setScheduling(false)}>Annuler</button>
        </div>
      )}
      {confirmCancel && <p className="alert alert-warn"><Icon name="alert" /> Une campagne annulée ne peut pas reprendre. Les e-mails déjà partis le restent.</p>}
      {problems.length > 0 && (c.status === 'draft' || c.status === 'scheduled') && <p className="small muted">Avant de lancer : {problems.join(' ')}</p>}
      {(status.isError || save.isError) && <ErrorState error={status.error ?? save.error} />}

      <dl className="kpis panel">
        <div><dt>Destinataires</dt><dd className="num">{num(c.to_send)}</dd></div>
        <div><dt>Envoyés</dt><dd className="num">{num(c.sent)}</dd></div>
        <div><dt>Ouvertures</dt><dd className="num">{num(c.views)} {c.sent > 0 && <span className="sub">{rate(c.views, c.sent)}</span>}</dd></div>
        <div><dt>Clics</dt><dd className="num">{num(c.clicks)} {c.sent > 0 && <span className="sub">{rate(c.clicks, c.sent)}</span>}</dd></div>
        <div><dt>Rebonds</dt><dd className="num">{num(c.bounces)} {c.sent > 0 && <span className="sub">{rate(c.bounces, c.sent)}</span>}</dd></div>
      </dl>
      {(c.status === 'running' || c.status === 'paused') && <Progress value={c.sent} max={Math.max(c.to_send, 1)} label="Avancement de l’envoi" />}

      {can('campaigns:get_analytics') && c.status !== 'draft' && (
        <div className="grid-2 align-start">
          <section className="panel">
            <h2>Ouvertures et clics par jour</h2>
            {analytics.views.isPending ? <Loading /> : <DayBars views={analytics.views.data ?? []} clicks={analytics.clicks.data ?? []} />}
            <p className="small muted"><span className="legend-dot legend-views" /> ouvertures <span className="legend-dot legend-clicks" /> clics</p>
          </section>
          <section className="panel">
            <h2>Liens les plus cliqués</h2>
            {analytics.links.isPending ? <Loading /> : (analytics.links.data ?? []).length === 0 ? <p className="muted small">Aucun clic pour l’instant.</p> : (
              <ol className="link-list">
                {(analytics.links.data ?? []).slice(0, 8).map((l) => (
                  <li key={l.url}><span className="mono small">{l.url}</span><span className="num strong">{num(l.count)}</span></li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      <div className="tpl-layout">
        {editable && draft ? (
          <section className="panel tpl-form">
            <h2>Contenu</h2>
            <Field id="c-name" label="Nom interne">
              <input id="c-name" type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field id="c-subject" label="Objet" hint="Les variables comme {prénom} sont remplacées pour chaque contact.">
              <input id="c-subject" type="text" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </Field>
            <Field id="c-from" label="Expéditeur">
              <input id="c-from" type="text" list="c-from-list" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
              <datalist id="c-from-list">{(config.data?.from_emails ?? []).map((f) => <option key={f} value={f} />)}</datalist>
            </Field>
            <Field id="c-template" label="Modèle">
              <select id="c-template" value={draft.templateId ?? ''} onChange={(e) => setDraft({ ...draft, templateId: Number(e.target.value) || null })}>
                {campaignTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (par défaut)' : ''}</option>)}
              </select>
            </Field>
            {draft.text !== null ? (
              <>
                <FormatBar target={bodyRef} value={draft.text} onChange={(v) => setDraft({ ...draft, text: v })} />
                <Field id="c-body" label="Message" hint="Une ligne vide sépare deux paragraphes.">
                  <textarea id="c-body" ref={bodyRef} rows={14} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
                </Field>
                <FormatHelp />
              </>
            ) : (
              <Field id="c-html" label="Message (HTML)" hint="Ce message contient de la mise en forme : il se modifie en HTML.">
                <textarea id="c-html" className="mono code-area" rows={16} spellCheck={false} value={draft.html} onChange={(e) => setDraft({ ...draft, html: e.target.value })} />
              </Field>
            )}
            <p className="small strong">Listes</p>
            <ul className="check-list">
              {activeLists.map((l) => (
                <li key={l.id}>
                  <label className="switch" htmlFor={`c-list-${l.id}`}>
                    <input id={`c-list-${l.id}`} type="checkbox" checked={draft.lists.includes(l.id)}
                      onChange={(e) => setDraft({ ...draft, lists: e.target.checked ? [...draft.lists, l.id] : draft.lists.filter((x) => x !== l.id) })} />
                    <span>{l.name} <span className="sub num">{count(l.subscriber_count, 'contact')}</span></span>
                  </label>
                </li>
              ))}
            </ul>
            <label className="switch" htmlFor="c-archive">
              <input id="c-archive" type="checkbox" checked={draft.archive} onChange={(e) => setDraft({ ...draft, archive: e.target.checked })} />
              <span>Publier dans l’archive publique du projet</span>
            </label>
            {relays.length > 1 && <p className="small muted">Relais : {relayLabel(c.messenger)}. Pour en changer, dupliquez la campagne depuis la création.</p>}
            <div className="row-gap end">
              {save.isSuccess && <span className="saved" role="status"><Icon name="check" size={16} /> Enregistré</span>}
              <button type="button" className="btn btn-dark" disabled={save.isPending} onClick={() => save.mutate({ id: c.id, campaign: payload() })}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </section>
        ) : (
          <section className="panel tpl-form">
            <h2>Contenu</h2>
            <p className="small"><span className="strong">Objet :</span> {fromTemplate(c.subject)}</p>
            <p className="small"><span className="strong">Expéditeur :</span> {c.from_email}</p>
            {!isEditable(c.status) && <p className="small muted">Une campagne {c.status === 'running' ? 'en cours' : 'terminée ou annulée'} ne se modifie plus. Mettez-la en pause pour la modifier, ou dupliquez-la.</p>}
          </section>
        )}

        <section className="panel tpl-side">
          <h2>Aperçu</h2>
          <Preview campaign={c} body={body} templateId={draft?.templateId ?? c.template_id ?? null} />
          <h3>Envoyer un test</h3>
          <div className="preset-row">
            <input type="text" aria-label="Adresses de test" placeholder="vous@exemple.fr, collegue@exemple.fr" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <button type="button" className="btn" disabled={!testTo.trim() || test.isPending}
              onClick={() => test.mutate({ id: c.id, campaign: payload(), emails: testTo.split(/[,\s]+/).filter(Boolean) })}>
              {test.isPending ? 'Envoi…' : 'Envoyer le test'}
            </button>
          </div>
          <p className="hint">Les adresses doivent être des contacts du projet : le test utilise leurs données pour les variables.</p>
          {test.isSuccess && <p className="saved" role="status"><Icon name="check" size={16} /> Test envoyé.</p>}
          {test.isError && <ErrorState error={test.error} />}
        </section>
      </div>

      <Explain title="Ouvertures, clics, rebonds : comment lire ces chiffres">
        <p>
          Les <span className="strong">ouvertures</span> sont comptées par une petite image dans l’e-mail : certains logiciels de messagerie la
          bloquent ou la chargent d’office, c’est donc une tendance plus qu’un chiffre exact. Les <span className="strong">clics</span> sont fiables.
          Les <span className="strong">rebonds</span> sont des e-mails refusés : au-delà de 2 %, nettoyez la liste (voir le guide).
        </p>
      </Explain>

      {can('campaigns:manage', 'campaigns:manage_all') && c.status !== 'running' && (
        <section className="panel danger-zone">
          <h2>Supprimer la campagne</h2>
          <p className="muted small">La campagne et ses statistiques sont supprimées.</p>
          {del.isError && <ErrorState error={del.error} />}
          {confirmDelete ? (
            <div className="row-gap">
              <button type="button" className="btn btn-danger" disabled={del.isPending} onClick={() => del.mutate(c.id, { onSuccess: () => navigate('/campagnes') })}>Supprimer définitivement</button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Annuler</button>
            </div>
          ) : <button type="button" className="btn self-start" onClick={() => setConfirmDelete(true)}>Supprimer la campagne…</button>}
        </section>
      )}
    </div>
  );
}
