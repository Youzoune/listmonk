import { projects, campaigns } from './data.js';
import { Icon, Logo, ProjectBadge } from './ui.jsx';
import { Home } from './views/Home.jsx';
import { Campaigns } from './views/Campaigns.jsx';
import { NewCampaign } from './views/NewCampaign.jsx';
import { Audience } from './views/Audience.jsx';
import { Relays } from './views/Relays.jsx';
import { PublicPages } from './views/PublicPages.jsx';
import { Brand } from './views/Brand.jsx';

const { useState, useEffect, useRef } = React;

const NAV = [
  { id: 'accueil', label: 'Aujourd’hui', icon: 'home' },
  { id: 'campagnes', label: 'Campagnes', icon: 'send' },
  { id: 'audience', label: 'Audience', icon: 'users' },
  { id: 'relais', label: 'Relais d’envoi', icon: 'relay' },
  { id: 'pages', label: 'Pages publiques', icon: 'page' },
];
const VIEWS = { accueil: Home, campagnes: Campaigns, nouvelle: NewCampaign, audience: Audience, relais: Relays, pages: PublicPages, marque: Brand };

function readHash() {
  const h = (location.hash || '').slice(1);
  return VIEWS[h] ? h : 'accueil';
}

function ProjectSwitcher({ project, setProject }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  return (
    <div className="switcher" ref={ref}>
      <button type="button" className="switcher-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ProjectBadge project={project} />
        <span className="switcher-text">
          <span className="sub">Projet</span>
          <span className="strong">{project.name}</span>
        </span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <ul className="switcher-menu" role="listbox" aria-label="Changer de projet">
          {projects.map((p) => {
            const n = campaigns.filter((c) => c.project === p.id && c.status === 'running').length;
            return (
              <li key={p.id}>
                <button type="button" role="option" aria-selected={p.id === project.id} onClick={() => { setProject(p); setOpen(false); }}>
                  <ProjectBadge project={p} size={24} />
                  <span className="switcher-text">
                    <span className="strong">{p.name}</span>
                    <span className="sub mono">{p.domain}</span>
                  </span>
                  {n > 0 && <span className="chip chip-run">{n} en cours</span>}
                </button>
              </li>
            );
          })}
          <li><button type="button" className="switcher-new"><Icon name="plus" size={16} /> Créer un projet</button></li>
        </ul>
      )}
    </div>
  );
}

function App() {
  const [view, setView] = useState(readHash);
  const [project, setProject] = useState(projects[0]);

  useEffect(() => {
    const onHash = () => setView(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (v) => {
    setView(v);
    try { history.replaceState(null, '', '#' + v); } catch (e) { /* not allowed in some frames */ }
    window.scrollTo({ top: 0 });
  };

  const View = VIEWS[view];
  const navId = view === 'nouvelle' ? 'campagnes' : view;

  return (
    <div className="shell" style={{ '--project': project.color }}>
      <aside className="side">
        <div className="side-top">
          <Logo />
          <span className="demo-tag">Maquette</span>
        </div>
        <ProjectSwitcher project={project} setProject={setProject} />
        <nav className="nav" aria-label="Navigation principale">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} aria-current={navId === n.id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go(n.id); }}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <a href="#marque" aria-current={view === 'marque' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('marque'); }}>
            <Icon name="brand" /> <span>Identité Relais</span>
          </a>
          <div className="me">
            <span className="avatar" aria-hidden="true">AM</span>
            <span className="switcher-text">
              <span className="strong">Ahmed</span>
              <span className="sub">Administrateur</span>
            </span>
          </div>
        </div>
      </aside>
      <main className="main">
        <p className="sample-note">Données d’exemple</p>
        <View key={`${project.id}-${view}`} project={project} go={go} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
