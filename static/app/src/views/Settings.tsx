import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useRoles, useSaveSettings, useServerConfig, useSettings, useTestSmtp } from '../api/hooks';
import type { BounceBox, Messenger, Settings as SettingsData, SmtpServer } from '../api/types';
import { Chip, ErrorState, Explain, Field, Icon, Loading } from '../components/ui';
import { relayLabel } from '../lib/format';
import { forEditing, settingsForSave } from '../lib/settings';
import { SMTP_PRESETS, applySmtpPreset, newSmtpServer, smtpErrors } from '../lib/smtp';
import { useProject } from '../project';

const TABS = [
  { id: 'general', label: 'Général' },
  { id: 'smtp', label: 'Serveurs SMTP' },
  { id: 'envoi', label: 'Vitesse d’envoi' },
  { id: 'confidentialite', label: 'Confidentialité' },
  { id: 'securite', label: 'Sécurité' },
  { id: 'rebonds', label: 'Rebonds' },
  { id: 'medias', label: 'Stockage des médias' },
  { id: 'messagers', label: 'Autres canaux' },
  { id: 'apparence', label: 'Apparence' },
  { id: 'performances', label: 'Performances' },
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

const LANGS = [['fr', 'Français'], ['fr-CA', 'Français (Canada)'], ['en', 'English'], ['es', 'Español'], ['de', 'Deutsch'], ['it', 'Italiano'],
  ['pt', 'Português'], ['nl', 'Nederlands'], ['ar', 'العربية'], ['tr', 'Türkçe']] as const;

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
      {s['app.enable_public_archive'] && (
        <Toggle id="rss-content" label="Texte complet des campagnes dans le flux RSS" checked={!!s['app.enable_public_archive_rss_content']} disabled={!canEdit}
          onChange={(v) => set({ 'app.enable_public_archive_rss_content': v })} hint="Sinon le flux ne donne que le titre et le lien." />
      )}
      <Toggle id="optin-confirm" label="Envoyer l’e-mail de confirmation d’inscription" checked={!!s['app.send_optin_confirmation']} disabled={!canEdit}
        onChange={(v) => set({ 'app.send_optin_confirmation': v })} hint="Pour les listes en double confirmation : la personne clique sur un lien pour confirmer." />
      <Toggle id="optin-page" label="Page de confirmation avant l’inscription" checked={!!s['app.show_optin_page']} disabled={!canEdit}
        onChange={(v) => set({ 'app.show_optin_page': v })} hint="Le lien de l’e-mail ouvre une page avec un bouton « Confirmer » : les antivirus qui ouvrent les liens ne confirment pas à la place de la personne." />
      <Field id="app-lang" label="Langue des pages publiques et des e-mails système" hint="Inscription, désinscription, confirmation, alertes.">
        <select id="app-lang" value={s['app.lang'] ?? 'fr'} disabled={!canEdit} onChange={(e) => set({ 'app.lang': e.target.value })}>
          {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          {!LANGS.some(([c]) => c === s['app.lang']) && s['app.lang'] && <option value={s['app.lang']}>{s['app.lang']}</option>}
        </select>
      </Field>
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
          <h2>{shownName || server.host || 'Nouveau serveur'}</h2>
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

const EXPORTABLE = [['profile', 'Fiche (nom, adresse, attributs)'], ['subscriptions', 'Abonnements aux listes'],
  ['campaign_views', 'Ouvertures des campagnes'], ['link_clicks', 'Clics sur les liens']] as const;

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
      {s['privacy.allow_export'] && (
        <fieldset className="perm-group">
          <legend>Données incluses dans le téléchargement</legend>
          {EXPORTABLE.map(([k, label]) => (
            <label key={k} className="switch" htmlFor={`exp-${k}`}>
              <input id={`exp-${k}`} type="checkbox" disabled={!canEdit} checked={(s['privacy.exportable'] ?? []).includes(k)}
                onChange={(e) => set({ 'privacy.exportable': e.target.checked ? [...(s['privacy.exportable'] ?? []), k] : (s['privacy.exportable'] ?? []).filter((x) => x !== k) })} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      )}
      <h3>Domaines d’adresses</h3>
      <div className="grid-2">
        <Field id="dom-block" label="Domaines refusés" hint="Un par ligne, par exemple yopmail.com. Ces adresses ne peuvent ni s’inscrire ni être importées. *.exemple.fr couvre les sous-domaines.">
          <textarea id="dom-block" rows={4} className="mono" value={lines(s['privacy.domain_blocklist'])} disabled={!canEdit}
            onChange={(e) => set({ 'privacy.domain_blocklist': fromLines(e.target.value) })} />
        </Field>
        <Field id="dom-allow" label="Seuls domaines acceptés (facultatif)" hint="Un par ligne. Rempli, seules ces adresses peuvent s’inscrire ou être importées : pratique pour une liste interne.">
          <textarea id="dom-allow" rows={4} className="mono" value={lines(s['privacy.domain_allowlist'])} disabled={!canEdit}
            onChange={(e) => set({ 'privacy.domain_allowlist': fromLines(e.target.value) })} />
        </Field>
      </div>
    </section>
  );
}

function Security({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  const captcha = s['security.captcha'] ?? { altcha: { enabled: false, complexity: 300000 }, hcaptcha: { enabled: false, key: '', secret: '' } };
  const setCaptcha = (patch: Partial<typeof captcha>) => set({ 'security.captcha': { ...captcha, ...patch } });
  return (
    <section className="panel settings-panel">
      <h2>Sécurité</h2>
      <Field id="trusted-urls" label="Adresses de confiance" hint="Une par ligne. Pages vers lesquelles un formulaire d’inscription peut rediriger après l’inscription (par exemple https://monsite.fr/merci).">
        <textarea id="trusted-urls" rows={3} className="mono" value={lines(s['security.trusted_urls'])} disabled={!canEdit}
          onChange={(e) => set({ 'security.trusted_urls': fromLines(e.target.value) })} />
      </Field>
      <Field id="session" label="Durée de connexion" hint="Après ce délai sans activité, il faut se reconnecter. Par exemple 720h (30 jours).">
        <input id="session" type="text" value={s['security.session_duration'] ?? ''} disabled={!canEdit} onChange={(e) => set({ 'security.session_duration': e.target.value })} />
      </Field>
      <h3>Protection anti-robots du formulaire public</h3>
      <Toggle id="altcha" label="Altcha (sans service externe, recommandé)" checked={!!captcha.altcha?.enabled} disabled={!canEdit}
        onChange={(v) => setCaptcha({ altcha: { ...captcha.altcha, enabled: v }, hcaptcha: { ...captcha.hcaptcha, enabled: v ? false : captcha.hcaptcha.enabled } })}
        hint="Le navigateur résout un petit calcul invisible : les robots qui remplissent des formulaires à la chaîne sont arrêtés." />
      <Toggle id="hcaptcha" label="hCaptcha" checked={!!captcha.hcaptcha?.enabled} disabled={!canEdit}
        onChange={(v) => setCaptcha({ hcaptcha: { ...captcha.hcaptcha, enabled: v }, altcha: { ...captcha.altcha, enabled: v ? false : captcha.altcha.enabled } })}
        hint="Le service hCaptcha, avec une clé de site et un secret." />
      {captcha.hcaptcha?.enabled && (
        <div className="grid-2">
          <Field id="hc-key" label="Clé de site hCaptcha">
            <input id="hc-key" type="text" value={captcha.hcaptcha.key} disabled={!canEdit} onChange={(e) => setCaptcha({ hcaptcha: { ...captcha.hcaptcha, key: e.target.value } })} />
          </Field>
          <Field id="hc-secret" label="Secret hCaptcha" hint="Laissez vide pour garder le secret enregistré.">
            <input id="hc-secret" type="password" autoComplete="new-password" placeholder="Enregistré" value={captcha.hcaptcha.secret} disabled={!canEdit}
              onChange={(e) => setCaptcha({ hcaptcha: { ...captcha.hcaptcha, secret: e.target.value } })} />
          </Field>
        </div>
      )}
      <Oidc s={s} set={set} canEdit={canEdit} />
    </section>
  );
}

const NO_OIDC: SettingsData['security.oidc'] = {
  enabled: false, logout: false, verify_email: true, provider_url: '', provider_name: '', client_id: '', client_secret: '',
  auto_create_users: false, default_user_role_id: null, default_list_role_id: null, roles: [],
};

// Single sign-on through Google Workspace, Microsoft, Keycloak, Authentik…
function Oidc({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  const { can } = useProject();
  const roles = useRoles(can('roles:get'));
  const o = { ...NO_OIDC, ...s['security.oidc'] };
  const setO = (patch: Partial<typeof o>) => set({ 'security.oidc': { ...o, ...patch } });
  const callback = `${(s['app.root_url'] ?? '').replace(/\/$/, '')}/auth/oidc`;
  const mappings = o.roles ?? [];
  const setMapping = (i: number, patch: Partial<(typeof mappings)[number]>) => setO({ roles: mappings.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const roleSelect = (id: string, label: string, value: number | null | undefined, list: { id: number; name: string }[], onChange: (v: number | null) => void, none: string) => (
    <Field id={id} label={label}>
      <select id={id} value={value ?? ''} disabled={!canEdit} onChange={(e) => onChange(Number(e.target.value) || null)}>
        <option value="">{none}</option>
        {list.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
    </Field>
  );

  return (
    <>
      <h3>Connexion avec un compte d’entreprise (OIDC)</h3>
      <Toggle id="oidc-on" label="Proposer « Se connecter avec… » sur la page de connexion" checked={o.enabled} disabled={!canEdit} onChange={(v) => setO({ enabled: v })}
        hint="Google Workspace, Microsoft Entra, Keycloak, Authentik… L’équipe se connecte avec son compte habituel." />
      {o.enabled && (
        <>
          <Explain title="Où trouver ces informations">
            <p>Dans la console du fournisseur, créez une application « Web » (OAuth 2 / OpenID Connect) et donnez-lui cette adresse de retour :</p>
            <p><code className="mono">{callback}</code></p>
            <p>Le fournisseur affiche ensuite un identifiant client et un secret. L’adresse du fournisseur est par exemple
              https://accounts.google.com ou https://login.microsoftonline.com/&lt;tenant&gt;/v2.0.</p>
          </Explain>
          <div className="grid-2">
            <Field id="oidc-name" label="Nom affiché" hint="Sur le bouton de connexion, par exemple Google.">
              <input id="oidc-name" type="text" value={o.provider_name} disabled={!canEdit} onChange={(e) => setO({ provider_name: e.target.value })} />
            </Field>
            <Field id="oidc-url" label="Adresse du fournisseur">
              <input id="oidc-url" type="url" className="mono" value={o.provider_url} disabled={!canEdit} onChange={(e) => setO({ provider_url: e.target.value })} />
            </Field>
            <Field id="oidc-client" label="Identifiant client">
              <input id="oidc-client" type="text" className="mono" value={o.client_id} disabled={!canEdit} onChange={(e) => setO({ client_id: e.target.value })} />
            </Field>
            <Field id="oidc-secret" label="Secret client" hint="Laissez vide pour garder le secret enregistré.">
              <input id="oidc-secret" type="password" autoComplete="new-password" placeholder="Enregistré" value={o.client_secret} disabled={!canEdit}
                onChange={(e) => setO({ client_secret: e.target.value })} />
            </Field>
          </div>
          <Toggle id="oidc-verify" label="Exiger une adresse e-mail vérifiée" checked={o.verify_email} disabled={!canEdit} onChange={(v) => setO({ verify_email: v })} />
          <Toggle id="oidc-logout" label="Se déconnecter aussi du fournisseur" checked={o.logout} disabled={!canEdit} onChange={(v) => setO({ logout: v })}
            hint="Quitter Relais ferme aussi la session chez le fournisseur." />
          <Toggle id="oidc-create" label="Créer le compte à la première connexion" checked={o.auto_create_users} disabled={!canEdit} onChange={(v) => setO({ auto_create_users: v })}
            hint="Sinon, seuls les utilisateurs déjà créés dans Équipe (même adresse e-mail) peuvent se connecter." />
          {o.auto_create_users && (
            <>
              <div className="grid-2">
                {roleSelect('oidc-role', 'Rôle des nouveaux comptes', o.default_user_role_id, roles.users.data ?? [], (v) => setO({ default_user_role_id: v }), 'Choisir…')}
                {roleSelect('oidc-list-role', 'Rôle sur les listes (facultatif)', o.default_list_role_id, roles.lists.data ?? [], (v) => setO({ default_list_role_id: v }), 'Aucun')}
              </div>
              <h4>Rôle selon un attribut du compte (facultatif)</h4>
              <p className="small muted">Par exemple l’attribut « groups » égal à « marketing » donne le rôle Éditeur. La première règle qui correspond l’emporte.</p>
              {mappings.map((m, i) => (
                <div key={i} className="oidc-rule">
                  <Field id={`oidc-claim-${i}`} label="Attribut">
                    <input id={`oidc-claim-${i}`} type="text" className="mono" value={m.claim} disabled={!canEdit} onChange={(e) => setMapping(i, { claim: e.target.value })} />
                  </Field>
                  <Field id={`oidc-match-${i}`} label="Valeur exacte">
                    <input id={`oidc-match-${i}`} type="text" value={m.match} disabled={!canEdit} onChange={(e) => setMapping(i, { match: e.target.value })} />
                  </Field>
                  {roleSelect(`oidc-r-${i}`, 'Rôle', m.user_role_id, roles.users.data ?? [], (v) => setMapping(i, { user_role_id: v ?? undefined }), 'Rôle par défaut')}
                  {roleSelect(`oidc-lr-${i}`, 'Rôle sur les listes', m.list_role_id, roles.lists.data ?? [], (v) => setMapping(i, { list_role_id: v ?? undefined }), 'Aucun')}
                  {canEdit && <button type="button" className="btn btn-sm btn-ghost" aria-label={`Retirer la règle ${i + 1}`} onClick={() => setO({ roles: mappings.filter((_, j) => j !== i) })}><Icon name="x" size={14} /></button>}
                </div>
              ))}
              {canEdit && <button type="button" className="btn btn-sm self-start" onClick={() => setO({ roles: [...mappings, { claim: 'groups', match: '' }] })}><Icon name="plus" size={14} /> Ajouter une règle</button>}
            </>
          )}
        </>
      )}
    </>
  );
}

const BOUNCE_TYPES = [
  { id: 'hard', label: 'Rebond définitif', hint: 'L’adresse n’existe pas ou plus.' },
  { id: 'soft', label: 'Rebond temporaire', hint: 'Boîte pleine, serveur indisponible.' },
  { id: 'complaint', label: 'Plainte', hint: 'La personne a signalé l’e-mail comme spam.' },
] as const;

function BounceRules({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  const actions = s['bounce.actions'] ?? { hard: { count: 1, action: 'blocklist' }, soft: { count: 2, action: 'none' }, complaint: { count: 1, action: 'blocklist' } };
  return (
    <section className="panel settings-panel">
      <h2>Rebonds</h2>
      <Toggle id="bounce-on" label="Traiter les rebonds" checked={!!s['bounce.enabled']} disabled={!canEdit} onChange={(v) => set({ 'bounce.enabled': v })}
        hint="Relais compte les e-mails refusés et applique les règles ci-dessous." />
      <Toggle id="bounce-webhooks" label="Recevoir les rebonds par webhook" checked={!!s['bounce.webhooks_enabled']} disabled={!canEdit}
        onChange={(v) => set({ 'bounce.webhooks_enabled': v })}
        hint="Pour les prestataires (Amazon SES, SendGrid, Postmark…) qui signalent eux-mêmes les rebonds : voir plus bas." />
      <h3>Que faire après plusieurs rebonds</h3>
      {BOUNCE_TYPES.map((t) => (
        <div key={t.id} className="grid-2 bounce-rule">
          <Num id={`b-${t.id}-count`} label={`${t.label} : après`} unit="rebond(s)" min={1} value={actions[t.id]?.count ?? 1} disabled={!canEdit}
            onChange={(v) => set({ 'bounce.actions': { ...actions, [t.id]: { ...actions[t.id], count: v } } })} hint={t.hint} />
          <Field id={`b-${t.id}-action`} label="Action">
            <select id={`b-${t.id}-action`} value={actions[t.id]?.action ?? 'none'} disabled={!canEdit}
              onChange={(e) => set({ 'bounce.actions': { ...actions, [t.id]: { ...actions[t.id], action: e.target.value as 'none' } } })}>
              <option value="none">Ne rien faire</option>
              <option value="unsubscribe">Désinscrire de toutes les listes</option>
              <option value="blocklist">Mettre en liste noire</option>
              <option value="delete">Supprimer le contact</option>
            </select>
          </Field>
        </div>
      ))}
      <BounceMailboxes s={s} set={set} canEdit={canEdit} />
      {s['bounce.webhooks_enabled'] && <BounceWebhooks s={s} set={set} canEdit={canEdit} />}
    </section>
  );
}

const NEW_BOX: BounceBox = {
  enabled: true, type: 'pop', host: '', port: 995, auth_protocol: 'userpass', return_path: '', username: '', password: '',
  tls_enabled: true, tls_skip_verify: false, scan_interval: '15m',
};

// A POP3 mailbox where bounced e-mails land (the Return-Path address).
function BounceMailboxes({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  const boxes = s['bounce.mailboxes'] ?? [];
  const setBox = (i: number, patch: Partial<BounceBox>) => set({ 'bounce.mailboxes': boxes.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  return (
    <>
      <h3>Boîte de réception des rebonds</h3>
      <Explain title="À quoi sert cette boîte">
        <p>
          Quand une adresse n’existe pas, le serveur du destinataire renvoie un message d’erreur à l’adresse de retour (Return-Path).
          En donnant à Relais l’accès à cette boîte (POP3), il lit ces messages tous les quarts d’heure et compte les rebonds.
          Créez une adresse dédiée, par exemple rebonds@votre-domaine.fr, chez votre hébergeur.
        </p>
      </Explain>
      {boxes.map((b, i) => (
        <div key={b.uuid ?? i} className="panel nested" aria-label={`Boîte de rebonds ${i + 1}`} role="group">
          <Toggle id={`bb-on-${i}`} label="Lire cette boîte" checked={b.enabled} disabled={!canEdit} onChange={(v) => setBox(i, { enabled: v })} />
          <div className="grid-2">
            <Field id={`bb-rp-${i}`} label="Adresse de retour (Return-Path)" hint="Ajoutée aux e-mails envoyés : les rebonds y arrivent.">
              <input id={`bb-rp-${i}`} type="email" value={b.return_path} disabled={!canEdit} onChange={(e) => setBox(i, { return_path: e.target.value })} />
            </Field>
            <Field id={`bb-int-${i}`} label="Lire toutes les" hint="Par exemple 15m (15 minutes) ou 1h. Une minute au moins.">
              <input id={`bb-int-${i}`} type="text" value={b.scan_interval} disabled={!canEdit} onChange={(e) => setBox(i, { scan_interval: e.target.value })} />
            </Field>
            <Field id={`bb-host-${i}`} label="Serveur POP3" hint="Par exemple pop3.mail.ovh.net.">
              <input id={`bb-host-${i}`} type="text" className="mono" value={b.host} disabled={!canEdit} onChange={(e) => setBox(i, { host: e.target.value })} />
            </Field>
            <Num id={`bb-port-${i}`} label="Port" value={b.port} min={1} disabled={!canEdit} onChange={(v) => setBox(i, { port: v })} hint="995 avec TLS, 110 sans." />
            <Field id={`bb-user-${i}`} label="Identifiant de la boîte">
              <input id={`bb-user-${i}`} type="text" value={b.username} disabled={!canEdit} onChange={(e) => setBox(i, { username: e.target.value })} />
            </Field>
            <Field id={`bb-pwd-${i}`} label="Mot de passe de la boîte" hint="Laissez vide pour garder le mot de passe enregistré.">
              <input id={`bb-pwd-${i}`} type="password" autoComplete="new-password" placeholder="Enregistré" value={b.password} disabled={!canEdit}
                onChange={(e) => setBox(i, { password: e.target.value })} />
            </Field>
          </div>
          <Toggle id={`bb-tls-${i}`} label="Connexion chiffrée (TLS)" checked={b.tls_enabled} disabled={!canEdit} onChange={(v) => setBox(i, { tls_enabled: v })} />
          {canEdit && boxes.length > 1 && (
            <button type="button" className="btn btn-sm btn-ghost self-start" onClick={() => set({ 'bounce.mailboxes': boxes.filter((_, j) => j !== i) })}>Retirer cette boîte</button>
          )}
        </div>
      ))}
      {canEdit && boxes.length === 0 && (
        <button type="button" className="btn btn-sm self-start" onClick={() => set({ 'bounce.mailboxes': [NEW_BOX] })}><Icon name="plus" size={14} /> Ajouter une boîte</button>
      )}
    </>
  );
}

// Providers that report bounces themselves, each on its own address.
function BounceWebhooks({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  const root = (s['app.root_url'] ?? '').replace(/\/$/, '');
  const url = (service: string) => <code className="mono small">{`${root}/webhooks/service/${service}`}</code>;
  const secret = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <Field id={id} label={label} hint="Laissez vide pour garder la valeur enregistrée.">
      <input id={id} type="password" autoComplete="new-password" placeholder="Enregistré" value={value} disabled={!canEdit} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
  const pm = s['bounce.postmark'] ?? { enabled: false, username: '', password: '' };
  const fe = s['bounce.forwardemail'] ?? { enabled: false, key: '' };
  const lm = s['bounce.lettermint'] ?? { enabled: false, key: '' };
  const az = s['bounce.azure'] ?? { enabled: false, shared_secret: '', shared_secret_header: '' };
  return (
    <>
      <h3>Rebonds signalés par le prestataire d’envoi</h3>
      <p className="small muted">Activez votre prestataire et collez l’adresse indiquée dans sa console (rubrique webhooks ou notifications).</p>
      <Toggle id="wh-ses" label="Amazon SES" checked={!!s['bounce.ses_enabled']} disabled={!canEdit} onChange={(v) => set({ 'bounce.ses_enabled': v })}
        hint={<>Notifications SNS vers {url('ses')}</>} />
      <Toggle id="wh-sendgrid" label="SendGrid" checked={!!s['bounce.sendgrid_enabled']} disabled={!canEdit} onChange={(v) => set({ 'bounce.sendgrid_enabled': v })}
        hint={<>Event Webhook vers {url('sendgrid')}</>} />
      {s['bounce.sendgrid_enabled'] && secret('wh-sendgrid-key', 'Clé de vérification SendGrid', s['bounce.sendgrid_key'] ?? '', (v) => set({ 'bounce.sendgrid_key': v }))}
      <Toggle id="wh-postmark" label="Postmark" checked={pm.enabled} disabled={!canEdit} onChange={(v) => set({ 'bounce.postmark': { ...pm, enabled: v } })}
        hint={<>Webhook de rebonds vers {url('postmark')}, avec identifiant et mot de passe.</>} />
      {pm.enabled && (
        <div className="grid-2">
          <Field id="wh-postmark-user" label="Identifiant Postmark">
            <input id="wh-postmark-user" type="text" value={pm.username} disabled={!canEdit} onChange={(e) => set({ 'bounce.postmark': { ...pm, username: e.target.value } })} />
          </Field>
          {secret('wh-postmark-pwd', 'Mot de passe Postmark', pm.password, (v) => set({ 'bounce.postmark': { ...pm, password: v } }))}
        </div>
      )}
      <Toggle id="wh-fe" label="Forward Email" checked={fe.enabled} disabled={!canEdit} onChange={(v) => set({ 'bounce.forwardemail': { ...fe, enabled: v } })}
        hint={<>Webhook vers {url('forwardemail')}</>} />
      {fe.enabled && secret('wh-fe-key', 'Clé Forward Email', fe.key, (v) => set({ 'bounce.forwardemail': { ...fe, key: v } }))}
      <Toggle id="wh-lm" label="Lettermint" checked={lm.enabled} disabled={!canEdit} onChange={(v) => set({ 'bounce.lettermint': { ...lm, enabled: v } })}
        hint={<>Webhook vers {url('lettermint')}</>} />
      {lm.enabled && secret('wh-lm-key', 'Clé Lettermint', lm.key, (v) => set({ 'bounce.lettermint': { ...lm, key: v } }))}
      <Toggle id="wh-azure" label="Azure Communication Services" checked={az.enabled} disabled={!canEdit} onChange={(v) => set({ 'bounce.azure': { ...az, enabled: v } })}
        hint={<>Event Grid vers {url('azure')}</>} />
      {az.enabled && (
        <div className="grid-2">
          <Field id="wh-azure-header" label="En-tête du secret">
            <input id="wh-azure-header" type="text" className="mono" value={az.shared_secret_header} disabled={!canEdit} onChange={(e) => set({ 'bounce.azure': { ...az, shared_secret_header: e.target.value } })} />
          </Field>
          {secret('wh-azure-secret', 'Secret partagé', az.shared_secret, (v) => set({ 'bounce.azure': { ...az, shared_secret: v } }))}
        </div>
      )}
    </>
  );
}

// Custom CSS and JavaScript of the public pages.
function Appearance({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  return (
    <section className="panel settings-panel">
      <h2>Apparence des pages publiques</h2>
      <p className="small muted">
        Pour les pages d’inscription, de désinscription, de préférences et l’archive, sur tous les projets. Le logo se règle dans Général.
      </p>
      <Field id="pub-css" label="CSS personnalisé" hint="Par exemple .button { background: #0b5; } pour la couleur des boutons.">
        <textarea id="pub-css" rows={10} className="mono code-area" spellCheck={false} value={s['appearance.public.custom_css'] ?? ''} disabled={!canEdit}
          onChange={(e) => set({ 'appearance.public.custom_css': e.target.value })} />
      </Field>
      <Field id="pub-js" label="JavaScript personnalisé" hint="Exécuté sur chaque page publique : une mesure d’audience respectueuse, par exemple. À manier avec prudence.">
        <textarea id="pub-js" rows={6} className="mono code-area" spellCheck={false} value={s['appearance.public.custom_js'] ?? ''} disabled={!canEdit}
          onChange={(e) => set({ 'appearance.public.custom_js': e.target.value })} />
      </Field>
    </section>
  );
}

// Database housekeeping and the cache of the heavy dashboard queries.
function Performance({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  const db = s['maintenance.db'] ?? { vacuum: false, vacuum_cron_interval: '0 2 * * *' };
  return (
    <section className="panel settings-panel">
      <h2>Performances</h2>
      <Explain title="Quand y toucher">
        <p>
          Rien à changer tant que l’instance a moins de quelques centaines de milliers de contacts. Au-delà, le tableau de bord et les
          compteurs des listes peuvent ralentir : la mise en cache les calcule une fois par nuit.
        </p>
        <p>Les horaires s’écrivent au format cron : <span className="mono">0 3 * * *</span> veut dire tous les jours à 3 h.</p>
      </Explain>
      <Toggle id="cache-slow" label="Mettre en cache les compteurs lents" checked={!!s['app.cache_slow_queries']} disabled={!canEdit}
        onChange={(v) => set({ 'app.cache_slow_queries': v })} hint="Les nombres de contacts et les statistiques du tableau de bord sont recalculés à l’horaire ci-dessous, pas à chaque visite." />
      {s['app.cache_slow_queries'] && (
        <Field id="cache-cron" label="Recalcul des compteurs">
          <input id="cache-cron" type="text" className="mono" value={s['app.cache_slow_queries_interval'] ?? ''} disabled={!canEdit}
            onChange={(e) => set({ 'app.cache_slow_queries_interval': e.target.value })} />
        </Field>
      )}
      <Toggle id="vacuum" label="Nettoyer la base de données régulièrement (VACUUM)" checked={db.vacuum} disabled={!canEdit}
        onChange={(v) => set({ 'maintenance.db': { ...db, vacuum: v } })} hint="Récupère la place laissée par les contacts et statistiques supprimés." />
      {db.vacuum && (
        <Field id="vacuum-cron" label="Horaire du nettoyage">
          <input id="vacuum-cron" type="text" className="mono" value={db.vacuum_cron_interval} disabled={!canEdit}
            onChange={(e) => set({ 'maintenance.db': { ...db, vacuum_cron_interval: e.target.value } })} />
        </Field>
      )}
    </section>
  );
}

const NEW_MESSENGER: Messenger = { enabled: true, name: '', root_url: '', username: '', password: '', max_conns: 5, timeout: '5s', max_msg_retries: 2 };

// Postback messengers: listmonk posts each message to an address (SMS, WhatsApp, push…).
function Messengers({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  const list = s.messengers ?? [];
  const setM = (i: number, patch: Partial<Messenger>) => set({ messengers: list.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  return (
    <section className="panel settings-panel">
      <h2>Autres canaux d’envoi</h2>
      <Explain title="À quoi ça sert">
        <p>
          En plus de l’e-mail, une campagne peut partir par un autre canal (SMS, WhatsApp, notification…) grâce à un petit service
          que vous hébergez : Relais lui envoie chaque message à son adresse, au format « postback » de listmonk, et le service
          le transmet. Sans un tel service, cet onglet ne sert pas.
        </p>
      </Explain>
      {list.map((m, i) => (
        <div key={m.uuid ?? i} className="panel nested" role="group" aria-label={`Canal ${m.name || i + 1}`}>
          <Toggle id={`ms-on-${i}`} label="Actif" checked={m.enabled} disabled={!canEdit} onChange={(v) => setM(i, { enabled: v })} />
          <div className="grid-2">
            <Field id={`ms-name-${i}`} label="Nom du canal" hint="Minuscules, chiffres et tirets, par exemple sms.">
              <input id={`ms-name-${i}`} type="text" className="mono" value={m.name} disabled={!canEdit} onChange={(e) => setM(i, { name: e.target.value })} />
            </Field>
            <Field id={`ms-url-${i}`} label="Adresse du service">
              <input id={`ms-url-${i}`} type="url" className="mono" value={m.root_url} disabled={!canEdit} onChange={(e) => setM(i, { root_url: e.target.value })} />
            </Field>
            <Field id={`ms-user-${i}`} label="Identifiant (facultatif)">
              <input id={`ms-user-${i}`} type="text" value={m.username} disabled={!canEdit} onChange={(e) => setM(i, { username: e.target.value })} />
            </Field>
            <Field id={`ms-pwd-${i}`} label="Mot de passe (facultatif)" hint="Laissez vide pour garder le mot de passe enregistré.">
              <input id={`ms-pwd-${i}`} type="password" autoComplete="new-password" placeholder="Enregistré" value={m.password} disabled={!canEdit}
                onChange={(e) => setM(i, { password: e.target.value })} />
            </Field>
            <Num id={`ms-conns-${i}`} label="Connexions en parallèle" value={m.max_conns} min={1} disabled={!canEdit} onChange={(v) => setM(i, { max_conns: v })} />
            <Num id={`ms-retries-${i}`} label="Nouvelles tentatives" value={m.max_msg_retries} disabled={!canEdit} onChange={(v) => setM(i, { max_msg_retries: v })} />
          </div>
          {canEdit && <button type="button" className="btn btn-sm btn-ghost self-start" onClick={() => set({ messengers: list.filter((_, j) => j !== i) })}>Retirer ce canal</button>}
        </div>
      ))}
      {canEdit && <button type="button" className="btn btn-sm self-start" onClick={() => set({ messengers: [...list, NEW_MESSENGER] })}><Icon name="plus" size={14} /> Ajouter un canal</button>}
    </section>
  );
}

function MediaStorage({ s, set, canEdit }: { s: SettingsData; set: Patch; canEdit: boolean }) {
  const s3 = s['upload.provider'] === 's3';
  const text = (k: keyof SettingsData, id: string, label: string, hint?: string, type = 'text') => (
    <Field id={id} label={label} hint={hint}>
      <input id={id} type={type} value={(s[k] as string) ?? ''} disabled={!canEdit} autoComplete={type === 'password' ? 'new-password' : undefined}
        placeholder={type === 'password' ? 'Enregistré' : undefined} onChange={(e) => set({ [k]: e.target.value } as Partial<SettingsData>)} />
    </Field>
  );
  return (
    <section className="panel settings-panel">
      <h2>Stockage des médias</h2>
      <Field id="upload-provider" label="Où ranger les fichiers" hint="Sur Coolify, le dossier du serveur est un volume persistant (relais-uploads).">
        <select id="upload-provider" value={s['upload.provider']} disabled={!canEdit} onChange={(e) => set({ 'upload.provider': e.target.value as 'filesystem' | 's3' })}>
          <option value="filesystem">Sur le serveur</option>
          <option value="s3">Stockage S3 (Amazon, Scaleway, Cloudflare R2…)</option>
        </select>
      </Field>
      <Field id="upload-ext" label="Types de fichiers acceptés" hint="Séparés par des virgules, par exemple jpg, png, gif, pdf.">
        <input id="upload-ext" type="text" value={(s['upload.extensions'] ?? []).join(', ')} disabled={!canEdit}
          onChange={(e) => set({ 'upload.extensions': e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
      </Field>
      {s3 ? (
        <>
          {text('upload.s3.url', 's3-url', 'Adresse du service S3', 'Par exemple https://s3.fr-par.scw.cloud')}
          <div className="grid-2">
            {text('upload.s3.bucket', 's3-bucket', 'Bucket')}
            {text('upload.s3.aws_default_region', 's3-region', 'Région')}
          </div>
          <div className="grid-2">
            {text('upload.s3.aws_access_key_id', 's3-key', 'Clé d’accès')}
            {text('upload.s3.aws_secret_access_key', 's3-secret', 'Clé secrète', 'Laissez vide pour garder la clé enregistrée.', 'password')}
          </div>
          {text('upload.s3.public_url', 's3-public', 'Adresse publique des fichiers (facultatif)', 'Si les fichiers sont servis par un autre domaine (CDN).')}
          <div className="grid-2">
            <Field id="s3-type" label="Accès au bucket">
              <select id="s3-type" value={s['upload.s3.bucket_type'] ?? 'public'} disabled={!canEdit} onChange={(e) => set({ 'upload.s3.bucket_type': e.target.value })}>
                <option value="public">Public : les fichiers ont une adresse fixe</option>
                <option value="private">Privé : adresses signées, valables un temps</option>
              </select>
            </Field>
            {s['upload.s3.bucket_type'] === 'private' && text('upload.s3.expiry', 's3-expiry', 'Validité des adresses signées', 'Par exemple 168h (7 jours). Les images des e-mails anciens ne s’affichent plus après.')}
          </div>
        </>
      ) : (
        <div className="grid-2">
          {text('upload.filesystem.upload_path', 'fs-path', 'Dossier sur le serveur')}
          {text('upload.filesystem.upload_uri', 'fs-uri', 'Adresse des fichiers', 'Le chemin web, par exemple /uploads.')}
        </div>
      )}
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
      // Saved secrets come back masked: edit them as empty fields.
      setDraft(forEditing(settings.data));
    }
  }, [settings.data, draft]);

  const dirty = useMemo(() => {
    if (!draft || !settings.data) return false;
    return JSON.stringify(forEditing(settings.data)) !== JSON.stringify(draft);
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
        <div className="row-gap">
          <Link className="btn" to="/maintenance">Maintenance et journal</Link>
        </div>
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
          {tab === 'securite' && <Security s={draft} set={set} canEdit={canEdit} />}
          {tab === 'rebonds' && <BounceRules s={draft} set={set} canEdit={canEdit} />}
          {tab === 'medias' && <MediaStorage s={draft} set={set} canEdit={canEdit} />}
          {tab === 'messagers' && <Messengers s={draft} set={set} canEdit={canEdit} />}
          {tab === 'apparence' && <Appearance s={draft} set={set} canEdit={canEdit} />}
          {tab === 'performances' && <Performance s={draft} set={set} canEdit={canEdit} />}
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
