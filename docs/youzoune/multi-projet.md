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
  que s'il n'a ni listes, ni abonnés, ni campagnes, ni médias. Ses modèles d'e-mail sont supprimés avec lui
  (migration `v7.3.0`), puisque chaque projet en reçoit un à sa création.

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

### Plus de valeur par défaut pour `project_id`

Au lot 1, les colonnes avaient `DEFAULT 1` pour que les insertions existantes continuent de fonctionner.
Depuis le lot 2 (migration `v7.2.0`), chaque insertion passe le projet explicitement et le `DEFAULT` est retiré :
un oubli provoque une erreur au lieu d'une fuite silencieuse vers le projet par défaut.

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

## Isolation (lot 2)

**Projet courant.** Le middleware `projectMiddleware` lit l'en-tête `X-Listmonk-Project` (id ou slug), à défaut
le cookie `relais_project` posé par le nouveau front (l'ancienne admin suit donc le même projet), à défaut le projet
par défaut. Il vérifie l'accès de l'utilisateur et renvoie 403 sinon.

**Trois niveaux de protection :**

1. **Routes `/:id`** (API et ancienne admin) : le garde `owned` vérifie que la ligne appartient au projet courant,
   sinon la même réponse que pour une ligne inexistante (400, comme upstream) : on ne révèle pas l'existence d'une ligne d'un autre projet. 45 routes couvertes : listes, campagnes,
   abonnés, modèles, médias, rebonds.
2. **Requêtes de collection** : un paramètre `project_id` (0 = tous les projets, pour les usages internes) filtre
   les listes, campagnes, modèles, médias, rebonds, la recherche d'abonnés (y compris la recherche SQL avancée,
   l'export et les actions en masse « par requête »). Les identifiants passés en corps de requête (listes d'une
   campagne, abonnés d'une action en masse, listes d'un import, modèle d'un e-mail transactionnel…) sont vérifiés
   par `requireOwned`.
3. **Base de données** : un trigger `same_project_list` écarte tout lien abonné ↔ liste ou campagne ↔ liste entre
   deux projets différents, quelle que soit la requête qui l'a tenté.

**Autres points :**

* Un modèle par défaut par projet ; un nouveau projet reçoit une copie du modèle par défaut du projet 1.
* Tableau de bord : chiffres et courbes calculés en direct pour le projet courant (les vues matérialisées
  d'upstream restent utilisées pour la vue de toute l'instance).
* Inscription publique : le projet de l'abonné est celui des listes choisies ; des listes de projets différents
  sont refusées. Les pages publiques et l'archive n'affichent pour l'instant que le projet par défaut (lot 5).
* Rebonds reçus par e-mail : on cherche l'abonné dans le projet de la campagne quand elle est connue.

**Limites connues :**

* La permission `subscribers:sql_query` permet d'écrire des expressions SQL arbitraires (lecture seule, tables
  limitées). Une expression malveillante peut sortir du filtre de projet : à réserver aux administrateurs de
  toute l'instance.
* La maintenance (suppression des abonnés orphelins ou en liste noire, des abonnements non confirmés, des
  statistiques anciennes) s'applique à toute l'instance.
* Un rebond reçu sans campagne pour une adresse présente dans plusieurs projets n'est rattaché qu'à un seul
  abonné (le plus ancien).
