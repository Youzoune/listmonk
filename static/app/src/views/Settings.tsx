import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useSaveSettings, useServerConfig, useSettings, useTestSmtp } from '../api/hooks';
import type { Settings as SettingsData, SmtpServer } from '../api/types';
import { Chip, ErrorState, Explain, Field, Icon, Loading } from '../components/ui';
import { relayLabel } from '../lib/format';
import { settingsForSave } from '../lib/settings';
import { SMTP_PRESETS, applySmtpPreset, newSmtpServer, smtpErrors } from '../lib/smtp';
import { useProject } from '../project';

const TABS = [
  { id: 'general', label: 'Général' },
  { id: 'smtp', label: 'Serveurs SMTP' },
  { id: 'envoi', label: 'Vitesse d’envoi' },
  { id: 'confidentialite', label: 'Confidentialité' },
] as const;
type Tab = typeof TABS[number]['id'];

type Patch = (patch: Partial<SettingsData>) => void;

const lines = (v: string[] | undefined) => (v ?? []).join('\n');
const fromLines = (v: string) => v.split('\n').map((l) => l.trim()).filter(Boolean);

function Toggle({ id, label, hint, checked, onChange, disabled }:
  { id: string; label: string; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="toggle-row">
      <label className="switch" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function Num({ id, label, value, onChange, unit, min = 0, hint, disabled }:
  { id: string; label: string; value: number; onChange: (v: number) => void; unit?: string; min?: number; hint?: string; disabled?: boolean }) {
  return (
    <div className="field field-num">
      <label htmlFor={id}>{label}</label>
      <div className="input-unit">
        <input id={id} type="number" min={min} value={Number.isFinite(value) ? value : 0} disabled={disabled}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))} />
        {unit && <span>{unit}</span>}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function General({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  const { project } = useProject();
  const config = useServerConfig(project.id);
  const locked = config.data?.root_url_locked;
  return (
    <section className="panel settings-panel">
      <h2>Général</h2>
      <Field id="site-name" label="Nom du site" hint="Affiché sur les pages publiques (inscription, désinscription, archive).">
        <input id="site-name" type="text" value={s['app.site_name'] ?? ''} disabled={!canEdit} onChange={(e) => set({ 'app.site_name': e.target.value })} />
      </Field>
      <Field id="root-url" label="Adresse principale" hint={locked
        ? 'Fixée par le serveur (Coolify) : elle se change dans la configuration du déploiement.'
        : 'L’adresse publique de Relais. Les liens des e-mails en dépendent.'}>
        <input id="root-url" type="url" className="mono" value={s['app.root_url'] ?? ''} disabled={!canEdit || locked}
          onChange={(e) => set({ 'app.root_url': e.target.value })} />
      </Field>
      <Field id="from-email" label="Expéditeurs proposés" hint="Un par ligne, sous la forme Nom <adresse@domaine.fr>. Le premier est l’expéditeur par défaut des campagnes.">
        <textarea id="from-email" rows={3} className="mono" value={lines(s['app.from_email'])} disabled={!canEdit}
          onChange={(e) => set({ 'app.from_email': fromLines(e.target.value) })} />
      </Field>
      <Field id="notify-emails" label="Adresses d’alerte" hint="Un par ligne. Elles reçoivent les alertes de l’instance : fin de campagne, erreurs d’envoi, imports.">
        <textarea id="notify-emails" rows={2} className="mono" value={lines(s['app.notify_emails'])} disabled={!canEdit}
          onChange={(e) => set({ 'app.notify_emails': fromLines(e.target.value) })} />
      </Field>
      <div className="grid-2">
        <Field id="logo-url" label="Logo (adresse d’une image)">
          <input id="logo-url" type="url" value={s['app.logo_url'] ?? ''} disabled={!canEdit} onChange={(e) => set({ 'app.logo_url': e.target.value })} />
        </Field>
        <Field id="favicon-url" label="Icône d’onglet (adresse)">
          <input id="favicon-url" type="url" value={s['app.favicon_url'] ?? ''} disabled={!canEdit} onChange={(e) => set({ 'app.favicon_url': e.target.value })} />
        </Field>
      </div>
      <h3>Pages publiques</h3>
      <Toggle id="pub-sub" label="Page d’inscription publique" checked={!!s['app.enable_public_subscription_page']} disabled={!canEdit}
        onChange={(v) => set({ 'app.enable_public_subscription_page': v })} hint="Un formulaire hébergé par Relais pour s’inscrire aux listes publiques de chaque projet." />
      <Toggle id="pub-archive" label="Archive publique des campagnes" checked={!!s['app.enable_public_archive']} disabled={!canEdit}
        onChange={(v) => set({ 'app.enable_public_archive': v })} hint="Les campagnes marquées « archivées » restent lisibles en ligne, avec un flux RSS." />
      <Toggle id="optin-confirm" label="Envoyer l’e-mail de confirmation d’inscription" checked={!!s['app.send_optin_confirmation']} disabled={!canEdit}
        onChange={(v) => set({ 'app.send_optin_confirmation': v })} hint="Pour les listes en double confirmation : la personne clique sur un lien pour confirmer." />
    </section>
  );
}

function SmtpEditor({ server, all, onChange, onRemove, canEdit }:
  { server: SmtpServer; all: SmtpServer[]; onChange: (s: SmtpServer) => void; onRemove: () => void; canEdit: boolean }) {
  const { projects } = useProject();
  const test = useTestSmtp();
  const [to, setTo] = useState('');
  const [preset, setPreset] = useState('');
  const errors = smtpErrors(server, all);
  const set = (patch: Partial<SmtpServer>) => onChange({ ...server, ...patch });
  const chosen = SMTP_PRESETS.find((p) => p.id === preset);
  const saved = !server._new;
  const shownName = server.name.replace(/^email-/, '');
  const projectName = projects.find((p) => p.id === server.project_id)?.name;

  return (
    <section className="panel relay-detail smtp-editor">
      <div className="relay-detail-head">
        <div>
          <h2>{shownName || 'Nouveau serveur'}</h2>
          <p className="sub mono">{server.host ? `${server.host}:${server.port}` : 'Pas encore d’hôte'}</p>
        </div>
        <div className="row-gap">
          {server.project_id !== 0 && <Chip tone="brand">{projectName ?? 'Projet'}</Chip>}
          {server.enabled ? <Chip tone="ok" icon="check">Actif</Chip> : <Chip tone="neutral">Désactivé</Chip>}
        </div>
      </div>

      <div className="preset">
        <div className="field">
          <label htmlFor="smtp-preset">Mon fournisseur</label>
          <div className="preset-row">
            <select id="smtp-preset" value={preset} disabled={!canEdit} onChange={(e) => setPreset(e.target.value)}>
              <option value="">Choisir…</option>
              {SMTP_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" className="btn" disabled={!canEdit || !chosen} onClick={() => chosen && onChange(applySmtpPreset(server, chosen))}>Remplir</button>
          </div>
          <p className="hint">Remplit l’hôte, le port et le chiffrement. Il ne reste qu’à saisir l’identifiant et le mot de passe.</p>
        </div>
        {chosen && (
          <div className="preset-card">
            <p className="strong">{chosen.name}</p>
            <p className="small"><span className="strong">Identifiants :</span> {chosen.credentials}</p>
            {chosen.relayPreset && <p className="small">Pensez ensuite à appliquer la préconfiguration « {chosen.name.split(' (')[0]} » dans <Link className="link" to="/relais">Relais d’envoi</Link> pour respecter ses limites.</p>}
          </div>
        )}
      </div>

      <h3>Connexion</h3>
      <div className="grid-2">
        <Field id="smtp-host" label="Hôte">
          <input id="smtp-host" type="text" className="mono" value={server.host} disabled={!canEdit} placeholder="ssl0.ovh.net"
            onChange={(e) => set({ host: e.target.value })} aria-invalid={!!errors.host} />
        </Field>
        <Num id="smtp-port" label="Port" value={server.port} min={1} disabled={!canEdit} onChange={(v) => set({ port: v })} />
      </div>
      {errors.host && <p className="field-error">{errors.host}</p>}
      <div className="grid-2">
        <Field id="smtp-tls" label="Chiffrement">
          <select id="smtp-tls" value={server.tls_type} disabled={!canEdit} onChange={(e) => set({ tls_type: e.target.value as SmtpServer['tls_type'] })}>
            <option value="STARTTLS">STARTTLS (souvent port 587)</option>
            <option value="TLS">SSL/TLS (souvent port 465)</option>
            <option value="none">Aucun (déconseillé)</option>
          </select>
        </Field>
        <Field id="smtp-auth" label="Authentification">
          <select id="smtp-auth" value={server.auth_protocol} disabled={!canEdit} onChange={(e) => set({ auth_protocol: e.target.value as SmtpServer['auth_protocol'] })}>
            <option value="login">LOGIN (le plus courant)</option>
            <option value="plain">PLAIN</option>
            <option value="cram">CRAM-MD5</option>
            <option value="none">Aucune</option>
          </select>
        </Field>
      </div>
      {server.auth_protocol !== 'none' && (
        <div className="grid-2">
          <Field id="smtp-user" label="Identifiant">
            <input id="smtp-user" type="text" autoComplete="off" value={server.username} disabled={!canEdit}
              onChange={(e) => set({ username: e.target.value })} aria-invalid={!!errors.username} />
          </Field>
          <Field id="smtp-pass" label="Mot de passe" hint={saved ? 'Laissez vide pour garder le mot de passe enregistré.' : undefined}>
            <input id="smtp-pass" type="password" autoComplete="new-password" value={server.password ?? ''} disabled={!canEdit}
              placeholder={saved ? 'Enregistré' : ''} onChange={(e) => set({ password: e.target.value })} />
          </Field>
        </div>
      )}
      {errors.username && <p className="field-error">{errors.username}</p>}

      <h3>Utilisation</h3>
      <Field id="smtp-name" label="Nom du relais" hint="Pour choisir ce serveur dans une campagne et lui donner sa cadence. Minuscules, chiffres et tirets.">
        <input id="smtp-name" type="text" className="mono" value={shownName} disabled={!canEdit} placeholder="ovh-contact"
          onChange={(e) => set({ name: e.target.value.toLowerCase() })} aria-invalid={!!errors.name} />
      </Field>
      {errors.name && <p className="field-error">{errors.name}</p>}
      <Toggle id="smtp-enabled" label="Serveur actif" checked={server.enabled} disabled={!canEdit} onChange={(v) => set({ enabled: v })} />
      <Toggle id="smtp-exclude" label="Ne pas utiliser dans le relais par défaut" checked={server.exclude_from_default} disabled={!canEdit || server.project_id !== 0}
        onChange={(v) => set({ exclude_from_default: v })}
        hint={server.project_id !== 0 ? 'Ce serveur est réservé à un projet : il est déjà hors du relais par défaut.' : 'Le serveur ne sert alors que dans les campagnes qui le choisissent par son nom.'} />
      <p className="small muted">Projet, cadence et warm-up de ce serveur se règlent dans <Link className="link" to="/relais">Relais d’envoi</Link>.</p>

      <details className="explain">
        <summary><Icon name="help" size={16} /> Réglages avancés</summary>
        <div className="explain-body">
          <div className="grid-3">
            <Num id="smtp-conns" label="Connexions simultanées" value={server.max_conns} min={1} disabled={!canEdit} onChange={(v) => set({ max_conns: v })} />
            <Num id="smtp-retries" label="Nouvelles tentatives" value={server.max_msg_retries} disabled={!canEdit} onChange={(v) => set({ max_msg_retries: v })} />
            <Field id="smtp-retry-delay" label="Délai entre tentatives">
              <input id="smtp-retry-delay" type="text" value={server.msg_retry_delay} disabled={!canEdit} onChange={(e) => set({ msg_retry_delay: e.target.value })} />
            </Field>
          </div>
          <div className="grid-3">
            <Field id="smtp-idle" label="Inactivité avant fermeture">
              <input id="smtp-idle" type="text" value={server.idle_timeout} disabled={!canEdit} onChange={(e) => set({ idle_timeout: e.target.value })} />
            </Field>
            <Field id="smtp-wait" label="Attente d’une connexion">
              <input id="smtp-wait" type="text" value={server.wait_timeout} disabled={!canEdit} onChange={(e) => set({ wait_timeout: e.target.value })} />
            </Field>
            <Field id="smtp-hello" label="Nom HELO (facultatif)">
              <input id="smtp-hello" type="text" value={server.hello_hostname} disabled={!canEdit} onChange={(e) => set({ hello_hostname: e.target.value })} />
            </Field>
          </div>
          {(['idle_timeout', 'wait_timeout', 'msg_retry_delay'] as const).some((k) => errors[k]) && <p className="field-error">Les durées s’écrivent comme 5s, 500ms ou 1m.</p>}
          <Toggle id="smtp-skip-verify" label="Accepter un certificat invalide" checked={server.tls_skip_verify} disabled={!canEdit}
            onChange={(v) => set({ tls_skip_verify: v })} hint="Seulement pour un serveur interne de test : ne l’activez jamais avec un fournisseur public." />
        </div>
      </details>

      <h3>Tester</h3>
      <div className="preset-row">
        <input type="email" aria-label="Adresse qui recevra l’e-mail de test" placeholder="vous@exemple.fr" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="button" className="btn" disabled={!to || !server.host || test.isPending}
          onClick={() => { const { _new: _, ...plain } = server; test.mutate({ server: plain, email: to }); }}>
          {test.isPending ? 'Envoi…' : 'Envoyer un e-mail de test'}
        </button>
      </div>
      <p className="hint">Le test utilise les valeurs ci-dessus, même avant d’enregistrer.</p>
      {test.isSuccess && <p className="saved" role="status"><Icon name="check" size={16} /> E-mail de test envoyé à {to}. Vérifiez la boîte de réception (et les indésirables).</p>}
      {test.isError && <ErrorState error={test.error} />}

      {canEdit && (
        <div className="row-gap end">
          <button type="button" className="btn btn-ghost" onClick={onRemove}>Retirer ce serveur</button>
        </div>
      )}
    </section>
  );
}

function Smtp({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  const [selected, setSelected] = useState(0);
  const servers = s.smtp ?? [];
  const current = servers[Math.min(selected, servers.length - 1)];
  const update = (i: number, server: SmtpServer) => set({ smtp: servers.map((x, j) => (j === i ? server : x)) });
  const add = () => {
    set({ smtp: [...servers, newSmtpServer()] });
    setSelected(servers.length);
  };
  const remove = (i: number) => {
    set({ smtp: servers.filter((_, j) => j !== i) });
    setSelected(0);
  };

  return (
    <>
      <Explain title="C’est quoi, un serveur SMTP ?">
        <p>
          C’est le service qui envoie réellement vos e-mails : celui de votre hébergeur (OVHcloud…), de votre messagerie (Google,
          Microsoft) ou d’un prestataire d’envoi (Brevo, Mailjet, Amazon SES). Relais lui transmet chaque message.
        </p>
        <p>Sans serveur SMTP actif, aucun e-mail ne part. Choisissez votre fournisseur dans « Mon fournisseur » : les réglages se remplissent seuls.</p>
      </Explain>
      <div className="relays">
        <nav className="relay-list" aria-label="Serveurs SMTP">
          {servers.map((x, i) => (
            <button key={x.uuid || `new-${i}`} type="button" aria-current={current === x ? 'true' : undefined} onClick={() => setSelected(i)}>
              <span className="relay-name">
                <span className={`status-dot ${x.enabled ? 'ok' : 'off'}`} aria-hidden="true" />
                <span className="strong">{x.name ? relayLabel(x.name) : x.host || 'Nouveau serveur'}</span>
                {x._new && <Chip tone="warn">Non enregistré</Chip>}
              </span>
              <span className="sub mono">{x.host ? `${x.host}:${x.port}` : '—'}</span>
            </button>
          ))}
          {canEdit && <button type="button" className="btn" onClick={add}><Icon name="plus" size={16} /> Ajouter un serveur</button>}
        </nav>
        {current
          ? <SmtpEditor key={`${selected}-${current.uuid}`} server={current} all={servers} canEdit={canEdit}
              onChange={(x) => update(servers.indexOf(current), x)} onRemove={() => remove(servers.indexOf(current))} />
          : <p className="muted">Aucun serveur SMTP. Ajoutez-en un pour pouvoir envoyer.</p>}
      </div>
    </>
  );
}

function Sending({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  return (
    <section className="panel settings-panel">
      <h2>Vitesse d’envoi de l’instance</h2>
      <p className="small muted">
        Ces réglages valent pour toute l’instance, en plus de la cadence propre à chaque relais
        (<Link className="link" to="/relais">Relais d’envoi</Link>). Laissez les valeurs par défaut si vous n’êtes pas sûr.
      </p>
      <div className="grid-3">
        <Num id="concurrency" label="Envois en parallèle" value={s['app.concurrency']} min={1} disabled={!canEdit} onChange={(v) => set({ 'app.concurrency': v })}
          hint="Nombre d’e-mails envoyés en même temps." />
        <Num id="message-rate" label="E-mails par seconde" value={s['app.message_rate']} min={1} disabled={!canEdit} onChange={(v) => set({ 'app.message_rate': v })}
          hint="Par envoi en parallèle." />
        <Num id="batch-size" label="Taille des lots" value={s['app.batch_size']} min={1} disabled={!canEdit} onChange={(v) => set({ 'app.batch_size': v })}
          hint="Contacts lus en base à la fois." />
      </div>
      <Num id="max-errors" label="Erreurs avant mise en pause" value={s['app.max_send_errors']} disabled={!canEdit} onChange={(v) => set({ 'app.max_send_errors': v })}
        hint="Une campagne se met en pause après ce nombre d’échecs d’envoi. 0 = jamais." />
      <h3>Fenêtre glissante</h3>
      <Toggle id="sliding" label="Limiter le nombre d’e-mails sur une durée" checked={!!s['app.message_sliding_window']} disabled={!canEdit}
        onChange={(v) => set({ 'app.message_sliding_window': v })}
        hint="Limite globale, toutes campagnes confondues. Préférez la cadence par relais, plus précise." />
      {s['app.message_sliding_window'] && (
        <div className="grid-2">
          <Num id="sliding-rate" label="E-mails au plus" value={s['app.message_sliding_window_rate']} min={1} disabled={!canEdit}
            onChange={(v) => set({ 'app.message_sliding_window_rate': v })} />
          <Field id="sliding-duration" label="Sur une durée de" hint="Par exemple 1h ou 30m.">
            <input id="sliding-duration" type="text" value={s['app.message_sliding_window_duration']} disabled={!canEdit}
              onChange={(e) => set({ 'app.message_sliding_window_duration': e.target.value })} />
          </Field>
        </div>
      )}
    </section>
  );
}

function Privacy({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  const t = (k: keyof SettingsData, id: string, label: string, hint: string) => (
    <Toggle id={id} label={label} hint={hint} checked={!!s[k]} disabled={!canEdit} onChange={(v) => set({ [k]: v } as Partial<SettingsData>)} />
  );
  return (
    <section className="panel settings-panel">
      <h2>Confidentialité</h2>
      {t('privacy.unsubscribe_header', 'unsub-header', 'En-tête de désinscription en un clic',
        'Ajoute List-Unsubscribe aux e-mails : Gmail et Yahoo l’exigent pour les gros volumes. Laissez-le activé.')}
      {t('privacy.individual_tracking', 'indiv-tracking', 'Suivi individuel des ouvertures et des clics',
        'Désactivé, Relais compte les ouvertures et les clics sans savoir qui a ouvert ou cliqué.')}
      {t('privacy.disable_tracking', 'no-tracking', 'Désactiver tout suivi',
        'Aucun pixel d’ouverture ni lien suivi dans les e-mails.')}
      <h3>Ce que les contacts peuvent faire eux-mêmes</h3>
      {t('privacy.allow_preferences', 'allow-prefs', 'Gérer leurs abonnements', 'Choisir les listes qu’ils gardent depuis le lien de désinscription.')}
      {t('privacy.allow_blocklist', 'allow-blocklist', 'Se désinscrire de tout', 'Ne plus jamais rien recevoir de ce projet.')}
      {t('privacy.allow_export', 'allow-export', 'Télécharger leurs données', 'Ce que le projet sait d’eux (RGPD).')}
      {t('privacy.allow_wipe', 'allow-wipe', 'Effacer leurs données', 'Supprimer leur fiche du projet (RGPD).')}
      {t('privacy.record_optin_ip', 'optin-ip', 'Enregistrer l’adresse IP à la confirmation', 'Une preuve du consentement en cas de contrôle.')}
    </section>
  );
}

export function Settings() {
  const { can } = useProject();
  const canEdit = can('settings:manage');
  const settings = useSettings(can('settings:get'));
  const save = useSaveSettings();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('onglet'))?.id ?? 'general') as Tab;
  const [draft, setDraft] = useState<SettingsData | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (settings.data && !draft) {
      // Saved passwords come back masked: edit them as empty fields.
      setDraft({ ...settings.data, smtp: settings.data.smtp.map((x) => ({ ...x, password: '' })) });
    }
  }, [settings.data, draft]);

  const dirty = useMemo(() => {
    if (!draft || !settings.data) return false;
    const base = { ...settings.data, smtp: settings.data.smtp.map((x) => ({ ...x, password: '' })) };
    return JSON.stringify(base) !== JSON.stringify(draft);
  }, [draft, settings.data]);

  const set: Patch = (patch) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setFormError('');
  };

  const submit = () => {
    if (!draft) return;
    const bad = draft.smtp.findIndex((x) => Object.keys(smtpErrors(x, draft.smtp)).length > 0);
    if (bad >= 0) {
      setFormError(`Le serveur SMTP n°${bad + 1} est incomplet : corrigez les champs signalés.`);
      setParams({ onglet: 'smtp' });
      return;
    }
    if (!draft.smtp.some((x) => x.enabled && x.project_id === 0)) {
      setFormError('Gardez au moins un serveur SMTP actif et partagé : il sert de relais par défaut.');
      return;
    }
    const r = settingsForSave(draft);
    if ('error' in r) {
      setFormError(`Le secret « ${r.error} » contient des caractères masqués : saisissez-le de nouveau en entier.`);
      return;
    }
    save.mutate(r.settings, { onSuccess: () => setDraft(null) });
  };

  if (!can('settings:get')) return <div className="view"><h1>Réglages</h1><p className="muted">Vous n’avez pas accès aux réglages.</p></div>;

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Instance</p>
          <h1>Réglages</h1>
        </div>
        <a className="btn btn-ghost" href="/admin/settings"><Icon name="out" size={16} /> Tous les réglages (ancienne interface)</a>
      </header>

      <div className="segmented" role="tablist" aria-label="Rubriques des réglages">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-pressed={tab === t.id} onClick={() => setParams({ onglet: t.id })}>{t.label}</button>
        ))}
      </div>

      {settings.isPending || !draft ? <Loading /> : settings.isError ? <ErrorState error={settings.error} retry={() => settings.refetch()} /> : (
        <>
          {tab === 'general' && <General s={draft} set={set} canEdit={canEdit} />}
          {tab === 'smtp' && <Smtp s={draft} set={set} canEdit={canEdit} />}
          {tab === 'envoi' && <Sending s={draft} set={set} canEdit={canEdit} />}
          {tab === 'confidentialite' && <Privacy s={draft} set={set} canEdit={canEdit} />}
        </>
      )}

      {canEdit && draft && (
        <div className="save-bar" role="region" aria-label="Enregistrement">
          <span className="small">
            {save.isPending ? 'Enregistrement, Relais recharge ses réglages…'
              : formError ? <span className="field-error">{formError}</span>
                : save.isSuccess && !dirty ? (typeof save.data === 'object' && save.data?.needs_restart
                  ? 'Enregistré. Des campagnes sont en cours : les réglages s’appliqueront au prochain redémarrage.'
                  : 'Enregistré et appliqué.')
                  : dirty ? 'Modifications non enregistrées.' : 'Tout est enregistré.'}
          </span>
          {save.isError && <ErrorState error={save.error} />}
          <div className="row-gap">
            <button type="button" className="btn btn-ghost" disabled={!dirty || save.isPending} onClick={() => { setDraft(null); setFormError(''); }}>Annuler</button>
            <button type="button" className="btn btn-dark" disabled={!dirty || save.isPending} onClick={submit}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
