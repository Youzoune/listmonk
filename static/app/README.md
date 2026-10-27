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

* Faits : Aujourd'hui, Campagnes (filtres, recherche, pagination), Nouvelle campagne (assistant en 4 étapes, lancement ou planification),
  Audience (listes, filtres, recherche), Relais d'envoi (lecture des SMTP et de la cadence globale), Identité.
* La connexion passe encore par la page de l'ancienne admin (`/admin/login`), qui gère déjà la double authentification et OIDC.
* L'édition détaillée d'une campagne, d'un contact et les réglages ouvrent encore l'ancienne admin.
* L'en-tête de projet est envoyé, mais l'API ne filtre pas encore par projet : c'est le lot 2.
* Cadence, plage d'envoi et warm-up par relais : écrans prêts côté calcul (`src/lib/sending.ts`), en attente du lot 4.
