import { lists } from '../data.js';
import { Icon, ProjectBadge } from '../ui.jsx';

const { useState } = React;

export function PublicPages({ project }) {
  const pl = lists.filter((l) => l.project === project.id);
  const [subs, setSubs] = useState(Object.fromEntries(pl.map((l, i) => [l.id, i === 0])));
  const [done, setDone] = useState(false);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>Pages publiques</h1>
        </div>
      </header>

      <div className="public-layout">
        <section className="panel">
          <h2>Ce que voit un contact</h2>
          <p className="muted">Chaque projet a ses propres pages, sur son domaine, à ses couleurs. Un contact ne voit que les listes du projet qui lui a écrit.</p>
          <dl className="facts">
            <div><dt>Domaine</dt><dd className="mono">{project.domain}</dd></div>
            <div><dt>Expéditeur</dt><dd>{project.from}</dd></div>
            <div><dt>« Se désinscrire de tout »</dt><dd>Concerne {project.name} seulement</dd></div>
            <div><dt>En-tête List-Unsubscribe</dt><dd>Désinscription en un clic dans Gmail et Outlook</dd></div>
          </dl>
          <button type="button" className="btn" onClick={() => setDone(false)}>Revoir la page depuis le début</button>
        </section>

        <div className="phone" aria-label={`Aperçu mobile de la page de désinscription de ${project.name}`}>
          <div className="phone-url mono">{project.domain}/preferences</div>
          <div className="phone-body">
            <div className="pub-brand">
              <ProjectBadge project={project} size={36} />
              <span className="strong">{project.name}</span>
            </div>
            {done ? (
              <div className="pub-done">
                <Icon name="check" size={28} />
                <h2>C’est noté</h2>
                <p>Vous ne recevrez plus que les e-mails que vous avez gardés. Vous pouvez revenir sur ce choix à tout moment depuis ce lien.</p>
              </div>
            ) : (
              <>
                <h2>Vos e-mails de {project.name}</h2>
                <p className="small">Choisissez ce que vous voulez continuer à recevoir.</p>
                <div className="pub-lists">
                  {pl.map((l) => (
                    <label key={l.id} htmlFor={`pub-${l.id}`} className="pub-list">
                      <input id={`pub-${l.id}`} type="checkbox" checked={subs[l.id]} onChange={(e) => setSubs({ ...subs, [l.id]: e.target.checked })} />
                      <span>{l.name}</span>
                    </label>
                  ))}
                </div>
                <button type="button" className="pub-btn" onClick={() => setDone(true)}>Enregistrer mes choix</button>
                <button type="button" className="pub-link" onClick={() => { setSubs(Object.fromEntries(pl.map((l) => [l.id, false]))); setDone(true); }}>
                  Ne plus rien recevoir de {project.name}
                </button>
              </>
            )}
            <p className="pub-foot">Vos données restent chez {project.name}. Vous pouvez demander leur export ou leur suppression.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
