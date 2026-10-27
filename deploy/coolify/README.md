# Déployer Relais sur Coolify

Relais se déploie comme Twenty : une ressource Coolify construite depuis le dépôt Git, avec sa base Postgres,
un domaine principal, et un sous-domaine par projet (`sport.mailing.youzoune.com`, `culture.mailing.youzoune.com`…)
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
| `mailing.youzoune.com` | A (et AAAA) | Adresse principale : administration, projet par défaut |
| `*.mailing.youzoune.com` | A (et AAAA) | Tous les projets |

## 2. Certificat joker (une fois par serveur)

Let's Encrypt ne délivre un certificat joker que par **défi DNS** : Traefik crée un enregistrement TXT temporaire
chez le gestionnaire du domaine.

**Sur le serveur « Youzoune VPS » (celui de Twenty), c'est déjà en place** : le proxy Traefik a un second
résolveur, `letsencrypt-dns`, qui utilise le défi DNS Cloudflare (`CF_DNS_API_TOKEN`). `docker-compose.relais.yml`
l'utilise par défaut pour le certificat `mailing.youzoune.com` + `*.mailing.youzoune.com`. Rien à faire.

Sur un autre serveur, ajoutez ce résolveur dans **Servers › le serveur › Proxy › Configuration**, puis
redémarrez le proxy :

```yaml
environment:
  - CF_DNS_API_TOKEN=…   # jeton Cloudflare « Edit zone DNS » limité au domaine
command:
  # … lignes existantes …
  - '--certificatesresolvers.letsencrypt-dns.acme.dnschallenge=true'
  - '--certificatesresolvers.letsencrypt-dns.acme.dnschallenge.provider=cloudflare'
  - '--certificatesresolvers.letsencrypt-dns.acme.dnschallenge.resolvers=1.1.1.1:53'
  - '--certificatesresolvers.letsencrypt-dns.acme.storage=/traefik/acme-dns.json'
```

Si le résolveur porte un autre nom, indiquez-le dans la variable `RELAIS_WILDCARD_CERT_RESOLVER`. Documentation
Coolify : [défi DNS](https://coolify.io/docs/core/networking/proxy/traefik/dns-challenge) et
[certificats joker](https://coolify.io/docs/core/networking/proxy/traefik/wildcard-certs).

## 3. Créer la ressource

1. **Projects › votre projet › + New › Private Repository (GitHub App)**, dépôt `Youzoune/listmonk`, branche
   `master` (ou la branche à tester).
2. **Build Pack : Docker Compose**, **Docker Compose Location : `/docker-compose.relais.yml`**.
3. Dans **Domains**, service `relais` : `https://mailing.youzoune.com`.
4. Dans **Environment Variables** :
   * `RELAIS_PROJECTS_DOMAIN` = `mailing.youzoune.com` (obligatoire) ;
   * `RELAIS_ADMIN_USER` (facultatif, `admin` par défaut) ;
   * `RELAIS_WILDCARD_CERT_RESOLVER` (facultatif, `letsencrypt-dns` par défaut) : le résolveur Traefik à défi DNS ;
   * `RELAIS_ROOT_URL` (facultatif) : l'adresse principale, si celle que Coolify déduit du domaine ne convient pas ;
   * `SERVICE_PASSWORD_ADMIN` est généré par Coolify : c'est le mot de passe du premier compte administrateur.
     Les identifiants Postgres sont générés de la même façon.
5. **Deploy**.

Au premier démarrage, Relais crée la base et le compte administrateur. À chaque déploiement, il applique les
migrations en attente. L'adresse principale vient du domaine Coolify (`LISTMONK_app__root_url`) : inutile de la
régler dans les paramètres.

## 4. Après le premier déploiement

* Se connecter sur `https://mailing.youzoune.com/admin/login`, puis ouvrir Relais (`/app`).
* Régler les serveurs SMTP (**Paramètres › SMTP** de l'ancienne interface), puis leur projet, leur cadence et
  leur warm-up dans **Relais d'envoi**.
* Créer les projets : chacun est aussitôt servi sur `<identifiant>.mailing.youzoune.com`.

## Domaine personnalisé pour un client

1. Le client crée un CNAME : `newsletter.client.fr` → `mailing.youzoune.com`.
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
