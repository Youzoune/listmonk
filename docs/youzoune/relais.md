# Relais d'envoi : SMTP par projet, SMTP système, cadence et warm-up (lot 4)

Un **relais** est un serveur SMTP nommé (le messenger `email-<nom>` de listmonk), ou le relais par défaut
`email`, qui répartit les envois sur les serveurs partagés.

## SMTP par projet

* Chaque serveur SMTP a un `project_id` dans les réglages (`smtp[].project_id`) : `0` le partage entre tous
  les projets, sinon il est réservé à ce projet.
* Un serveur réservé à un projet **sort automatiquement du relais par défaut**, qui ne contient plus que les
  serveurs partagés. Un projet ne peut donc jamais envoyer, même indirectement, par le SMTP d'un autre projet.
* Les campagnes, les e-mails de test et les e-mails transactionnels refusent un relais d'un autre projet.
  `/api/config` ne liste que les relais du projet courant.
* Un serveur réservé à un projet doit avoir un nom. Il faut au moins un serveur partagé actif.

## SMTP dédié aux notifications système

Réglage `app.system_messenger` : le relais des e-mails applicatifs (confirmations d'inscription, alertes de
l'équipe, réinitialisation de mot de passe). Vide = relais par défaut, comme upstream. Seul un serveur partagé
et actif peut tenir ce rôle.

## Cadence et warm-up par relais

Réglages `smtp[].cadence` et `smtp[].warmup` (valeurs à 0 = pas de limite) :

| Réglage | Effet |
|---|---|
| `per_minute` | E-mails espacés régulièrement (ex. 2 / min = un toutes les 30 s) |
| `per_hour`, `per_day` | Plafonds par heure et par jour calendaire |
| `days`, `from_hour`, `to_hour`, `timezone` | Jours et heures d'envoi (vide et 0–0 = toujours), dans le fuseau du relais |
| `warmup.start`, `growth`, `cap`, `since` | Plafond du jour = `start × (1 + growth %)^(jour − 1)`, borné par `cap` et `per_day`, à partir de la date de mise en service |

La cadence globale d'upstream (concurrence, débit par seconde, fenêtre glissante) reste appliquée en plus.

### Fonctionnement dans le moteur d'envoi

* Un limiteur par relais (`internal/manager/relay.go`) réserve chaque envoi de campagne.
* Quand un relais est à sa limite, **seule la campagne concernée attend** : ses abonnés restants sont gardés
  de côté, et la campagne est remise en file à l'heure où le relais peut renvoyer. Les autres campagnes
  continuent. (La fenêtre glissante d'upstream, elle, endort tout le moteur.)
* Une campagne mise en pause ou annulée pendant l'attente s'arrête en moins de 15 secondes.
* Les e-mails transactionnels et de notification ne sont pas freinés mais comptent dans l'usage du relais.
* Les compteurs du jour sont enregistrés dans la table `relay_usage` (migration `v7.4.0`) à chaque cycle et à
  la fermeture : un redémarrage ne remet pas le quota ni le warm-up à zéro.

### Redémarrage pendant l'attente

Upstream refuse d'appliquer un changement de réglages tant qu'une campagne tourne. Avec des quotas journaliers,
une campagne peut attendre des heures : le fork autorise donc le redémarrage quand **toutes** les campagnes en
cours ne font qu'attendre leur relais et qu'aucun e-mail n'est en cours d'envoi. Le moteur enregistre alors
l'avancement de chaque campagne et les compteurs des relais avant de s'arrêter ; la campagne reprend ensuite
au même point. C'est un premier morceau du lot 6 (fiabilité au redémarrage).

## API

| Méthode | Route | Permission |
|---|---|---|
| GET | `/api/relays` | `settings:get`, `campaigns:manage` ou `campaigns:manage_all` |
| PUT | `/api/relays/:uuid` | `settings:manage`, corps `{"project_id", "cadence", "warmup", "system"}` |

`GET` renvoie le relais par défaut puis les serveurs partagés et ceux du projet courant, avec leur usage du jour
(`status` : envoyés, plafond du jour, jour de warm-up, ouvert ou non, prochain envoi possible).

## Écrans

* **Relais d'envoi** : liste des relais avec leur cadence et leur usage, réglage du projet, de la cadence, de la
  plage d'envoi, du warm-up (avec la courbe sur 30 jours) et du rôle de relais système. L'hôte et les
  identifiants restent dans les réglages de l'ancienne interface.
* **Nouvelle campagne** : choix parmi les relais du projet, avec ce qui reste aujourd'hui et la fin estimée.
* **Aujourd'hui** : envois du jour et quota de chaque relais qui a une cadence ou a servi.
