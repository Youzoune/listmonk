import { useState } from 'react';
import { logout, useTotp, useTotpSetup, useUpdateProfile } from '../api/hooks';
import { Chip, ErrorState, Explain, Field, Icon, Loading } from '../components/ui';
import { useProject } from '../project';

function Saved({ show, text = 'Enregistré.' }: { show: boolean; text?: string }) {
  return show ? <p className="saved small" role="status"><Icon name="check" size={14} /> {text}</p> : null;
}

function ProfileForm() {
  const { profile } = useProject();
  const save = useUpdateProfile();
  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const emailError = profile?.password_login && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Indiquez une adresse e-mail valide, par exemple vous@club.fr.' : '';
  return (
    <section className="panel list-form" aria-label="Profil">
      <h2>Profil</h2>
      <div className="grid-2">
        <Field id="me-name" label="Nom affiché">
          <input id="me-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="me-email" label="Adresse e-mail" hint={profile?.password_login ? 'Pour recevoir un lien si vous oubliez le mot de passe.' : 'Gérée par votre fournisseur de connexion.'}>
          <input id="me-email" type="email" value={email} disabled={!profile?.password_login} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      <p className="small muted">Identifiant de connexion : <span className="mono">{profile?.username}</span> · rôle {profile?.user_role.name}</p>
      {emailError && <p className="field-error">{emailError}</p>}
      {save.isError && <ErrorState error={save.error} />}
      <div className="row-gap end">
        <Saved show={save.isSuccess} />
        <button type="button" className="btn btn-dark" disabled={save.isPending || !!emailError}
          onClick={() => save.mutate({ name: name.trim(), email: email.trim() })}>Enregistrer</button>
      </div>
    </section>
  );
}

function PasswordForm() {
  const { profile } = useProject();
  const save = useUpdateProfile();
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const error = pwd.length < 8 ? 'Au moins 8 caractères.' : pwd !== pwd2 ? 'Les deux mots de passe ne sont pas identiques.' : '';
  if (!profile?.password_login) return null;
  return (
    <section className="panel list-form" aria-label="Mot de passe">
      <h2>Mot de passe</h2>
      <div className="grid-2">
        <Field id="me-pwd" label="Nouveau mot de passe">
          <input id="me-pwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>
        <Field id="me-pwd2" label="Répétez le mot de passe">
          <input id="me-pwd2" type="password" autoComplete="new-password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
        </Field>
      </div>
      <p className="small muted">Vos autres sessions ouvertes (autres navigateurs, autres appareils) seront déconnectées.</p>
      {submitted && error && <p className="field-error">{error}</p>}
      {save.isError && <ErrorState error={save.error} />}
      <div className="row-gap end">
        <Saved show={save.isSuccess} text="Mot de passe changé." />
        <button type="button" className="btn btn-dark" disabled={save.isPending} onClick={() => {
          setSubmitted(true);
          if (error) return;
          save.mutate({ name: profile.name, email: profile.email ?? '', password: pwd }, { onSuccess: () => { setPwd(''); setPwd2(''); setSubmitted(false); } });
        }}>Changer le mot de passe</button>
      </div>
    </section>
  );
}

function TwoFactor() {
  const { profile } = useProject();
  const on = profile?.twofa_type === 'totp';
  const [setting, setSetting] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const setup = useTotpSetup(profile?.id, setting && !on);
  const { enable, disable } = useTotp(profile?.id);
  if (!profile?.password_login) return null;

  return (
    <section className="panel list-form" aria-label="Double authentification">
      <div className="panel-head">
        <h2>Double authentification</h2>
        {on ? <Chip tone="ok" icon="shield">Activée</Chip> : <Chip tone="neutral">Désactivée</Chip>}
      </div>
      <p className="small muted">
        En plus du mot de passe, un code à 6 chiffres donné par une application (Google Authenticator, Microsoft Authenticator,
        1Password, Bitwarden…) est demandé à chaque connexion. Un mot de passe volé ne suffit plus pour entrer.
      </p>

      {on ? (
        <>
          <Field id="me-2fa-pwd" label="Mot de passe actuel" hint="Pour désactiver la double authentification.">
            <input id="me-2fa-pwd" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {disable.isError && <ErrorState error={disable.error} />}
          <div className="row-gap end">
            <button type="button" className="btn btn-danger" disabled={disable.isPending || password.length < 8}
              onClick={() => disable.mutate(password, { onSuccess: () => setPassword('') })}>Désactiver</button>
          </div>
        </>
      ) : !setting ? (
        <div className="row-gap">
          <button type="button" className="btn btn-primary" onClick={() => setSetting(true)}><Icon name="shield" /> Activer</button>
        </div>
      ) : setup.isPending ? <Loading /> : setup.isError ? <ErrorState error={setup.error} /> : (
        <>
          <ol className="steps-list">
            <li>Dans l’application d’authentification, ajoutez un compte en scannant ce code.</li>
            <li>Saisissez le code à 6 chiffres qu’elle affiche.</li>
          </ol>
          <div className="totp-setup">
            <img src={`data:image/png;base64,${setup.data.qr}`} alt="Code QR à scanner" width={180} height={180} />
            <div className="totp-side">
              <p className="small muted">Impossible de scanner ? Saisissez cette clé à la main :</p>
              <p className="mono totp-secret">{setup.data.secret}</p>
              <Field id="me-2fa-code" label="Code à 6 chiffres">
                <input id="me-2fa-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="mono"
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
          </div>
          {enable.isError && <ErrorState error={enable.error} />}
          <div className="row-gap end">
            <button type="button" className="btn btn-ghost" onClick={() => { setSetting(false); setCode(''); }}>Annuler</button>
            <button type="button" className="btn btn-dark" disabled={enable.isPending || code.length !== 6}
              onClick={() => enable.mutate({ secret: setup.data.secret, code }, { onSuccess: () => { setSetting(false); setCode(''); } })}>Activer</button>
          </div>
        </>
      )}
    </section>
  );
}

export function Account() {
  const { profile } = useProject();
  if (!profile) return <div className="view"><Loading /></div>;
  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Moi</p>
          <h1>Mon compte</h1>
        </div>
        <button type="button" className="btn" onClick={() => logout()}><Icon name="out" /> Se déconnecter</button>
      </header>
      {profile.type === 'api' && (
        <Explain title="Compte d’accès API">
          <p>Ce compte sert aux programmes qui utilisent l’API : il n’a ni mot de passe ni double authentification.</p>
        </Explain>
      )}
      <ProfileForm />
      <PasswordForm />
      <TwoFactor />
    </div>
  );
}
