# Fork Youzoune de listmonk

Fork indépendant de [knadh/listmonk](https://github.com/knadh/listmonk) (AGPLv3), suivi dans Jira par **YZN-214**.
On ne suit plus l'upstream ; seuls les correctifs de sécurité sont reportés à la main (remote `upstream`).

Point de départ : `master` upstream au commit `8216c4f1` (après la v7.0.0).

## Feuille de route

| Lot | Contenu | Fonctionnalité du ticket | État |
|---|---|---|---|
| 1 | Fondations multi-projet : tables, migration, API de gestion des projets, permissions | 4 | fait (PR #1) |
| 2 | Isolation : projet courant sur chaque requête, filtrage de toutes les requêtes SQL (listes, abonnés, campagnes, modèles, médias, imports, exports, tableaux de bord, rebonds) | 4 | fait (migration `v7.2.0`) |
| 3 | Interface : sélecteur de projet, page de gestion des projets, accès des utilisateurs | 4 | à faire |
| 4 | SMTP par projet, SMTP dédié aux notifications système, cadence et warm-up par SMTP | 1, 2, 3 | à faire |
| 5 | Pages publiques par projet (domaine), désinscription et préférences limitées au projet | 5 | à faire |
| 6 | Fiabilité au redémarrage pendant les envois | 6 | à faire |
| 7 | Front (voir la question ouverte plus bas) | Front | à décider |

Le détail de conception du multi-projet est dans [multi-projet.md](multi-projet.md).

## Versions et migrations

Les migrations du fork continuent la numérotation upstream à partir de `v7.1.0`
(`internal/migrations/v7.1.0.go`). Comme on ne reprend plus les migrations upstream,
il n'y a pas de risque de collision.

## Front : décision

Upstream a supprimé le front Vue (commit `5523abf7`) : l'admin est rendu côté serveur (templates Go
dans `static/admin/views` et `static/admin/partials`, avec Alpine.js et la librairie CSS Oat).

**Décision (25/10)** : on ne garde pas ce rendu serveur. Le nouveau front est une application React
branchée sur l'API JSON, qui remplacera les vues serveur.

Une maquette React de la nouvelle interface, avec une proposition de marque (« Relais »), est dans
[maquette/](maquette/) : sources JSX dans `maquette/src`, page autonome générée par `bun ./build.mjs`.
