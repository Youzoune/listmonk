# Multi-projet (espaces de travail)

## Objectif

Une seule instance listmonk sert plusieurs projets de prospection. Listes, abonnés, campagnes,
modèles, médias et SMTP d'un projet ne sont ni visibles ni utilisables depuis un autre projet,
à la manière des espaces de travail de Twenty.

## Modèle de données

```
projects (id, uuid, name, slug UNIQUE, domain UNIQUE NULL, description)
   │
   ├── lists.project_id
   ├── subscribers.project_id      UNIQUE (project_id, LOWER(email))
   ├── campaigns.project_id
   ├── templates.project_id
   └── media.project_id

user_projects (user_id, project_id)   accès des utilisateurs aux projets
```

* Le projet `1` (« Default », slug `default`) existe toujours et ne peut pas être supprimé.
  La migration y range toutes les données existantes et y donne accès à tous les utilisateurs existants.
* Les tables qui dépendent d'une ligne parente (`subscriber_lists`, `campaign_lists`, `campaign_views`,
  `link_clicks`, `bounces`, `campaign_media`) n'ont pas de `project_id` : le projet se déduit du parent.
* Les clés étrangères vers `projects` sont en `ON DELETE RESTRICT` : on ne peut supprimer un projet
  que s'il est vide.

### Décision : un abonné appartient à un seul projet

La même adresse e-mail peut exister dans plusieurs projets, sous forme de lignes `subscribers`
distinctes. L'unicité passe de `LOWER(email)` sur toute l'instance à `(project_id, LOWER(email))`.

Conséquences voulues :

* statut (dont la liste noire), attributs et abonnements sont propres à chaque projet ;
  une personne qui se désinscrit du projet sport reste joignable par un autre projet ;
* la désinscription (fonctionnalité 5) devient naturelle : les liens d'un e-mail portent l'UUID de
  l'abonné, qui n'appartient qu'à un projet, donc « se désinscrire de tout » ne touche que ce projet.

L'autre option (abonné global partagé entre projets) aurait demandé de filtrer chaque abonnement
par projet et laissé fuiter statut et attributs d'un projet à l'autre.

### Valeur par défaut `project_id = 1`

Au lot 1, les colonnes ont `DEFAULT 1` pour que toutes les requêtes d'insertion existantes continuent
de fonctionner sans changement. Au lot 2, chaque insertion passera le projet courant explicitement,
puis le `DEFAULT` sera retiré pour qu'un oubli devienne une erreur et non une fuite vers le projet par défaut.

## Projet courant

* **API** : en-tête `X-Listmonk-Project` (id ou slug). Sans en-tête, projet par défaut, pour ne pas
  casser les intégrations existantes (ex. YZN-152, inscription newsletter depuis la webapp et le site vitrine).
  Un utilisateur API pourra être limité à un seul projet.
* **Admin** : projet choisi dans un sélecteur, gardé en session.
* **Pages publiques** : projet déduit du domaine (`projects.domain`, comparé à l'en-tête `Host`), sinon
  de la campagne ou de l'abonné concerné par le lien.

## Droits

* Nouvelles permissions `projects:get` et `projects:manage` (groupe `projects` de `permissions.json`).
  La migration les ajoute au rôle Super Admin.
* `projects:manage` (et Super Admin) donne accès à tous les projets. Les autres utilisateurs ne voient
  que les projets listés dans `user_projects`.
* Les rôles de liste existants restent valables : ils restreignent en plus l'accès à l'intérieur d'un projet.

## API (lot 1)

| Méthode | Route | Permission |
|---|---|---|
| GET | `/api/projects` | `projects:get` ou `projects:manage` |
| GET | `/api/projects/:id` | `projects:get` (projet accessible) ou `projects:manage` |
| POST | `/api/projects` | `projects:manage` |
| PUT | `/api/projects/:id` | `projects:manage` |
| DELETE | `/api/projects/:id` | `projects:manage` (projet vide, pas le projet par défaut) |
| GET | `/api/users/:id/projects` | `users:get` |
| PUT | `/api/users/:id/projects` | `users:manage`, corps `{"project_ids": [1, 2]}` |

Champs d'un projet : `name` (obligatoire), `slug` (minuscules, chiffres, tirets, 64 caractères max.),
`domain` (facultatif, nom d'hôte), `description`.

## Reste à faire au lot 2

* Middleware qui résout le projet courant et vérifie l'accès de l'utilisateur.
* Passer `project_id` à toutes les requêtes de lecture et d'écriture (≈ 120 requêtes dans `queries/`),
  y compris les requêtes construites dynamiquement (recherche d'abonnés en SQL, exports, imports).
* Modèle par défaut par projet (l'index unique `is_default` est encore global).
* Slug d'archive (`campaigns.archive_slug`) : unique par projet plutôt que global.
* Vues matérialisées du tableau de bord et des statistiques par projet.
* Tests de non-fuite entre deux projets sur chaque écran et chaque route.
