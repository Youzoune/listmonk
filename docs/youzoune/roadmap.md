# Feuille de route de Relais

Relais sert d'abord à Youzoune, WeSportive et Fidélisemoi : de la prospection B2B (séquences « Email 1, relance J+4,
relance J+9 ») et des newsletters, sur plusieurs domaines. L'objectif : qu'une personne qui n'y connaît rien envoie des
e-mails qui arrivent en boîte de réception, sans y passer sa journée.

Chaque lot se termine par une PR testée (e2e Playwright, tests unitaires) et un déploiement sur mailing.youzoune.com.

## 0. Remettre en route (maintenant)

| Sujet | Contenu | État |
|---|---|---|
| Ancienne interface | Coupée : tout mène à Relais, pages de connexion refaites | fait (PR #9) |
| Relais d'envoi | Serveurs d'exemple repérés, alerte quand rien ne peut partir, assistant « Nouveau relais » | fait |
| Migration de listmonk.youzoune.com | Outil « Importer depuis listmonk » : listes, contacts et désinscriptions, modèles, campagnes en brouillon, serveurs SMTP ; une marque par projet | en cours |
| Projets | Youzoune, WeSportive, Fidélisemoi, chacun avec son sous-domaine et ses relais | avec la migration |

## 1. Délivrabilité (arriver en boîte de réception)

* **Vérificateur de domaine** : SPF, DKIM, DMARC, MX et rDNS lus en direct pour chaque domaine d'expéditeur, avec
  l'enregistrement DNS exact à copier chez OVH, Cloudflare ou Google. Feu rouge sur la campagne tant que ça manque.
* **Conformité Gmail / Yahoo** (expéditeurs en masse) : désinscription en un clic, taux de plainte sous 0,3 %, alignement DMARC.
* **Hygiène des listes à l'import** : syntaxe, domaine sans MX, adresses jetables, rôles (contact@, info@), doublons ;
  rapport avant d'importer.
* **Score du contenu** : poids des images, liens raccourcis, mots à risque, absence de version texte, lien de désinscription.
* **Tests de placement** : envoi vers des boîtes témoins Gmail, Outlook, Orange, Free ; résultat boîte de réception / spam.
* **Surveillance** : listes noires (Spamhaus…), taux de rebonds et de plaintes par relais, pause automatique au-delà d'un seuil.

## 2. Prospection (le cœur de l'usage)

* **Séquences** : Email 1 puis relances automatiques à J+n, envoyées seulement à ceux qui n'ont ni répondu ni cliqué.
  Remplace les campagnes « Relance J+4 » et « J+9 » faites à la main.
* **Détection des réponses** : lecture de la boîte (IMAP) de l'expéditeur ; une réponse arrête la séquence et s'affiche dans Relais.
* **Rotation des boîtes d'envoi** : plusieurs adresses par campagne, chacune avec son quota et son warm-up.
* **Personnalisation** : variables par contact (commune, activité, site web), extraits conditionnels, aperçu contact par contact.
* **Test A/B** de l'objet et du premier paragraphe, sur un échantillon, puis envoi du gagnant.
* **Fenêtres d'envoi** : jours et heures ouvrés du destinataire.
* **Cadre légal** : rappels CNIL pour la prospection B2B (intérêt légitime, information, opposition facile), registre des désinscriptions.

## 3. Éditeur

* **Éditeur par blocs** (React) : titre, texte, image, bouton, colonnes, séparateur, signature ; remplace l'éditeur visuel de listmonk.
* **Aperçus** : mobile, mode sombre, Gmail et Outlook ; vérification des liens et de l'orthographe avant l'envoi.
* **Bibliothèque** : blocs enregistrés (signature, pied de page légal), modèles par projet, images glissées-déposées.
* **Assistant de rédaction** : objets plus courts, ton, longueur, version texte générée.

## 4. Audience

* **Segments sans SQL** : filtres enregistrés (attribut, liste, a ouvert, a cliqué, date d'inscription).
* **Import guidé** : correspondance des colonnes, aperçu, attributs créés à la volée, rapport d'erreurs.
* **Fiche contact** : historique (campagnes reçues, ouvertures, clics, réponses, rebonds), notes, étiquettes.
* **Synchronisation avec Twenty** (CRM déjà déployé) : contacts et entreprises dans les deux sens, e-mails et réponses
  journalisés dans Twenty, « ajouter à une séquence » depuis Twenty.
* **Formulaires** : formulaire hébergé par projet au style du projet, double confirmation, champs personnalisés.

## 5. Statistiques

* **Rapport de campagne** : courbe des ouvertures et clics dans le temps, liens les plus cliqués, rebonds et plaintes par domaine
  (Gmail, Outlook, Orange…), contacts à relancer.
* **Tableau de bord par projet** : volume, délivrabilité, croissance des listes, comparaison des campagnes.
* **Exports** : CSV et lien partageable du rapport.

## 6. Automatisations

* **Scénarios** : bienvenue après inscription, relance d'inactifs, anniversaire d'inscription.
* **Déclencheurs** : inscription, étiquette ajoutée, événement Twenty, webhook entrant.
* **Webhooks sortants** : ouverture, clic, réponse, désinscription vers Twenty, n8n ou Slack.

## 7. Plateforme

* **Fiabilité des envois** (lot 6 du ticket) : reprise exacte après redémarrage, file d'attente visible, alertes quand un relais échoue.
* **Droits par projet** : rôles limités à un projet, journal des actions, clés API par projet.
* **Sauvegardes** et restauration depuis Relais (Coolify), supervision (santé, files, erreurs).
* **Interface en anglais** pour les projets qui en ont besoin.

## Ordre proposé

1. Migration de l'ancienne instance et relais réels (sans eux rien ne part).
2. Vérificateur de domaine et alertes de délivrabilité.
3. Séquences avec détection des réponses.
4. Éditeur par blocs.
5. Synchronisation Twenty, segments, rapports, automatisations.
