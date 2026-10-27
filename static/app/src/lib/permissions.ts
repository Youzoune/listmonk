// Plain-word labels for the permissions of permissions.json.

export const PERMISSION_GROUPS: Record<string, string> = {
  lists: 'Listes',
  subscribers: 'Contacts',
  campaigns: 'Campagnes',
  bounces: 'Rebonds',
  webhooks: 'Webhooks',
  media: 'Médias',
  templates: 'Modèles',
  users: 'Utilisateurs',
  roles: 'Rôles',
  settings: 'Réglages',
  projects: 'Projets',
};

export const PERMISSION_LABELS: Record<string, string> = {
  'lists:get_all': 'Voir toutes les listes',
  'lists:manage_all': 'Gérer toutes les listes',
  'subscribers:get': 'Voir les contacts de ses listes',
  'subscribers:get_all': 'Voir tous les contacts',
  'subscribers:manage': 'Ajouter, modifier, supprimer des contacts',
  'subscribers:import': 'Importer des contacts',
  'subscribers:sql_query': 'Rechercher en SQL (réservé aux administrateurs)',
  'tx:send': 'Envoyer des e-mails transactionnels (API)',
  'campaigns:get': 'Voir les campagnes de ses listes',
  'campaigns:get_all': 'Voir toutes les campagnes',
  'campaigns:get_analytics': 'Voir les statistiques',
  'campaigns:manage': 'Gérer les campagnes de ses listes',
  'campaigns:manage_all': 'Gérer toutes les campagnes',
  'campaigns:send': 'Lancer les envois',
  'bounces:get': 'Voir les rebonds',
  'bounces:manage': 'Gérer les rebonds',
  'webhooks:post_bounce': 'Signaler des rebonds par webhook',
  'media:get': 'Voir les médias',
  'media:manage': 'Envoyer et supprimer des médias',
  'templates:get': 'Voir les modèles',
  'templates:manage': 'Gérer les modèles',
  'users:get': 'Voir les utilisateurs',
  'users:manage': 'Gérer les utilisateurs',
  'roles:get': 'Voir les rôles',
  'roles:manage': 'Gérer les rôles',
  'settings:get': 'Voir les réglages',
  'settings:manage': 'Modifier les réglages',
  'settings:maintain': 'Maintenance (nettoyage des données)',
  'projects:get': 'Voir les projets',
  'projects:manage': 'Gérer tous les projets',
};

export interface PermissionGroup { group: string; permissions: string[] }

export const permissionLabel = (p: string) => PERMISSION_LABELS[p] ?? p;
export const groupLabel = (g: string) => PERMISSION_GROUPS[g] ?? g;

// List roles: per list, nothing, read-only or read and manage.
export type ListAccess = 'none' | 'get' | 'manage';
export interface ListGrant { id: number; name: string; permissions: string[] }

export function listAccess(grants: ListGrant[], listId: number): ListAccess {
  const p = grants.find((g) => g.id === listId)?.permissions ?? [];
  if (p.includes('list:manage')) return 'manage';
  return p.includes('list:get') ? 'get' : 'none';
}

// Managing a list implies seeing it. Lists of other projects stay untouched.
export function setListAccess(grants: ListGrant[], list: { id: number; name: string }, access: ListAccess): ListGrant[] {
  const rest = grants.filter((g) => g.id !== list.id);
  if (access === 'none') return rest;
  return [...rest, { id: list.id, name: list.name, permissions: access === 'manage' ? ['list:get', 'list:manage'] : ['list:get'] }];
}
