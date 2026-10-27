# Relais — admin React

Nouvelle interface d'administration du fork Youzoune de listmonk (YZN-214), branchée sur l'API JSON.
Elle est servie par le binaire sous `/app`, à côté de l'ancienne admin (`/admin`) le temps de la migration.

Pile : React 19, TypeScript, Vite, React Router, TanStack Query. Polices auto-hébergées (Fontsource).
Les styles reprennent la maquette validée (`docs/youzoune/maquette`).

## Développer

```sh
# Une instance listmonk doit tourner sur :9000 (make run, ou ./listmonk).
cd static/app
bun install
bun run dev        # http://localhost:5173/app, API et connexion relayées vers :9000
```

Autre adresse d'API : `LISTMONK_URL=http://localhost:9100 bun run dev`.

## Construire et tester

```sh
make build-app     # static/app/dist, embarqué ensuite par make dist
make test-app      # tests unitaires (Vitest)
cd tests && bun playwright test specs/app.spec.js   # parcours e2e sur /app
```

## Organisation

| Dossier | Contenu |
|---|---|
| `src/api` | Client HTTP (en-tête `X-Listmonk-Project`, renvoi vers la connexion si la session expire), types et hooks de requêtes |
| `src/lib` | Logique pure et testée : variables lisibles ↔ templates listmonk, mise en forme, calculs de cadence et de warm-up |
| `src/components` | Coque (navigation, sélecteur de projet) et composants partagés |
| `src/views` | Un fichier par écran |

## Où on en est

| Écran | Adresse |
|---|---|
| Aujourd'hui, Campagnes, Nouvelle campagne | `/`, `/campagnes`, `/campagnes/nouvelle` |
| Fiche campagne : contenu avec mise en forme (gras, liens, titres, listes, images), aperçu, test, lancement, pause, programmation, duplication, statistiques | `/campagnes/:id` |
| Audience (recherche, recherche SQL, export CSV), fiche contact, import CSV, listes, rebonds, formulaire d'inscription | `/audience`, `/audience/:id`, `/audience/import`, `/listes`, `/rebonds`, `/formulaire` |
| Modèles (code HTML et aperçu en direct), médias | `/modeles`, `/medias` |
| Relais d'envoi, Projets, Guide de l'envoi, Identité | `/relais`, `/projets`, `/guide`, `/marque` |
| Équipe : utilisateurs, rôles et rôles sur les listes | `/equipe` |
| Réglages : général, SMTP (préréglages OVH, Google, Microsoft, Brevo…), vitesse, confidentialité et domaines, sécurité et OIDC, rebonds (boîte POP3, webhooks des prestataires), médias, autres canaux, apparence, performances | `/reglages` |
| Maintenance : nettoyage, journal du serveur | `/maintenance` |

* Après connexion on arrive sur `/app`. La page de connexion reste celle du serveur (`/admin/login`) : elle gère déjà
  la double authentification et OIDC.
* Les mots de passe enregistrés ne repartent jamais vers le navigateur : un champ vide garde le mot de passe existant.
* Encore seulement dans l'ancienne interface (`/admin`) : les modèles visuels (éditeur par blocs) et le CSS de l'ancienne
  interface elle-même. Une campagne écrite ailleurs avec une mise en forme que Relais ne sait pas relire s'édite en HTML.
