import { LogoMark } from '../components/ui';

const COLORS = [
  { token: '--brand', name: 'Jaune signal', use: 'Logo, bouton principal, jour en cours du warm-up' },
  { token: '--fg', name: 'Encre', use: 'Texte, bouton secondaire, texte sur jaune' },
  { token: '--bg', name: 'Bitume clair', use: 'Fond de l’application' },
  { token: '--surface', name: 'Papier', use: 'Panneaux et tableaux' },
  { token: '--run', name: 'Bleu envoi', use: 'Campagne en cours' },
  { token: '--ok', name: 'Vert livré', use: 'Terminé, relais actif' },
  { token: '--warn', name: 'Ambre pause', use: 'En pause, à vérifier' },
  { token: '--bad', name: 'Rouge rebond', use: 'Rebonds, erreurs' },
];

export function Brand() {
  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Identité</p>
          <h1>Relais</h1>
        </div>
      </header>

      <section className="brand-hero panel">
        <div className="brand-lockup">
          <LogoMark size={88} />
          <span className="brand-word">relais</span>
        </div>
        <div className="brand-text">
          <p className="brand-tagline">La prospection e-mail de plusieurs projets, chacun à son rythme.</p>
          <p className="muted">Un relais, c’est le serveur qui transmet vos e-mails, et c’est aussi le passage de témoin d’une course. Le logo montre les deux : une rampe qui monte comme un warm-up, puis la flèche qui passe le relais au jour suivant.</p>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>Couleurs</h2>
          <ul className="swatches">
            {COLORS.map((c) => (
              <li key={c.token}>
                <span className="swatch" style={{ background: `var(${c.token})` }} aria-hidden="true" />
                <span>
                  <span className="strong">{c.name}</span>
                  <span className="sub">{c.use}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Typographie</h2>
          <div className="type-specimen">
            <p className="type-display">Bricolage Grotesque</p>
            <p className="sub">Titres et chiffres clés. Une grotesque un peu brute, qui évite l’air de logiciel générique.</p>
            <p className="type-body">Instrument Sans pour l’interface : lisible à 14 px, chiffres tabulaires dans les tableaux.</p>
            <p className="type-mono mono">JetBrains Mono · smtp-relay.brevo.com · {'{prénom}'}</p>
            <p className="sub">Pour ce qui est technique : hôtes, adresses, variables.</p>
          </div>
          <h2>Ton</h2>
          <ul className="tone">
            <li>On parle comme l’utilisateur : « relais », « contacts », « warm-up », pas « messenger » ni « SMTP backend ».</li>
            <li>Chaque chiffre dit ce qu’il implique : « fin estimée jeudi vers 15 h » plutôt qu’un débit brut.</li>
            <li>En français d’abord, sans jargon de développeur sur les écrans courants.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
