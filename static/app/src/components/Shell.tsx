import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { logout } from '../api/hooks';
import { useProject } from '../project';
import { Icon, Logo, ProjectBadge, type IconName } from './ui';

// `also`: the other screens of the section, which light up its entry.
const NAV: { to: string; label: string; icon: IconName; perms?: string[]; also?: string[] }[] = [
  { to: '/', label: 'Aujourd’hui', icon: 'home' },
  { to: '/campagnes', label: 'Campagnes', icon: 'send', perms: ['campaigns:get_all', 'campaigns:get'] },
  { to: '/audience', label: 'Audience', icon: 'users', perms: ['subscribers:get_all', 'subscribers:get'], also: ['/listes', '/rebonds', '/formulaire'] },
  { to: '/modeles', label: 'Modèles', icon: 'page', perms: ['templates:get'] },
  { to: '/medias', label: 'Médias', icon: 'layers', perms: ['media:get'] },
  { to: '/relais', label: 'Relais d’envoi', icon: 'relay', perms: ['settings:get'] },
  { to: '/projets', label: 'Projets', icon: 'layers', perms: ['projects:get', 'projects:manage'] },
  { to: '/equipe', label: 'Équipe', icon: 'users', perms: ['users:get'] },
  { to: '/reglages', label: 'Réglages', icon: 'gear', perms: ['settings:get'], also: ['/maintenance'] },
];

const under = (path: string, to: string) => path === to || path.startsWith(`${to}/`);

function isActive(path: string, n: (typeof NAV)[number]) {
  if (n.to === '/') return path === '/';
  return under(path, n.to) || (n.also ?? []).some((a) => under(path, a));
}

function ProjectSwitcher() {
  const { projects, project, setProject, can } = useProject();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  return (
    <div className="switcher" ref={ref}>
      <button type="button" className="switcher-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ProjectBadge id={project.id} name={project.name} />
        <span className="switcher-text">
          <span className="sub">Projet</span>
          <span className="strong">{project.name}</span>
        </span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <ul className="switcher-menu" role="listbox" aria-label="Changer de projet">
          {projects.map((p) => (
            <li key={p.id}>
              <button type="button" role="option" aria-selected={p.id === project.id} onClick={() => { setProject(p.id); setOpen(false); }}>
                <ProjectBadge id={p.id} name={p.name} size={24} />
                <span className="switcher-text">
                  <span className="strong">{p.name}</span>
                  <span className="sub mono">{p.domain || p.slug}</span>
                </span>
                <span className="sub num">{p.campaign_count} camp.</span>
              </button>
            </li>
          ))}
          {can('projects:get', 'projects:manage') && (
            <li className="switcher-foot">
              <Link to="/projets" onClick={() => setOpen(false)}>Tous les projets</Link>
              {can('projects:manage') && (
                <Link to="/projets/nouveau" onClick={() => setOpen(false)}><Icon name="plus" size={15} /> Créer un projet</Link>
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function Shell() {
  const { profile, can } = useProject();
  const { pathname } = useLocation();
  const name = profile?.name || profile?.username || '';

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-top">
          <Logo />
        </div>
        <ProjectSwitcher />
        <nav className="nav" aria-label="Navigation principale">
          {NAV.filter((n) => !n.perms || can(...n.perms)).map((n) => (
            <Link key={n.to} to={n.to} aria-current={isActive(pathname, n) ? 'page' : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <NavLink to="/guide"><Icon name="book" /> <span>Guide de l’envoi</span></NavLink>
          <NavLink to="/marque"><Icon name="brand" /> <span>Identité Relais</span></NavLink>
          <div className="me">
            <NavLink to="/compte" className="me-link" aria-label={`Mon compte (${name})`}>
              <span className="avatar" aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
              <span className="switcher-text">
                <span className="strong">{name}</span>
                <span className="sub">{profile?.user_role.name}</span>
              </span>
            </NavLink>
            <button type="button" className="btn btn-sm btn-ghost me-out" aria-label="Se déconnecter" title="Se déconnecter" onClick={() => logout()}>
              <Icon name="out" size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main" id="main">
        <Outlet />
      </main>
    </div>
  );
}
