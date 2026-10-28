import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSaveSettings, useSettings, useTestSmtp } from '../api/hooks';
import type { SmtpServer } from '../api/types';
import { ErrorState, Explain, Field, Icon, Loading } from '../components/ui';
import { PRESETS, applyPreset } from '../lib/presets';
import { cadenceSummary, today } from '../lib/relays';
import { settingsForSave } from '../lib/settings';
import { SMTP_PRESETS, applySmtpPreset, freeRelayName, isExampleServer, newSmtpServer, smtpErrors } from '../lib/smtp';
import { useProject } from '../project';

const STEPS = ['Fournisseur', 'Connexion', 'Rythme d’envoi'];
const OTHER = 'autre';

// Adds a sending relay in three steps: who sends the e-mails, how to connect,
// at what pace. A relay is an SMTP server saved with a name in the settings.
export function NewRelay() {
  const { project, can } = useProject();
  const navigate = useNavigate();
  const settings = useSettings(can('settings:get'));
  const save = useSaveSettings();
  const test = useTestSmtp();

  const [step, setStep] = useState(0);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [server, setServer] = useState<SmtpServer>(() => newSmtpServer());
  const [reserved, setReserved] = useState(false);
  const [paceId, setPaceId] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [replaceExamples, setReplaceExamples] = useState(true);

  const existing = useMemo(() => settings.data?.smtp ?? [], [settings.data]);
  const provider = SMTP_PRESETS.find((p) => p.id === providerId);
  const set = (patch: Partial<SmtpServer>) => setServer((s) => ({ ...s, ...patch }));

  if (!can('settings:manage')) {
    return <div className="view"><h1>Nouveau relais</h1><p className="muted">Ajouter un relais demande le droit de modifier les réglages.</p></div>;
  }
  if (settings.isPending) return <div className="view"><Loading /></div>;
  if (settings.isError) return <div className="view"><ErrorState error={settings.error} retry={() => settings.refetch()} /></div>;

  const choose = (id: string) => {
    setProviderId(id);
    const p = SMTP_PRESETS.find((x) => x.id === id);
    const base = newSmtpServer();
    setServer(p ? { ...applySmtpPreset(base, p), name: freeRelayName(p.id, existing) } : { ...base, name: freeRelayName('relais', existing) });
    // The provider's own limits are the sensible default pace.
    setPaceId(p?.relayPreset ?? 'new-domain');
    setStep(1);
  };

  const full: SmtpServer = { ...server, project_id: reserved ? project.id : 0 };
  const errors = smtpErrors(full, existing);
  const connectionErrors = Object.entries(errors).filter(([k]) => ['host', 'port', 'username', 'name'].includes(k));
  const passwordMissing = server.auth_protocol !== 'none' && !server.password;
  const pace = PRESETS.find((p) => p.id === paceId);
  const examples = existing.filter(isExampleServer);
  // A relay reserved to a project isn't in the default relay: the examples can't go then.
  const dropExamples = replaceExamples && examples.length > 0 && !reserved;

  const finish = () => {
    setSubmitted(true);
    if (connectionErrors.length || passwordMissing || !settings.data) { setStep(1); return; }
    const { cadence, warmup } = pace
      ? applyPreset(pace, full.cadence, { ...full.warmup, since: today() })
      : { cadence: full.cadence, warmup: full.warmup };
    const kept = dropExamples ? settings.data.smtp.filter((s) => !isExampleServer(s)) : settings.data.smtp;
    const out = settingsForSave({ ...settings.data, smtp: [...kept, { ...full, cadence, warmup }] });
    if (!('settings' in out)) return;
    save.mutate(out.settings, { onSuccess: () => navigate(`/relais?relais=${encodeURIComponent(full.name)}`) });
  };

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <Link className="link back" to="/relais"><Icon name="back" size={15} /> Relais d’envoi</Link>
          <h1>Nouveau relais</h1>
        </div>
      </header>

      <ol className="steps" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" disabled={i > 0 && !providerId} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : ''}>
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
              <h2>Qui envoie vos e-mails ?</h2>
              <p className="muted small">
                Le relais, c’est le service qui remet vos e-mails aux boîtes de réception : votre messagerie (OVH, Google, Microsoft)
                ou un service d’envoi (Brevo, Mailjet, Amazon SES). Choisissez celui chez qui vous avez un compte.
              </p>
              <div className="choice-list provider-list">
                {SMTP_PRESETS.map((p) => (
                  <button key={p.id} type="button" className={`choice ${providerId === p.id ? 'is-on' : ''}`} onClick={() => choose(p.id)}>
                    <span className="choice-body">
                      <span className="strong">{p.name}</span>
                      <span className="sub mono">{p.host}</span>
                    </span>
                    <Icon name="arrow" size={16} />
                  </button>
                ))}
                <button type="button" className={`choice ${providerId === OTHER ? 'is-on' : ''}`} onClick={() => choose(OTHER)}>
                  <span className="choice-body">
                    <span className="strong">Un autre fournisseur</span>
                    <span className="sub">Vous avez l’adresse du serveur SMTP, le port et les identifiants.</span>
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2>Se connecter à {provider?.name ?? 'votre serveur'}</h2>
              {provider && <p className="preset-card small">{provider.credentials}</p>}
              <div className="grid-2">
                <Field id="nr-user" label="Identifiant">
                  <input id="nr-user" type="text" autoComplete="off" value={server.username} onChange={(e) => set({ username: e.target.value })}
                    placeholder={provider?.credentials.startsWith('L’adresse') ? 'vous@votre-domaine.fr' : ''} />
                </Field>
                <Field id="nr-pwd" label="Mot de passe">
                  <input id="nr-pwd" type="password" autoComplete="new-password" value={server.password} onChange={(e) => set({ password: e.target.value })} />
                </Field>
              </div>
              {submitted && errors.username && <p className="field-error">{errors.username}</p>}
              {submitted && passwordMissing && <p className="field-error">Indiquez le mot de passe.</p>}

              {providerId === OTHER ? (
                <div className="grid-2">
                  <Field id="nr-host" label="Serveur SMTP" hint="Par exemple smtp.votre-hebergeur.fr.">
                    <input id="nr-host" type="text" className="mono" value={server.host} onChange={(e) => set({ host: e.target.value })} />
                  </Field>
                  <Field id="nr-port" label="Port" hint="587 (STARTTLS) ou 465 (TLS), le plus souvent.">
                    <input id="nr-port" type="text" inputMode="numeric" value={server.port || ''} onChange={(e) => {
                      const port = Number(e.target.value.replace(/\D/g, ''));
                      set({ port, tls_type: port === 465 ? 'TLS' : port === 25 ? 'none' : 'STARTTLS' });
                    }} />
                  </Field>
                  <Field id="nr-tls" label="Chiffrement">
                    <select id="nr-tls" value={server.tls_type} onChange={(e) => set({ tls_type: e.target.value as SmtpServer['tls_type'] })}>
                      <option value="STARTTLS">STARTTLS (port 587)</option>
                      <option value="TLS">TLS (port 465)</option>
                      <option value="none">Aucun (déconseillé)</option>
                    </select>
                  </Field>
                  <Field id="nr-auth" label="Authentification">
                    <select id="nr-auth" value={server.auth_protocol} onChange={(e) => set({ auth_protocol: e.target.value as SmtpServer['auth_protocol'] })}>
                      <option value="login">Identifiant et mot de passe</option>
                      <option value="plain">PLAIN</option>
                      <option value="cram">CRAM-MD5</option>
                      <option value="none">Aucune</option>
                    </select>
                  </Field>
                </div>
              ) : (
                <p className="small muted">Serveur rempli pour vous : <span className="mono">{server.host}:{server.port}</span> ({server.tls_type === 'TLS' ? 'TLS' : 'STARTTLS'}).</p>
              )}
              {submitted && errors.host && <p className="field-error">{errors.host}</p>}

              <Field id="nr-name" label="Nom du relais" hint="Pour le reconnaître dans les campagnes. Minuscules, chiffres et tirets.">
                <input id="nr-name" type="text" className="mono" value={server.name} onChange={(e) => set({ name: e.target.value.toLowerCase() })} />
              </Field>
              {errors.name && <p className="field-error">{errors.name}</p>}

              <label className="switch" htmlFor="nr-reserved">
                <input id="nr-reserved" type="checkbox" checked={reserved} onChange={(e) => setReserved(e.target.checked)} />
                <span>Réservé au projet {project.name}</span>
              </label>
              <p className="small muted">Coché, seuls les envois de ce projet passent par ce relais. Sinon, tous les projets peuvent le choisir.</p>

              <h3>Vérifier avant d’enregistrer (conseillé)</h3>
              <div className="row-gap">
                <input aria-label="Adresse qui recevra l’e-mail de test" type="email" className="grow" placeholder="vous@exemple.fr" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                <button type="button" className="btn" disabled={test.isPending || !testTo.includes('@') || !server.host || passwordMissing}
                  onClick={() => test.mutate({ server: full, email: testTo.trim() })}>
                  {test.isPending ? 'Envoi…' : 'Envoyer un e-mail de test'}
                </button>
              </div>
              {test.isSuccess && <p className="saved small" role="status"><Icon name="check" size={14} /> E-mail de test envoyé : la connexion fonctionne.</p>}
              {test.isError && <ErrorState error={test.error} />}
            </>
          )}

          {step === 2 && (
            <>
              <h2>À quel rythme envoyer ?</h2>
              <p className="muted small">
                Envoyer trop vite depuis une adresse neuve, c’est le meilleur moyen d’arriver en spam. Relais étale les envois et augmente
                le volume jour après jour (le warm-up). Vous pourrez tout ajuster ensuite.
              </p>
              <div className="choice-list">
                {PRESETS.filter((p) => p.kind === 'profile' || p.id === provider?.relayPreset).map((p) => {
                  const r = applyPreset(p, full.cadence, full.warmup);
                  return (
                    <label key={p.id} className={`choice ${paceId === p.id ? 'is-on' : ''}`} htmlFor={`pace-${p.id}`}>
                      <input id={`pace-${p.id}`} type="radio" name="pace" checked={paceId === p.id} onChange={() => setPaceId(p.id)} />
                      <span className="choice-body">
                        <span className="strong">{p.kind === 'provider' ? `Limites de ${p.name}` : p.name}</span>
                        <span className="sub">{p.when}</span>
                        <span className="sub">{cadenceSummary(r.cadence, r.warmup)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {examples.length > 0 && (
                <>
                  <label className="switch" htmlFor="nr-replace">
                    <input id="nr-replace" type="checkbox" checked={replaceExamples && !reserved} disabled={reserved} onChange={(e) => setReplaceExamples(e.target.checked)} />
                    <span>Remplacer les serveurs d’exemple de l’installation ({examples.map((s) => s.host).join(', ')})</span>
                  </label>
                  <p className="small muted">
                    {reserved
                      ? 'Un relais réservé à un projet ne remplace pas le relais par défaut : les exemples restent, à remplacer plus tard.'
                      : 'Ils ne peuvent rien envoyer. Votre serveur devient aussi celui du relais par défaut.'}
                  </p>
                </>
              )}
              {save.isError && <ErrorState error={save.error} />}
            </>
          )}

          <div className="wizard-nav">
            {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>Retour</button> : <span />}
            {step === 1 && <button type="button" className="btn btn-dark" onClick={() => {
              setSubmitted(true);
              if (!connectionErrors.length && !passwordMissing) { setSubmitted(false); setStep(2); }
            }}>Continuer</button>}
            {step === 2 && (
              <button type="button" className="btn btn-primary" disabled={save.isPending} onClick={finish}>
                {save.isPending ? 'Enregistrement…' : 'Créer le relais'}
              </button>
            )}
          </div>
        </section>

        <aside className="wizard-side">
          <Explain title="Je n’ai pas de serveur d’envoi">
            <p>
              Le plus simple : l’adresse e-mail de votre domaine chez OVH, Google ou Microsoft, avec son mot de passe. Pour de gros volumes
              (plusieurs milliers par jour), un service d’envoi comme Brevo ou Amazon SES est fait pour ça.
            </p>
            <p><Link className="link" to="/guide">Le guide de l’envoi</Link> explique le spam, le warm-up et les réglages DNS (SPF, DKIM, DMARC).</p>
          </Explain>
        </aside>
      </div>
    </div>
  );
}
