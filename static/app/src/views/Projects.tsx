import { Link, useLocation, useNavigate } from 'react-router';
import { Chip, Icon, ProjectBadge } from '../components/ui';
import { count } from '../lib/format';
import { useProject } from '../project';

export function Projects() {
  const { projects, project: current, setProject, can } = useProject();
  const navigate = useNavigate();
  const canManage = can('projects:manage');
  const deleted = (useLocation().state as { deleted?: string } | null)?.deleted;

  const open = (id: number) => {
    setProject(id);
    navigate('/');
  };

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Espace de travail</p>
          <h1>Projets</h1>
        </div>
        {canManage && <Link className="btn btn-primary" to="/projets/nouveau"><Icon name="plus" /> Nouveau projet</Link>}
      </header>

      {deleted && (
        <div className="alert alert-ok" role="status">
          <Icon name="check" />
          <p>« {deleted} » est supprimé.</p>
        </div>
      )}

      <p className="muted lead">
        Chaque projet a ses propres listes, contacts, campagnes, modèles et relais. Rien n’est partagé d’un projet à l’autre.
      </p>

      <ul className="project-grid">
        {projects.map((p) => (
          <li key={p.id} className={`panel project-card ${p.id === current.id ? 'is-current' : ''}`}>
            <div className="project-card-head">
              <ProjectBadge id={p.id} name={p.name} size={40} />
              <div className="project-card-title">
                <h2>{p.name}</h2>
                <span className="sub mono">{p.slug}</span>
              </div>
              {p.id === current.id && <Chip tone="brand">Projet ouvert</Chip>}
            </div>
            <dl className="facts facts-row">
              <div><dt>Domaine</dt><dd className={p.domain ? 'mono' : 'muted'}>{p.domain || 'Pas encore de domaine'}</dd></div>
              <div><dt>Contenu</dt><dd>{count(p.list_count, 'liste')}, {count(p.campaign_count, 'campagne')}</dd></div>
            </dl>
            {p.description && <p className="small muted">{p.description}</p>}
            <div className="row-gap">
              {p.id !== current.id && (
                <button type="button" className="btn btn-dark btn-sm" onClick={() => open(p.id)}>Ouvrir ce projet</button>
              )}
              {canManage && <Link className="btn btn-sm" to={`/projets/${p.id}`}>Réglages et accès</Link>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
