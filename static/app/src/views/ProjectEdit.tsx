import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useDeleteProject, useSaveProject, useServerConfig, useSetUserProjects, useUsers, useUsersProjects } from '../api/hooks';
import type { Project, User } from '../api/types';
import { Chip, ErrorState, Explain, Field, Icon, Loading, ProjectBadge } from '../components/ui';
import { count } from '../lib/format';
import { hasAllProjects, isValidDomain, isValidSlug, publicURLs, rootHost, slugify, toggleId } from '../lib/projects';
import { useProject } from '../project';

const DEFAULT_PROJECT_ID = 1;

function ProjectForm({ project, onSaved }: { project?: Project; onSaved: (p: Project) => void }) {
  const save = useSaveProject();
  const [name, setName] = useState(project?.name ?? '');
  const [slug, setSlug] = useState(project?.slug ?? '');
  // The slug follows the name until someone edits it by hand.
  const [slugTouched, setSlugTouched] = useState(Boolean(project));
  const [domain, setDomain] = useState(project?.domain ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [submitted, setSubmitted] = useState(false);

  const shownSlug = slugTouched ? slug : slugify(name);
  const errors = {
    name: name.trim() === '' ? 'Donnez un nom au projet.' : '',
    slug: !isValidSlug(shownSlug) ? 'Minuscules, chiffres et tirets, 64 caractères au plus.' : '',
    domain: !isValidDomain(domain) ? 'Un nom d’hôte comme newsletter.exemple.fr, sans http://.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    save.mutate(
      {
        id: project?.id,
        project: { name: name.trim(), slug: shownSlug, domain: domain.trim().toLowerCase() || null, description: description.trim() },
      },
      { onSuccess: onSaved },
    );
  };

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>{project ? 'Réglages' : 'Le projet'}</h2>
      <Field id="p-name" label="Nom">
        <input id="p-name" type="text" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && !!errors.name} placeholder="WeSportive" />
      </Field>
      {submitted && errors.name && <p className="field-error">{errors.name}</p>}

      <Field id="p-slug" label="Identifiant" hint="Utilisé dans l’en-tête X-Listmonk-Project des intégrations. Le changer casse les intégrations qui l’utilisent.">
        <input id="p-slug" type="text" className="mono" value={shownSlug}
          onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} aria-invalid={submitted && !!errors.slug} />
      </Field>
      {submitted && errors.slug && <p className="field-error">{errors.slug}</p>}

      <Field id="p-domain" label="Domaine (facultatif)" hint="Le domaine des pages publiques du projet (inscription, préférences, désinscription, archive) et des liens de ses e-mails.">
        <input id="p-domain" type="text" className="mono" value={domain} onChange={(e) => setDomain(e.target.value)}
          placeholder="newsletter.exemple.fr" aria-invalid={submitted && !!errors.domain} />
      </Field>
      {submitted && errors.domain && <p className="field-error">{errors.domain}</p>}

      <Field id="p-desc" label="Description (facultatif)">
        <textarea id="p-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      {save.isError && <ErrorState error={save.error} />}
      {project && save.isSuccess && (
        <p className="saved" role="status"><Icon name="check" size={16} /> Modifications enregistrées.</p>
      )}
      <div className="row-gap">
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Enregistrement…' : project ? 'Enregistrer' : 'Créer le projet'}
        </button>
      </div>
    </form>
  );
}

function PublicPages({ project }: { project: Project }) {
  const { project: current } = useProject();
  const config = useServerConfig(current.id);
  if (!config.data) return null;

  const urls = publicURLs(project, config.data.root_url);
  const target = rootHost(config.data.root_url);
  const links: [string, string][] = [
    ['Formulaire d’inscription', urls.form],
    ['Archive des campagnes', urls.archive],
    ['Flux RSS de l’archive', urls.feed],
  ];

  return (
    <section className="panel public-pages">
      <h2>Pages publiques</h2>
      <p className="small">
        {urls.ownDomain
          ? <>Les pages publiques de « {project.name} » sont servies sur <span className="mono strong">{project.domain}</span>, à son nom. Les liens de ses e-mails (désinscription, préférences, lecture en ligne, suivi des clics) pointent aussi vers ce domaine.</>
          : <>Sans domaine, les pages publiques de « {project.name} » utilisent l’adresse principale de l’instance. Ajoutez un domaine dans les réglages pour qu’elles soient à son nom.</>}
      </p>
      <dl className="url-list">
        {links.map(([label, url]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd><a className="link mono" href={url} target="_blank" rel="noreferrer">{url}</a></dd>
          </div>
        ))}
      </dl>
      <p className="small muted">
        Un contact qui se désinscrit ne quitte que les listes de ce projet. Inscrit avec la même adresse dans un autre projet, il y reste.
      </p>
      {urls.ownDomain && (
        <Explain title="Brancher le domaine, étape par étape">
          <ol className="steps-list">
            <li>Chez le gestionnaire du domaine (OVHcloud, Gandi, Cloudflare…), créez un enregistrement <span className="strong">CNAME</span> : <span className="mono">{project.domain}</span> → <span className="mono">{target || 'l’adresse du serveur Relais'}</span>.</li>
            <li>Sur le serveur, ajoutez le domaine au proxy qui sert Relais (Caddy, Nginx, Traefik…) avec un certificat HTTPS, par exemple Let’s Encrypt.</li>
            <li>Ouvrez le formulaire d’inscription ci-dessus : il doit s’afficher avec le nom du projet.</li>
          </ol>
          <p>Tant que le domaine n’est pas branché, les liens des e-mails de ce projet ne fonctionnent pas : branchez-le avant d’envoyer une campagne.</p>
        </Explain>
      )}
    </section>
  );
}

function Access({ project }: { project: Project }) {
  const { can, profile } = useProject();
  const canRead = can('users:get');
  const canEdit = can('users:manage');
  const users = useUsers(canRead);
  const ids = (users.data ?? []).filter((u) => !hasAllProjects(u.user_role)).map((u) => u.id);
  const access = useUsersProjects(ids, canRead);
  const setAccess = useSetUserProjects();
  // Choices shown right away while they're being saved.
  const [pending, setPending] = useState<Record<number, boolean>>({});

  if (!canRead) return null;

  const toggle = (u: User, on: boolean) => {
    const current = access.data?.[u.id] ?? [];
    setPending((p) => ({ ...p, [u.id]: on }));
    setAccess.mutate(
      { userId: u.id, projectIds: toggleId(current, project.id, on) },
      { onSettled: () => setPending(({ [u.id]: _done, ...rest }) => rest) },
    );
  };

  return (
    <section className="panel">
      <h2>Accès de l’équipe</h2>
      <p className="muted small">Qui peut ouvrir ce projet. Les super admins et les personnes qui gèrent les projets voient tous les projets.</p>
      {users.isPending || (access.isPending && ids.length > 0) ? <Loading /> : users.isError ? <ErrorState error={users.error} /> : (
        <ul className="access-list">
          {users.data.map((u) => {
            const all = hasAllProjects(u.user_role);
            const on = all || (pending[u.id] ?? (access.data?.[u.id] ?? []).includes(project.id));
            const isMe = u.id === profile?.id;
            return (
              <li key={u.id}>
                <label htmlFor={`acc-${u.id}`} className="access-row">
                  <input id={`acc-${u.id}`} type="checkbox" checked={on}
                    disabled={all || !canEdit} onChange={(e) => toggle(u, e.target.checked)} />
                  <span className="access-who">
                    <span className="strong">{u.name || u.username}{isMe ? ' (vous)' : ''}</span>
                    <span className="sub">{u.type === 'api' ? 'Accès API' : u.email} · {u.user_role.name}</span>
                  </span>
                  {all ? <Chip tone="info">Tous les projets</Chip> : on ? <Chip tone="ok" icon="check">A accès</Chip> : <Chip tone="neutral">Pas d’accès</Chip>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {setAccess.isError && <ErrorState error={setAccess.error} />}
    </section>
  );
}

function DangerZone({ project }: { project: Project }) {
  const { project: current, setProject } = useProject();
  const del = useDeleteProject();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const isDefault = project.id === DEFAULT_PROJECT_ID;

  const remove = () => del.mutate(project.id, {
    onSuccess: () => {
      if (current.id === project.id) setProject(DEFAULT_PROJECT_ID);
      navigate('/projets', { state: { deleted: project.name } });
    },
  });

  return (
    <section className="panel danger-zone">
      <h2>Supprimer le projet</h2>
      {isDefault ? (
        <p className="muted small">Le projet par défaut ne peut pas être supprimé.</p>
      ) : (
        <>
          <p className="muted small">
            Seul un projet vide peut être supprimé : sans listes, contacts, campagnes ni médias. Ses modèles
            d’e-mail sont supprimés avec lui.
            Ce projet a {count(project.list_count, 'liste')} et {count(project.campaign_count, 'campagne')}.
          </p>
          {del.isError && <ErrorState error={del.error} />}
          {confirming ? (
            <div className="row-gap">
              <button type="button" className="btn btn-danger" onClick={remove} disabled={del.isPending}>
                {del.isPending ? 'Suppression…' : `Supprimer « ${project.name} » définitivement`}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>Annuler</button>
            </div>
          ) : (
            <div className="row-gap">
              <button type="button" className="btn" onClick={() => setConfirming(true)}>Supprimer le projet…</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function ProjectEdit() {
  const { id } = useParams();
  const isNew = id === undefined;
  const { projects, setProject, project: current } = useProject();
  const navigate = useNavigate();
  const flash = useLocation().state as { created?: boolean } | null;
  const project = isNew ? undefined : projects.find((p) => p.id === Number(id));

  // Projects load with the profile; wait for them before saying a project doesn't exist.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <Link className="link back" to="/projets"><Icon name="back" size={15} /> Projets</Link>
          <h1 className="with-badge">
            {project && <ProjectBadge id={project.id} name={project.name} size={36} />}
            {isNew ? 'Nouveau projet' : project?.name ?? 'Projet'}
          </h1>
        </div>
        {project && project.id !== current.id && (
          <button type="button" className="btn btn-dark" onClick={() => { setProject(project.id); navigate('/'); }}>Ouvrir ce projet</button>
        )}
      </header>

      {flash?.created && project && (
        <div className="alert alert-ok" role="status">
          <Icon name="check" />
          <p>« {project.name} » est créé avec un modèle d’e-mail par défaut. Donnez-y accès à l’équipe ci-dessous, puis ouvrez-le pour créer ses listes.</p>
        </div>
      )}

      {isNew ? (
        <ProjectForm onSaved={(p) => navigate(`/projets/${p.id}`, { state: { created: true } })} />
      ) : !project ? (
        waited ? <p className="muted">Ce projet n’existe pas, ou vous n’y avez pas accès.</p> : <Loading />
      ) : (
        <div className="grid-2 align-start">
          <ProjectForm key={project.id} project={project} onSaved={() => undefined} />
          <div className="stack">
            <PublicPages project={project} />
            <Access project={project} />
            <DangerZone project={project} />
          </div>
        </div>
      )}
    </div>
  );
}
