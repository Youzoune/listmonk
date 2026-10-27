# Pages publiques par projet (lot 5)

Comme les espaces de travail de Twenty, **chaque projet a son sous-domaine** : `<identifiant>.<domaine de base>`,
par exemple `sport.relais.youzoune.fr`. Ses pages publiques y sont servies à son nom, et les liens de ses
e-mails y pointent. Le domaine de base, le DNS et le certificat se règlent **une seule fois** pour toute
l'instance ; ensuite, créer un projet suffit.

Un projet peut aussi avoir un **domaine personnalisé** (`newsletter.client.fr`, réglé dans l'écran Projets) :
il remplace alors le sous-domaine. Le projet par défaut reste sur l'adresse principale de l'instance.

## Réglage du serveur

Le domaine de base est un réglage du serveur, comme les variables d'environnement de Twenty :

```toml
# config.toml
[projects]
domain = "relais.youzoune.fr"
```

ou `LISTMONK_projects__domain=relais.youzoune.fr`. Vide (par défaut), les projets sans domaine personnalisé
utilisent l'adresse principale avec `?project=<identifiant>`.

### DNS

Un seul enregistrement joker vers le serveur : `*.relais.youzoune.fr` (A, AAAA ou CNAME), en plus de
`relais.youzoune.fr` lui-même.

### Certificats HTTPS

Deux façons, au choix :

**1. Certificat joker, comme Twenty.** Un certificat `*.relais.youzoune.fr` obtenu par défi DNS (Let's Encrypt
exige le défi DNS pour un joker). Avec Caddy, il faut le module DNS du fournisseur (par exemple `caddy-dns/ovh`
ou `caddy-dns/cloudflare`) ; Traefik et certbot savent faire de même.

```caddy
relais.youzoune.fr, *.relais.youzoune.fr {
	tls {
		dns ovh {
			# clés API OVH du domaine
		}
	}
	reverse_proxy localhost:9000
}
```

Ça couvre tous les sous-domaines, mais pas les domaines personnalisés.

**2. Certificats à la demande (Caddy), recommandé.** Caddy demande le certificat d'un domaine à sa première
visite, après avoir vérifié auprès de Relais que ce domaine est bien celui d'un projet. Il n'y a pas de module
DNS à installer, et les domaines personnalisés marchent aussi sans toucher au serveur.

```caddy
{
	on_demand_tls {
		ask http://localhost:9000/api/public/domains/check
	}
}

https:// {
	tls {
		on_demand
	}
	reverse_proxy localhost:9000
}
```

`GET /api/public/domains/check?domain=<hôte>` répond 200 pour l'hôte de l'instance, le sous-domaine d'un projet
ou un domaine personnalisé, et 404 sinon, pour qu'aucun certificat ne soit demandé pour un domaine inconnu.

Dans tous les cas, le proxy doit transmettre l'en-tête `Host` d'origine.

### Domaine personnalisé d'un projet

Le client crée un CNAME de son domaine vers le sous-domaine du projet (ou l'adresse principale). Avec les
certificats à la demande, c'est tout. Avec un certificat joker, il faut en plus ajouter ce domaine au proxy.
Un domaine personnalisé ne peut pas être sous le domaine de base : ces sous-domaines sont automatiques.

## Quel projet pour quelle page ?

| Page | Projet |
|---|---|
| Formulaire d'inscription, `/api/public/lists`, archive, flux RSS, dernière campagne | Celui de l'hôte de la requête (sous-domaine ou domaine personnalisé), sinon `?project=<identifiant>`, sinon le projet par défaut |
| Préférences, désinscription, confirmation (opt-in), export et effacement des données | Celui de l'abonné |
| Lecture en ligne d'une campagne, page d'une campagne archivée | Celui de la campagne |

L'adresse d'un projet ne sert **que** ce projet : un abonné, une campagne ou une liste d'un autre projet y
répond « introuvable » (404), et le formulaire refuse les listes d'un autre projet. L'adresse principale de
l'instance reste utilisable pour tous les projets (les liens envoyés avant restent valables).

Sur ces pages, le nom du site devient celui du projet (titre, flux RSS).

## Liens des e-mails

Les liens générés pour une campagne prennent la racine du projet de la campagne : désinscription
(`{{ UnsubscribeURL }}` et en-tête `List-Unsubscribe`), préférences, lecture en ligne (`{{ MessageURL }}`),
pixel de suivi, liens suivis (`/link/…`), `{{ OptinURL }}`, `{{ ArchiveURL }}` et `{{ RootURL }}`. L'e-mail de
confirmation d'inscription prend la racine du projet de l'abonné.

La racine d'un projet garde le schéma, le port et le chemin de l'adresse principale (`app.root_url`) :
`https://relais.youzoune.fr/listmonk` donne `https://sport.relais.youzoune.fr/listmonk`.

**Changer l'identifiant d'un projet change son sous-domaine** : les liens des e-mails déjà envoyés ne marchent
plus. L'écran du projet le rappelle.

Les projets sont gardés en mémoire (`internal/projectdir`) et rechargés à chaque création, modification ou
suppression de projet.

## Désinscription limitée au projet

Un abonné appartient à un seul projet (voir [multi-projet.md](multi-projet.md)) : se désinscrire, gérer ses
préférences ou demander l'effacement ne touche que ses listes dans ce projet. La même adresse inscrite dans un
autre projet y reste inscrite (vérifié par `tests/specs/public-projects.spec.js`).

## Tests

Les tests e2e lancent l'instance avec `LISTMONK_projects__domain=relais.localhost` : Chromium résout tout
`*.localhost` vers la machine, ce qui permet de tester de vrais sous-domaines (`sport.relais.localhost`) et un
domaine personnalisé (`culture.localhost`) sans DNS.

## Limites

* Le logo et les feuilles de style personnalisées des pages publiques restent ceux de l'instance.
* Les e-mails transactionnels (`/api/tx`) gardent l'adresse principale dans `{{ RootURL }}`.
* Un identifiant de plus de 63 caractères (limite d'un nom DNS) n'a pas de sous-domaine.
