import { relays, lists, contacts, TODAY, DAY_LABELS } from '../data.js';
import { dailyLimit, estimateEnd, formatEnd, hourlyRate, windowLabel } from '../sending.js';
import { Icon, Field } from '../ui.jsx';

const { useState, useRef } = React;

const STEPS = ['Audience', 'Message', 'Envoi', 'Vérification'];

const VARIABLES = [
  { key: 'prénom', label: 'Prénom', sample: (c) => c.name.split(' ')[0] },
  { key: 'club', label: 'Organisation', sample: (c) => c.org },
  { key: 'ville', label: 'Ville', sample: (c) => c.city },
];

function render(text, contact) {
  return VARIABLES.reduce((t, v) => t.split(`{${v.key}}`).join(v.sample(contact)), text);
}

export function NewCampaign({ project, go }) {
  const pl = lists.filter((l) => l.project === project.id);
  const pr = relays.filter((r) => r.project === project.id);
  const sample = contacts.find((c) => c.project === project.id);

  const [step, setStep] = useState(0);
  const [listIds, setListIds] = useState([pl[0].id]);
  const [subject, setSubject] = useState(project.id === 'wesportive' ? 'Les licences de {club}, sans tableur' : 'Un partenariat pour les clients de {club}');
  const [body, setBody] = useState(project.id === 'wesportive'
    ? 'Bonjour {prénom},\n\nJe m’occupe de WeSportive, un outil qui gère les licences et les cotisations des clubs. Plusieurs clubs de {ville} l’utilisent déjà.\n\nVoulez-vous que je vous montre en 15 minutes ce que ça donnerait pour {club} ?\n\nAhmed'
    : 'Bonjour {prénom},\n\nNous accompagnons des agences comme {club} sur leurs projets sport.\n\nOn en parle cette semaine ?\n\nL’équipe Youzoune');
  const [relayId, setRelayId] = useState(pr.find((r) => r.status === 'active')?.id || pr[0].id);
  const [when, setWhen] = useState('now');
  const bodyRef = useRef(null);

  const count = pl.filter((l) => listIds.includes(l.id)).reduce((n, l) => n + l.count, 0);
  const relay = pr.find((r) => r.id === relayId);
  const start = when === 'now' ? TODAY : new Date(2026, 10, 2, 9);
  const est = estimateEnd(relay, count, start, when === 'now' ? relay.sentToday : 0);

  const insert = (key) => {
    const el = bodyRef.current;
    const token = `{${key}}`;
    if (!el) { setBody(body + token); return; }
    const a = el.selectionStart, b = el.selectionEnd;
    setBody(body.slice(0, a) + token + body.slice(b));
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + token.length; });
  };

  const toggleList = (id) => setListIds(listIds.includes(id) ? listIds.filter((x) => x !== id) : [...listIds, id]);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <button type="button" className="link back" onClick={() => go('campagnes')}><Icon name="back" size={15} /> Campagnes</button>
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
              <p className="muted">Seules les listes de {project.name} sont proposées.</p>
              <div className="choice-list">
                {pl.map((l) => (
                  <label key={l.id} className={`choice ${listIds.includes(l.id) ? 'is-on' : ''}`} htmlFor={`list-${l.id}`}>
                    <input id={`list-${l.id}`} type="checkbox" checked={listIds.includes(l.id)} onChange={() => toggleList(l.id)} />
                    <span className="choice-body">
                      <span className="strong">{l.name}</span>
                      <span className="sub">{l.kind}</span>
                    </span>
                    <span className="num">{l.count}</span>
                  </label>
                ))}
              </div>
              <p className="small muted">Les contacts désinscrits ou en rebond définitif sont exclus automatiquement.</p>
            </>
          )}

          {step === 1 && (
            <>
              <h2>Le message</h2>
              <Field id="subject" label="Objet">
                <input id="subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
              <Field id="body" label="Texte" hint="Les e-mails de prospection en texte simple arrivent plus souvent en boîte de réception.">
                <div className="var-bar" role="group" aria-label="Insérer une variable">
                  <span className="small muted">Insérer :</span>
                  {VARIABLES.map((v) => (
                    <button key={v.key} type="button" className="var-chip" onClick={() => insert(v.key)}>{v.label}</button>
                  ))}
                </div>
                <textarea id="body" ref={bodyRef} rows="10" value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Par quel relais, et quand ?</h2>
              <div className="choice-list">
                {pr.map((r) => {
                  const limit = dailyLimit(r, TODAY);
                  const disabled = r.status === 'paused';
                  return (
                    <label key={r.id} className={`choice ${relayId === r.id ? 'is-on' : ''} ${disabled ? 'is-off' : ''}`} htmlFor={`relay-${r.id}`}>
                      <input id={`relay-${r.id}`} type="radio" name="relay" checked={relayId === r.id} disabled={disabled} onChange={() => setRelayId(r.id)} />
                      <span className="choice-body">
                        <span className="strong">{r.name}</span>
                        <span className="sub">{disabled ? 'En pause (taux de rebond trop élevé)' : `${hourlyRate(r)} / heure · ${limit} / jour aujourd’hui · ${windowLabel(r, DAY_LABELS)}`}</span>
                      </span>
                      {!disabled && <span className="num small">{Math.max(0, limit - r.sentToday)} dispo. aujourd’hui</span>}
                    </label>
                  );
                })}
              </div>
              <fieldset className="radio-row">
                <legend>Départ</legend>
                <label htmlFor="when-now"><input id="when-now" type="radio" name="when" checked={when === 'now'} onChange={() => setWhen('now')} /> Dès maintenant</label>
                <label htmlFor="when-later"><input id="when-later" type="radio" name="when" checked={when === 'later'} onChange={() => setWhen('later')} /> Lundi 2 novembre, 9 h</label>
              </fieldset>
            </>
          )}

          {step === 3 && (
            <>
              <h2>Tout est prêt</h2>
              <ul className="checklist">
                <li><Icon name="check" size={16} /> {count} destinataires dans {listIds.length} liste{listIds.length > 1 ? 's' : ''}</li>
                <li><Icon name="check" size={16} /> Envoi par {relay.name}, signé {project.from}</li>
                <li><Icon name="check" size={16} /> Lien de désinscription vers {project.domain}</li>
                <li><Icon name="check" size={16} /> Fin estimée {formatEnd(est.end)}</li>
              </ul>
              <div className="row-gap">
                <button type="button" className="btn">Envoyer un test à moi-même</button>
                <button type="button" className="btn btn-primary" onClick={() => go('campagnes')}>
                  {when === 'now' ? 'Lancer la campagne' : 'Planifier la campagne'}
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
            <p className="eyebrow">Estimation</p>
            <p className="estimate-big num">{count}</p>
            <p className="muted small">destinataires</p>
            <hr />
            <p className="small">Avec <span className="strong">{relay.name}</span> à {hourlyRate(relay)} e-mails par heure, en respectant le warm-up et la plage {windowLabel(relay, DAY_LABELS)} :</p>
            <p className="estimate-end">Fin {formatEnd(est.end)}</p>
            <p className="muted small num">sur {est.days} jour{est.days > 1 ? 's' : ''} d’envoi</p>
          </section>
          <section className="panel preview">
            <p className="eyebrow">Aperçu pour {sample.name}</p>
            <p className="preview-subject">{render(subject, sample)}</p>
            <p className="preview-body">{render(body, sample)}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
