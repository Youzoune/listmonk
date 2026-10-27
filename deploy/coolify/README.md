# Déployer Relais sur Coolify

Relais se déploie comme Twenty : une ressource Coolify construite depuis le dépôt Git, avec sa base Postgres,
un domaine principal, et un sous-domaine par projet (`sport.relais.youzoune.fr`, `culture.relais.youzoune.fr`…)
servi par un certificat joker.

Fichiers :

* [`/docker-compose.relais.yml`](../../docker-compose.relais.yml) : l'application et Postgres, avec les variables
  magiques de Coolify et les règles Traefik des sous-domaines ;
* [`deploy/coolify/Dockerfile`](Dockerfile) : construit Relais depuis les sources (les deux fronts avec Bun, le
  binaire Go, puis `stuffbin`).

## 1. DNS (une fois)

Chez le gestionnaire du domaine, vers l'IP du serveur Coolify :

| Nom | Type | Rôle |
|---|---|---|
| `relais.youzoune.fr` | A (et AAAA) | Adresse principale : administration, projet par défaut |
| `*.relais.youzoune.fr` | A (et AAAA) | Tous les projets |

## 2. Certificat joker (une fois par serveur)

Let's Encrypt ne délivre un certificat joker que par **défi DNS** : Traefik crée un enregistrement TXT temporaire
chez le gestionnaire du domaine. Dans Coolify, **Servers › le serveur › Proxy › Configuration**, ajoutez à la
commande de Traefik (exemple pour OVH ; Cloudflare, Gandi… fonctionnent de même) :

```yaml
command:
  # … lignes existantes …
  - '--certificatesresolvers.letsencrypt.acme.dnschallenge=true'
  - '--certificatesresolvers.letsencrypt.acme.dnschallenge.provider=ovh'
  - '--certificatesresolvers.letsencrypt.acme.dnschallenge.delaybeforecheck=30'
environment:
  - OVH_ENDPOINT=ovh-eu
  - OVH_APPLICATION_KEY=…
  - OVH_APPLICATION_SECRET=…
  - OVH_CONSUMER_KEY=…
```

Puis redémarrez le proxy. La procédure officielle est dans la documentation Coolify :
[défi DNS](https://coolify.io/docs/core/networking/proxy/traefik/dns-challenge) et
[certificats joker](https://coolify.io/docs/core/networking/proxy/traefik/wildcard-certs).
Si Twenty utilise déjà des sous-domaines sur ce serveur, cette étape est sans doute déjà faite.

Pas besoin de fichier de configuration dynamique : les étiquettes de `docker-compose.relais.yml` demandent
elles-mêmes le certificat `relais.youzoune.fr` + `*.relais.youzoune.fr`.

## 3. Créer la ressource

1. **Projects › votre projet › + New › Private Repository (GitHub App)**, dépôt `Youzoune/listmonk`, branche
   `master` (ou la branche à tester).
2. **Build Pack : Docker Compose**, **Docker Compose Location : `/docker-compose.relais.yml`**.
3. Dans **Domains**, service `relais` : `https://relais.youzoune.fr`.
4. Dans **Environment Variables** :
   * `RELAIS_PROJECTS_DOMAIN` = `relais.youzoune.fr` (obligatoire) ;
   * `RELAIS_ADMIN_USER` (facultatif, `admin` par défaut) ;
   * `RELAIS_ROOT_URL` (facultatif) : l'adresse principale, si celle que Coolify déduit du domaine ne convient pas ;
   * `SERVICE_PASSWORD_ADMIN` est généré par Coolify : c'est le mot de passe du premier compte administrateur.
     Les identifiants Postgres sont générés de la même façon.
5. **Deploy**.

Au premier démarrage, Relais crée la base et le compte administrateur. À chaque déploiement, il applique les
migrations en attente. L'adresse principale vient du domaine Coolify (`LISTMONK_app__root_url`) : inutile de la
régler dans les paramètres.

## 4. Après le premier déploiement

* Se connecter sur `https://relais.youzoune.fr/admin/login`, puis ouvrir Relais (`/app`).
* Régler les serveurs SMTP (**Paramètres › SMTP** de l'ancienne interface), puis leur projet, leur cadence et
  leur warm-up dans **Relais d'envoi**.
* Créer les projets : chacun est aussitôt servi sur `<identifiant>.relais.youzoune.fr`.

## Domaine personnalisé pour un client

1. Le client crée un CNAME : `newsletter.client.fr` → `relais.youzoune.fr`.
2. Dans Coolify, ajoutez `https://newsletter.client.fr` aux **Domains** du service `relais` (séparés par des
   virgules), puis redéployez : Coolify obtient son certificat.
3. Dans Relais, saisissez ce domaine dans les réglages du projet.

## Mises à jour

Un push sur la branche déployée relance le déploiement (si le déploiement automatique est activé). Les migrations
s'exécutent au démarrage. Les fichiers envoyés (médias) sont dans le volume `relais-uploads` et la base dans
`relais-postgres`. Pensez aux sauvegardes de la base dans Coolify.

## Vérifié en local

La pile (`docker compose` avec les mêmes variables, et un Traefik v3 devant) a été testée :

* l'image se construit depuis les sources ;
* la base s'installe ;
* l'adresse principale vient de l'environnement ;
* `sport.relais.localhost` sert le projet Sport, et un hôte inconnu répond 404 ;
* HTTP redirige vers HTTPS.

Restent à vérifier sur le vrai serveur :

* le défi DNS et le certificat joker ;
* la cohabitation des étiquettes Traefik de Coolify avec celles des sous-domaines.
