# Pages publiques par projet (lot 5)

Chaque projet peut avoir son **domaine** (`projects.domain`, réglé dans l'écran Projets). Ses pages publiques
y sont servies à son nom, et les liens de ses e-mails y pointent.

## Quel projet pour quelle page ?

| Page | Projet |
|---|---|
| Formulaire d'inscription, `/api/public/lists`, archive, flux RSS, dernière campagne | Celui du domaine de la requête (en-tête `Host`), sinon `?project=<identifiant>`, sinon le projet par défaut |
| Préférences, désinscription, confirmation (opt-in), export et effacement des données | Celui de l'abonné |
| Lecture en ligne d'une campagne, page d'une campagne archivée | Celui de la campagne |

Un domaine de projet ne sert **que** ce projet : un abonné, une campagne ou une liste d'un autre projet y
répond « introuvable » (404), et le formulaire refuse les listes d'un autre projet. L'adresse principale de
l'instance reste utilisable pour tous les projets (les liens envoyés avant l'ajout d'un domaine continuent
de marcher).

Sur ces pages, le nom du site devient celui du projet (titre, flux RSS).

## Liens des e-mails

Les liens générés pour une campagne prennent la racine du projet de la campagne : désinscription
(`{{ UnsubscribeURL }}` et en-tête `List-Unsubscribe`), préférences, lecture en ligne (`{{ MessageURL }}`),
pixel de suivi, liens suivis (`/link/…`), `{{ OptinURL }}`, `{{ ArchiveURL }}` et `{{ RootURL }}`. L'e-mail de
confirmation d'inscription prend la racine du projet de l'abonné.

La racine d'un projet avec domaine garde le schéma, le port et le chemin de l'adresse principale
(`app.root_url`) : `https://lists.exemple.org/listmonk` donne `https://news.sport.fr/listmonk`.
Sans domaine, c'est l'adresse principale ; l'archive d'un projet sans domaine est `…/archive?project=<identifiant>`.

Les projets sont gardés en mémoire (`internal/projectdir`) et rechargés à chaque création, modification ou
suppression de projet.

## Désinscription limitée au projet

Un abonné appartient à un seul projet (voir [multi-projet.md](multi-projet.md)) : se désinscrire, gérer ses
préférences ou demander l'effacement ne touche que ses listes dans ce projet. La même adresse inscrite dans un
autre projet y reste inscrite (vérifié par `tests/specs/public-projects.spec.js`).

## Brancher un domaine

1. Chez le gestionnaire du domaine, un enregistrement CNAME du domaine du projet vers l'hôte de `app.root_url`.
2. Sur le serveur, ajouter le domaine au proxy (Caddy, Nginx, Traefik…) devant Relais, avec un certificat HTTPS.
   Le proxy doit transmettre l'en-tête `Host` d'origine.
3. Ouvrir `https://<domaine>/subscription/form` : la page doit porter le nom du projet.

L'écran d'un projet (Projets › projet) affiche ses adresses publiques et rappelle ces étapes.

## Limites

* Le logo et les feuilles de style personnalisées des pages publiques restent ceux de l'instance.
* Les e-mails transactionnels (`/api/tx`) gardent l'adresse principale dans `{{ RootURL }}`.
