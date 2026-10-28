import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useDeleteRole, useDeleteUser, useLists, useRoles, useSaveListRole, useSaveRole, useSaveUser, useServerConfig, useUsersFull } from '../api/hooks';
import type { ListRole, Role, UserFull, UserInput } from '../api/types';
import { Chip, ErrorState, Explain, Field, Icon, Loading } from '../components/ui';
import { dateTime } from '../lib/format';
import { groupLabel, listAccess, permissionLabel, setListAccess, type ListAccess, type ListGrant, type PermissionGroup } from '../lib/permissions';
import { useProject } from '../project';

const USERNAME_RE = /^[a-zA-Z0-9_\-.@]+$/;

function UserForm({ user, roles, listRoles, onDone }: { user?: UserFull; roles: Role[]; listRoles: ListRole[]; onDone: () => void }) {
  const save = useSaveUser();
  const [form, setForm] = useState<UserInput>(user ? {
    username: user.username, name: user.name, email: user.email ?? '', type: user.type, status: user.status,
    password_login: user.password_login, password: '', user_role_id: user.user_role.id, list_role_id: user.list_role?.id ?? null,
  } : { username: '', name: '', email: '', type: 'user', status: 'enabled', password_login: true, password: '', user_role_id: roles[0]?.id ?? 0, list_role_id: null });
  const [submitted, setSubmitted] = useState(false);
  const [token, setToken] = useState('');
  const set = (patch: Partial<UserInput>) => setForm({ ...form, ...patch });
  const isApi = form.type === 'api';
  const errors = {
    username: form.username.trim().length < 3 || !USERNAME_RE.test(form.username.trim()) ? 'Au moins 3 caractères : lettres, chiffres, . _ - @' : '',
    email: !isApi && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? 'Une adresse e-mail valide.' : '',
    password: !isApi && form.password_login && (!user || form.password) && form.password.length < 8 ? 'Au moins 8 caractères.' : '',
    role: !form.user_role_id ? 'Choisissez un rôle.' : '',
  };

  const submit = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    save.mutate({ id: user?.id, user: { ...form, username: form.username.trim(), email: form.email.trim() } }, {
      onSuccess: (u) => {
        // An API user's token is shown once, right after its creation.
        if (!user && isApi && u.password) setToken(u.password);
        else onDone();
      },
    });
  };

  if (token) {
    return (
      <section className="panel">
        <h2>Accès API créé</h2>
        <p className="small">Copiez ce jeton maintenant : il ne sera plus affiché. L’application s’en sert avec l’identifiant <span className="mono strong">{form.username}</span>.</p>
        <pre className="mono import-sample">{token}</pre>
        <p className="small muted">En-tête à envoyer : <span className="mono">Authorization: token {form.username}:…</span></p>
        <div className="row-gap end"><button type="button" className="btn btn-dark" onClick={onDone}>J’ai copié le jeton</button></div>
      </section>
    );
  }

  return (
    <section className="panel list-form">
      <h2>{user ? `Modifier ${user.name || user.username}` : 'Nouvel utilisateur'}</h2>
      {!user && (
        <fieldset className="radio-row">
          <legend>Type</legend>
          <label><input type="radio" name="u-type" checked={!isApi} onChange={() => set({ type: 'user' })} /> Une personne</label>
          <label><input type="radio" name="u-type" checked={isApi} onChange={() => set({ type: 'api' })} /> Un accès API (pour une autre application)</label>
        </fieldset>
      )}
      <div className="grid-2">
        <Field id="u-username" label="Identifiant">
          <input id="u-username" type="text" autoComplete="off" value={form.username} onChange={(e) => set({ username: e.target.value })} aria-invalid={submitted && !!errors.username} />
        </Field>
        <Field id="u-name" label="Nom affiché">
          <input id="u-name" type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
      </div>
      {submitted && errors.username && <p className="field-error">{errors.username}</p>}
      {!isApi && (
        <>
          <Field id="u-email" label="E-mail" hint="Pour la connexion et la réinitialisation du mot de passe.">
            <input id="u-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={submitted && !!errors.email} />
          </Field>
          {submitted && errors.email && <p className="field-error">{errors.email}</p>}
          <label className="switch" htmlFor="u-pwd-login">
            <input id="u-pwd-login" type="checkbox" checked={form.password_login} onChange={(e) => set({ password_login: e.target.checked })} />
            <span>Connexion par mot de passe</span>
          </label>
          {form.password_login && (
            <Field id="u-password" label={user ? 'Nouveau mot de passe' : 'Mot de passe'} hint={user ? 'Laissez vide pour ne pas le changer.' : 'Au moins 8 caractères. La personne pourra le changer.'}>
              <input id="u-password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} aria-invalid={submitted && !!errors.password} />
            </Field>
          )}
          {submitted && errors.password && <p className="field-error">{errors.password}</p>}
        </>
      )}
      <div className="grid-2">
        <Field id="u-role" label="Rôle" hint="Ce que l’utilisateur peut faire dans l’instance.">
          <select id="u-role" value={form.user_role_id} onChange={(e) => set({ user_role_id: Number(e.target.value) })}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field id="u-list-role" label="Rôle sur les listes (facultatif)" hint="Restreint l’accès à certaines listes seulement.">
          <select id="u-list-role" value={form.list_role_id ?? ''} onChange={(e) => set({ list_role_id: Number(e.target.value) || null })}>
            <option value="">Toutes les listes permises par le rôle</option>
            {listRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      </div>
      <label className="switch" htmlFor="u-enabled">
        <input id="u-enabled" type="checkbox" checked={form.status === 'enabled'} onChange={(e) => set({ status: e.target.checked ? 'enabled' : 'disabled' })} />
        <span>Compte actif</span>
      </label>
      {save.isError && <ErrorState error={save.error} />}
      <div className="row-gap end">
        <button type="button" className="btn btn-ghost" onClick={onDone}>Annuler</button>
        <button type="button" className="btn btn-dark" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Enregistrement…' : user ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </section>
  );
}

function RoleForm({ role, groups, onDone }: { role?: Role; groups: PermissionGroup[]; onDone: () => void }) {
  const save = useSaveRole();
  const [name, setName] = useState(role?.name ?? '');
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? []);
  const toggle = (p: string, on: boolean) => setPerms(on ? [...perms, p] : perms.filter((x) => x !== p));
  return (
    <section className="panel list-form">
      <h2>{role ? `Rôle « ${role.name} »` : 'Nouveau rôle'}</h2>
      <Field id="r-name" label="Nom du rôle">
        <input id="r-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="perm-grid">
        {groups.map((g) => (
          <fieldset key={g.group} className="perm-group">
            <legend>{groupLabel(g.group)}</legend>
            {g.permissions.map((p) => (
              <label key={p} className="switch" htmlFor={`perm-${p}`}>
                <input id={`perm-${p}`} type="checkbox" checked={perms.includes(p)} onChange={(e) => toggle(p, e.target.checked)} />
                <span>{permissionLabel(p)}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      {save.isError && <ErrorState error={save.error} />}
      <div className="row-gap end">
        <button type="button" className="btn btn-ghost" onClick={onDone}>Annuler</button>
        <button type="button" className="btn btn-dark" disabled={save.isPending || !name.trim()} onClick={() => save.mutate({ id: role?.id, role: { name: name.trim(), permissions: perms } }, { onSuccess: onDone })}>
          {save.isPending ? 'Enregistrement…' : role ? 'Enregistrer' : 'Créer le rôle'}
        </button>
      </div>
    </section>
  );
}

function ListRoleForm({ role, onDone }: { role?: ListRole; onDone: () => void }) {
  const { project } = useProject();
  const lists = useLists(project.id);
  const save = useSaveListRole();
  const [name, setName] = useState(role?.name ?? '');
  const [grants, setGrants] = useState<ListGrant[]>(role?.lists ?? []);
  const own = lists.data?.results ?? [];
  const others = grants.filter((g) => !own.some((l) => l.id === g.id)).length;

  return (
    <section className="panel list-form" aria-label={role ? `Rôle sur les listes ${role.name}` : 'Nouveau rôle sur les listes'}>
      <h2>{role ? `Rôle sur les listes « ${role.name} »` : 'Nouveau rôle sur les listes'}</h2>
      <Field id="lr-name" label="Nom du rôle">
        <input id="lr-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <p className="small muted">Listes du projet {project.name}{others > 0 ? ` (et ${others} liste${others > 1 ? 's' : ''} d’autres projets, conservée${others > 1 ? 's' : ''})` : ''}.</p>
      {lists.isPending ? <Loading /> : lists.isError ? <ErrorState error={lists.error} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Liste</th><th>Accès</th></tr></thead>
            <tbody>
              {own.map((l) => (
                <tr key={l.id}>
                  <td><label htmlFor={`lr-${l.id}`} className="strong">{l.name}</label></td>
                  <td>
                    <select id={`lr-${l.id}`} value={listAccess(grants, l.id)} onChange={(e) => setGrants(setListAccess(grants, l, e.target.value as ListAccess))}>
                      <option value="none">Aucun accès</option>
                      <option value="get">Voir la liste et ses contacts</option>
                      <option value="manage">Voir et gérer</option>
                    </select>
                  </td>
                </tr>
              ))}
              {own.length === 0 && <tr><td colSpan={2} className="empty">Ce projet n’a pas encore de liste.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {save.isError && <ErrorState error={save.error} />}
      <div className="row-gap end">
        <button type="button" className="btn btn-ghost" onClick={onDone}>Annuler</button>
        <button type="button" className="btn btn-dark" disabled={save.isPending || !name.trim()}
          onClick={() => save.mutate({ id: role?.id, role: { name: name.trim(), lists: grants.map((g) => ({ id: g.id, permissions: g.permissions })) } }, { onSuccess: onDone })}>
          {save.isPending ? 'Enregistrement…' : role ? 'Enregistrer' : 'Créer le rôle'}
        </button>
      </div>
    </section>
  );
}

export function Users() {
  const { project, profile, can } = useProject();
  const [params, setParams] = useSearchParams();
  const tab = params.get('onglet') === 'roles' ? 'roles' : 'users';
  const users = useUsersFull(can('users:get'));
  const roles = useRoles(can('roles:get', 'users:manage'));
  const config = useServerConfig(project.id);
  const delUser = useDeleteUser();
  const delRole = useDeleteRole();
  const [editing, setEditing] = useState<UserFull | 'new' | null>(null);
  const [editingRole, setEditingRole] = useState<Role | 'new' | null>(null);
  const [editingListRole, setEditingListRole] = useState<ListRole | 'new' | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const groups = (config.data?.permissions ?? []) as unknown as PermissionGroup[];
  const canManage = can('users:manage');

  if (!can('users:get')) return <div className="view"><h1>Équipe</h1><p className="muted">Vous n’avez pas accès aux utilisateurs.</p></div>;

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Instance</p>
          <h1>Équipe</h1>
        </div>
        {canManage && tab === 'users' && <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" /> Nouvel utilisateur</button>}
        {can('roles:manage') && tab === 'roles' && <button type="button" className="btn btn-primary" onClick={() => setEditingRole('new')}><Icon name="plus" /> Nouveau rôle</button>}
      </header>

      <div className="segmented" role="tablist" aria-label="Utilisateurs et rôles">
        <button type="button" role="tab" aria-selected={tab === 'users'} onClick={() => setParams({})}>Utilisateurs</button>
        <button type="button" role="tab" aria-selected={tab === 'roles'} onClick={() => setParams({ onglet: 'roles' })}>Rôles</button>
      </div>

      {tab === 'users' && (
        <>
          <p className="small muted">L’accès de chacun aux projets se règle dans <Link className="link" to="/projets">Projets</Link> › réglages du projet.</p>
          {editing && roles.users.data && (
            <UserForm key={editing === 'new' ? 'new' : editing.id} user={editing === 'new' ? undefined : editing} roles={roles.users.data}
              listRoles={roles.lists.data ?? []} onDone={() => setEditing(null)} />
          )}
          {users.isPending ? <Loading /> : users.isError ? <ErrorState error={users.error} /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Utilisateur</th><th>Type</th><th>Rôle</th><th>Dernière connexion</th><th className="right">Actions</th></tr></thead>
                <tbody>
                  {users.data.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <span className="strong">{u.name || u.username}</span>{u.id === profile?.id && ' (vous)'} {u.status === 'disabled' && <Chip tone="neutral">Désactivé</Chip>}
                        <span className="sub mono">{u.type === 'api' ? u.username : u.email}</span>
                      </td>
                      <td>{u.type === 'api' ? 'Accès API' : 'Personne'}</td>
                      <td>{u.user_role.name}{u.list_role && <span className="sub">{u.list_role.name}</span>}</td>
                      <td className="small muted">{u.loggedin_at ? dateTime(u.loggedin_at) : '—'}</td>
                      <td className="right">
                        {canManage && (
                          <div className="row-gap end">
                            <button type="button" className="btn btn-sm" onClick={() => setEditing(u)}>Modifier</button>
                            {u.id !== profile?.id && (confirm === `u${u.id}` ? (
                              <>
                                <button type="button" className="btn btn-sm btn-danger" onClick={() => delUser.mutate(u.id, { onSettled: () => setConfirm(null) })}>Supprimer</button>
                                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(null)}>Annuler</button>
                              </>
                            ) : <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(`u${u.id}`)}>Supprimer</button>)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {delUser.isError && <ErrorState error={delUser.error} />}
        </>
      )}

      {tab === 'roles' && (
        <>
          <Explain title="Rôles et rôles sur les listes">
            <p>
              Un <span className="strong">rôle</span> dit ce qu’un utilisateur peut faire (voir les contacts, lancer des campagnes, modifier les réglages…).
              Un <span className="strong">rôle sur les listes</span>, facultatif, le limite en plus à certaines listes : par exemple
              un bénévole qui ne voit que la liste de sa section. On l’attribue ensuite dans la fiche de l’utilisateur.
            </p>
          </Explain>
          {editingRole && <RoleForm key={editingRole === 'new' ? 'new' : editingRole.id} role={editingRole === 'new' ? undefined : editingRole} groups={groups} onDone={() => setEditingRole(null)} />}
          {roles.users.isPending ? <Loading /> : roles.users.isError ? <ErrorState error={roles.users.error} /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Rôle</th><th>Permissions</th><th className="right">Actions</th></tr></thead>
                <tbody>
                  {roles.users.data.map((r) => (
                    <tr key={r.id}>
                      <td className="strong">{r.name}</td>
                      <td className="small">{r.id === 1 ? 'Tout (super administrateur)' : `${r.permissions.length} permission${r.permissions.length > 1 ? 's' : ''}`}</td>
                      <td className="right">
                        {can('roles:manage') && r.id !== 1 && (
                          <div className="row-gap end">
                            <button type="button" className="btn btn-sm" onClick={() => setEditingRole(r)}>Modifier</button>
                            {confirm === `r${r.id}` ? (
                              <button type="button" className="btn btn-sm btn-danger" onClick={() => delRole.mutate(r.id, { onSettled: () => setConfirm(null) })}>Confirmer</button>
                            ) : <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(`r${r.id}`)}>Supprimer</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="panel-head">
            <h2>Rôles sur les listes</h2>
            {can('roles:manage') && <button type="button" className="btn btn-sm" onClick={() => setEditingListRole('new')}><Icon name="plus" size={14} /> Nouveau rôle sur les listes</button>}
          </div>
          {editingListRole && <ListRoleForm key={editingListRole === 'new' ? 'new' : editingListRole.id} role={editingListRole === 'new' ? undefined : editingListRole} onDone={() => setEditingListRole(null)} />}
          {roles.lists.isPending ? <Loading /> : roles.lists.isError ? <ErrorState error={roles.lists.error} /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Rôle sur les listes</th><th>Listes</th><th className="right">Actions</th></tr></thead>
                <tbody>
                  {roles.lists.data.map((r) => (
                    <tr key={r.id}>
                      <td className="strong">{r.name}</td>
                      <td className="small">{!r.lists?.length ? <span className="muted">Aucune liste</span> : r.lists.map((l) => `${l.name}${l.permissions.includes('list:manage') ? ' (gérer)' : ''}`).join(', ')}</td>
                      <td className="right">
                        {can('roles:manage') && (
                          <div className="row-gap end">
                            <button type="button" className="btn btn-sm" onClick={() => setEditingListRole(r)}>Modifier</button>
                            {confirm === `l${r.id}` ? (
                              <button type="button" className="btn btn-sm btn-danger" onClick={() => delRole.mutate(r.id, { onSettled: () => setConfirm(null) })}>Confirmer</button>
                            ) : <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirm(`l${r.id}`)}>Supprimer</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {roles.lists.data.length === 0 && <tr><td colSpan={3} className="empty">Aucun rôle sur les listes : chacun voit toutes les listes que son rôle permet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {delRole.isError && <ErrorState error={delRole.error} />}
        </>
      )}
    </div>
  );
}
