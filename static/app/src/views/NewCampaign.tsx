import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCreateCampaign, useLists, useRelays, useServerConfig } from '../api/hooks';
import { ErrorState, Field, Icon, Loading } from '../components/ui';
import { textToCampaignHTML } from '../lib/body';
import { FormatBar, FormatHelp } from '../components/FormatBar';
import { num, senderName } from '../lib/format';
import { cadenceSummary, hasCadence, relayName, toCadence } from '../lib/relays';
import { estimateEnd } from '../lib/sending';
import { VARIABLES, preview, toTemplate } from '../lib/variables';
import { useProject } from '../project';

const STEPS = ['Audience', 'Message', 'Envoi', 'Vérification'] as const;
type Start = 'now' | 'scheduled' | 'draft';

// datetime-local value one hour from now, rounded to the hour.
function nextHour() {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

const isEmail = (m: string) => m === 'email' || m.startsWith('email-');

export function NewCampaign() {
  const { project, can } = useProject();
  const navigate = useNavigate();
  const lists = useLists(project.id);
  const config = useServerConfig(project.id);
  const relays = useRelays(project.id);
  const create = useCreateCampaign(project.id);
  const canSend = can('campaigns:send');

  const [step, setStep] = useState(0);
  const [listIds, setListIds] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('Bonjour {prénom},\n\n\n\n');
  const [from, setFrom] = useState('');
  const [messenger, setMessenger] = useState('email');
  // Until the user picks, the default follows their permissions, which may load after the first render.
  const [picked, setStart] = useState<Start | null>(null);
  const start: Start = picked ?? (canSend ? 'now' : 'draft');
  const [sendAt, setSendAt] = useState(nextHour);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Variables go into the field the user last typed in; the body by default.
  const target = useRef<'subject' | 'body'>('body');
  const bodyTouched = useRef(false);

  if (lists.isPending || config.isPending) return <div className="view"><Loading /></div>;
  if (lists.isError) return <div className="view"><ErrorState error={lists.error} retry={() => lists.refetch()} /></div>;
  if (config.isError) return <div className="view"><ErrorState error={config.error} retry={() => config.refetch()} /></div>;

  const allLists = lists.data.results.filter((l) => l.status === 'active');
  const chosen = allLists.filter((l) => listIds.includes(l.id));
  const count = chosen.reduce((n, l) => n + l.subscriber_count, 0);
  const sender = from || config.data.from_emails[0] || config.data.from_email;
  const campaignName = name.trim() || subject.trim();

  const problems = [
    chosen.length === 0 && { step: 0, text: 'Choisissez au moins une liste.' },
    !subject.trim() && { step: 1, text: 'Écrivez un objet.' },
    body.trim().length < 10 && { step: 1, text: 'Écrivez le texte du message.' },
    start === 'scheduled' && new Date(sendAt) <= new Date() && { step: 2, text: 'Choisissez une date de départ dans le futur.' },
  ].filter(Boolean) as { step: number; text: string }[];

  const insert = (token: string) => {
    const t = `{${token}}`;
    const inSubject = target.current === 'subject';
    const el = inSubject ? subjectRef.current : bodyRef.current;
    const value = inSubject ? subject : body;
    const update = inSubject ? setSubject : setBody;
    // An untouched body gets the variable at its end rather than before "Bonjour".
    const untouched = !inSubject && !bodyTouched.current;
    const a = el && !untouched ? el.selectionStart ?? value.length : value.trimEnd().length;
    const b = el && !untouched ? el.selectionEnd ?? a : value.length;
    const next = untouched ? `${value.trimEnd()} ${t}` : value.slice(0, a) + t + value.slice(b);
    const caret = untouched ? next.length : a + t.length;
    update(next);
    if (!inSubject) bodyTouched.current = true;
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = caret;
    });
  };

  const toggle = (id: number) => setListIds(listIds.includes(id) ? listIds.filter((x) => x !== id) : [...listIds, id]);

  const submit = () => {
    create.mutate(
      {
        campaign: {
          name: campaignName,
          subject: toTemplate(subject.trim()),
          from_email: sender,
          lists: listIds,
          messenger,
          content_type: 'richtext',
          body: textToCampaignHTML(body),
          tags: [],
          send_at: start === 'scheduled' ? new Date(sendAt).toISOString() : null,
        },
        start,
      },
      { onSuccess: (c) => navigate('/campagnes', { state: { created: c.name, status: c.status } }) },
    );
  };

  const relayList = (relays.data ?? []).filter((r) => r.enabled && config.data.messengers.includes(r.name));
  const relay = relayList.find((r) => r.name === messenger);
  // Postback channels (Réglages › Autres canaux) come after the SMTP relays.
  const channels = config.data.messengers.filter((m) => !isEmail(m));
  const relayLabel = (m: string) => relayName({ name: m, pool: m === 'email' });
  const startAt = start === 'scheduled' ? new Date(sendAt) : new Date();
  const estimate = relay && hasCadence(relay.cadence, relay.warmup) && count > 0
    ? estimateEnd(toCadence(relay.cadence, relay.warmup), count, startAt, start === 'scheduled' ? 0 : relay.status?.sent_today ?? 0)
    : null;
  const fmtEnd = (d: Date) => d.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

  const action = start === 'now' ? 'Lancer la campagne' : start === 'scheduled' ? 'Planifier la campagne' : 'Enregistrer le brouillon';

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <Link className="link back" to="/campagnes"><Icon name="back" size={15} /> Campagnes</Link>
          <h1>Nouvelle campagne</h1>
        </div>
      </header>

      <ol className="steps" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : ''}>
              <span className="step-n num">{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="wizard">
        <section className="panel wizard-main">
          {step === 0 && (
            <>
              <h2>À qui envoyer ?</h2>
              {allLists.length === 0 ? (
                <p className="muted">Ce projet n’a pas encore de liste. Créez-en une dans l’ancienne interface en attendant l’écran Listes.</p>
              ) : (
                <div className="choice-list">
                  {allLists.map((l) => (
                    <label key={l.id} className={`choice ${listIds.includes(l.id) ? 'is-on' : ''}`} htmlFor={`list-${l.id}`}>
                      <input id={`list-${l.id}`} type="checkbox" checked={listIds.includes(l.id)} onChange={() => toggle(l.id)} />
                      <span className="choice-body">
                        <span className="strong">{l.name}</span>
                        <span className="sub">{l.type === 'public' ? 'Publique' : 'Privée'}{l.optin === 'double' ? ' · double opt-in' : ''}</span>
                      </span>
                      <span className="num">{num(l.subscriber_count)}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="small muted">Les contacts désinscrits ou en liste noire ne reçoivent rien.</p>
            </>
          )}

          {step === 1 && (
            <>
              <h2>Le message</h2>
              <Field id="subject" label="Objet">
                <input id="subject" ref={subjectRef} type="text" value={subject} onFocus={() => { target.current = 'subject'; }}
                  onChange={(e) => setSubject(e.target.value)} placeholder="Gérer les licences de {organisation} sans tableur" />
              </Field>
              <div className="var-bar" role="group" aria-label="Insérer une variable dans le dernier champ utilisé">
                <span className="small muted">Insérer :</span>
                {VARIABLES.map((v) => (
                  <button key={v.token} type="button" className="var-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v.token)}>{v.label}</button>
                ))}
              </div>
              <FormatBar target={bodyRef} value={body} onChange={(v) => { setBody(v); bodyTouched.current = true; }} />
              <Field id="body" label="Texte" hint="Une ligne vide sépare deux paragraphes. Le lien de désinscription est ajouté automatiquement en bas de l’e-mail.">
                <textarea id="body" ref={bodyRef} rows={11} value={body} onFocus={() => { target.current = 'body'; bodyTouched.current = true; }}
                  onChange={(e) => setBody(e.target.value)} />
              </Field>
              <FormatHelp />
              <p className="small muted">Organisation et Ville viennent des attributs <span className="mono">organisation</span> et <span className="mono">ville</span> des contacts ; vides s’ils ne sont pas renseignés.</p>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Par quel relais, et quand ?</h2>
              <div className="choice-list">
                {[...(relayList.length ? relayList.map((r) => r.name) : config.data.messengers.filter(isEmail)), ...channels].map((m) => {
                  const r = relayList.find((x) => x.name === m);
                  const left = r?.status && r.status.limit_today > 0 ? Math.max(0, r.status.limit_today - r.status.sent_today) : null;
                  return (
                    <label key={m} className={`choice ${messenger === m ? 'is-on' : ''}`} htmlFor={`relay-${m}`}>
                      <input id={`relay-${m}`} type="radio" name="relay" checked={messenger === m} onChange={() => setMessenger(m)} />
                      <span className="choice-body">
                        <span className="strong">{relayLabel(m)}</span>
                        <span className="sub">
                          {m === 'email' ? 'Répartit les envois sur les serveurs SMTP partagés' : r ? cadenceSummary(r.cadence, r.warmup) : isEmail(m) ? 'Serveur SMTP dédié' : 'Autre canal (SMS, messagerie…)'}
                          {r && r.project_id !== 0 ? ' · réservé à ce projet' : ''}
                        </span>
                      </span>
                      {left !== null && <span className="num small">{num(left)} dispo. aujourd’hui</span>}
                    </label>
                  );
                })}
              </div>
              <Field id="from" label="Expéditeur">
                <select id="from" value={sender} onChange={(e) => setFrom(e.target.value)}>
                  {config.data.from_emails.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <fieldset className="radio-row">
                <legend>Départ</legend>
                {canSend && <label htmlFor="start-now"><input id="start-now" type="radio" name="start" checked={start === 'now'} onChange={() => setStart('now')} /> Dès maintenant</label>}
                {canSend && <label htmlFor="start-later"><input id="start-later" type="radio" name="start" checked={start === 'scheduled'} onChange={() => setStart('scheduled')} /> Plus tard</label>}
                <label htmlFor="start-draft"><input id="start-draft" type="radio" name="start" checked={start === 'draft'} onChange={() => setStart('draft')} /> Garder en brouillon</label>
              </fieldset>
              {start === 'scheduled' && (
                <Field id="send-at" label="Date et heure de départ">
                  <input id="send-at" type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
                </Field>
              )}

            </>
          )}

          {step === 3 && (
            <>
              <h2>{problems.length ? 'Encore un détail' : 'Tout est prêt'}</h2>
              <Field id="name" label="Nom interne de la campagne" hint="Visible seulement par l’équipe. Par défaut, l’objet.">
                <input id="name" type="text" value={name} placeholder={subject} onChange={(e) => setName(e.target.value)} />
              </Field>
              <ul className="checklist">
                <li><Icon name="check" size={16} /> {num(count)} contact{count > 1 ? 's' : ''} dans {chosen.length} liste{chosen.length > 1 ? 's' : ''}</li>
                <li><Icon name="check" size={16} /> Envoi par {relayLabel(messenger)}, signé {senderName(sender)}</li>
                <li><Icon name="check" size={16} /> {start === 'now' ? 'Départ immédiat' : start === 'scheduled' ? `Départ le ${new Date(sendAt).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}` : 'Reste en brouillon'}</li>
                {estimate?.end && start !== 'draft' && <li><Icon name="clock" size={16} /> Fin estimée {fmtEnd(estimate.end)}, sur {estimate.days} jour{estimate.days > 1 ? 's' : ''} d’envoi</li>}
              </ul>
              {problems.length > 0 && (
                <ul className="problems">
                  {problems.map((p) => (
                    <li key={p.text}><Icon name="alert" size={16} /> {p.text} <button type="button" className="link" onClick={() => setStep(p.step)}>Corriger</button></li>
                  ))}
                </ul>
              )}
              {create.isError && <ErrorState error={create.error} />}
              <div className="row-gap">
                <button type="button" className="btn btn-primary" disabled={problems.length > 0 || create.isPending} onClick={submit}>
                  {create.isPending ? 'Enregistrement…' : action}
                </button>
              </div>
            </>
          )}

          <div className="wizard-nav">
            <button type="button" className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Retour</button>
            {step < 3 && <button type="button" className="btn btn-dark" onClick={() => setStep(step + 1)}>Continuer <Icon name="arrow" size={16} /></button>}
          </div>
        </section>

        <aside className="wizard-side">
          <section className="panel estimate">
            <p className="eyebrow">Destinataires</p>
            <p className="estimate-big num">{num(count)}</p>
            <p className="small">{chosen.length ? chosen.map((l) => l.name).join(', ') : 'Aucune liste choisie'}</p>
            {count > 0 && (
              <>
                <hr />
                {estimate ? (
                  <>
                    <p className="small">Avec <span className="strong">{relayLabel(messenger)}</span> ({cadenceSummary(relay!.cadence, relay!.warmup)}) :</p>
                    <p className="estimate-end">{estimate.end ? `Fin ${fmtEnd(estimate.end)}` : 'Plus de quatre mois d’envoi'}</p>
                    <p className="muted small num">sur {estimate.days} jour{estimate.days > 1 ? 's' : ''} d’envoi</p>
                  </>
                ) : (
                  <p className="small muted">{relayLabel(messenger)} n’a pas de cadence propre : envoi au rythme global de l’instance.</p>
                )}
              </>
            )}
          </section>
          <section className="panel preview">
            <p className="eyebrow">Aperçu avec un contact d’exemple</p>
            <p className="preview-subject">{preview(subject) || 'Objet'}</p>
            <p className="preview-body">{preview(body)}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
