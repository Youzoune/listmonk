import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLists, useServerConfig } from '../api/hooks';
import { ErrorState, Explain, Field, Icon, Loading } from '../components/ui';
import { signupFormHTML } from '../lib/forms';
import { publicURLs } from '../lib/projects';
import { useProject } from '../project';

// Generates the signup form to paste on the project's website.
export function SignupForm() {
  const { project } = useProject();
  const lists = useLists(project.id);
  const config = useServerConfig(project.id);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [redirect, setRedirect] = useState('');
  const [copied, setCopied] = useState(false);

  const publicLists = (lists.data?.results ?? []).filter((l) => l.type === 'public' && l.status === 'active');
  const chosen = picked ?? publicLists.map((l) => l.uuid);
  const urls = config.data ? publicURLs(project, config.data.root_url, config.data.projects_domain) : null;
  const sub = config.data?.public_subscription;
  const html = useMemo(() => (urls ? signupFormHTML({
    root: urls.root,
    lists: publicLists.filter((l) => chosen.includes(l.uuid)),
    redirect: redirect.trim() || undefined,
    captcha: sub?.captcha_enabled && sub.captcha_provider ? { provider: sub.captcha_provider as 'altcha' | 'hcaptcha', key: sub.captcha_key ?? undefined } : null,
  }) : ''), [urls, publicLists, chosen, redirect, sub]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* select the code by hand */ }
  };

  if (lists.isPending || config.isPending) return <div className="view"><Loading /></div>;
  if (lists.isError) return <div className="view"><ErrorState error={lists.error} /></div>;

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <Link className="link back" to="/listes"><Icon name="back" size={15} /> Listes</Link>
          <h1>Formulaire d’inscription</h1>
          <p className="sub">{project.name}</p>
        </div>
        {urls && <a className="btn" href={urls.form} target="_blank" rel="noreferrer">Voir la page d’inscription hébergée</a>}
      </header>

      <Explain title="Deux façons de faire inscrire des contacts">
        <p>
          La <span className="strong">page d’inscription hébergée</span> est prête à l’emploi : partagez simplement son adresse. Pour un formulaire
          dans votre propre site, copiez le code ci-dessous et collez-le dans une page (bloc « HTML personnalisé » de WordPress, Wix, Webflow…).
        </p>
      </Explain>

      {publicLists.length === 0 ? (
        <p className="panel muted">Aucune liste publique dans ce projet. <Link className="link" to="/listes">Rendez une liste publique</Link> pour qu’on puisse s’y inscrire.</p>
      ) : (
        <div className="tpl-layout">
          <section className="panel tpl-form">
            <h2>Listes proposées</h2>
            <ul className="check-list">
              {publicLists.map((l) => (
                <li key={l.id}>
                  <label className="switch" htmlFor={`f-${l.id}`}>
                    <input id={`f-${l.id}`} type="checkbox" checked={chosen.includes(l.uuid)}
                      onChange={(e) => setPicked(e.target.checked ? [...chosen, l.uuid] : chosen.filter((x) => x !== l.uuid))} />
                    <span>{l.name}{l.optin === 'double' && <span className="sub"> double confirmation</span>}</span>
                  </label>
                </li>
              ))}
            </ul>
            <Field id="f-next" label="Page après l’inscription (facultatif)" hint="Une page de remerciement de votre site. Son adresse doit figurer dans les adresses de confiance (Réglages › Sécurité).">
              <input id="f-next" type="url" placeholder="https://monsite.fr/merci" value={redirect} onChange={(e) => setRedirect(e.target.value)} />
            </Field>
            <div className="panel-head">
              <h2>Code à coller</h2>
              <button type="button" className="btn btn-sm" onClick={copy}>{copied ? 'Copié' : 'Copier le code'}</button>
            </div>
            <textarea className="mono code-area" readOnly rows={14} value={html} aria-label="Code HTML du formulaire" onFocus={(e) => e.target.select()} />
          </section>
          <section className="panel tpl-side">
            <h2>Aperçu</h2>
            <div className="tpl-preview"><iframe title="Aperçu du formulaire" sandbox="" srcDoc={`<body style="font-family:system-ui;padding:16px">${html}</body>`} /></div>
          </section>
        </div>
      )}
    </div>
  );
}
