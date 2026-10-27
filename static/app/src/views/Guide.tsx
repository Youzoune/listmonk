import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { Icon } from '../components/ui';
import { num } from '../lib/format';
import { warmupCap, warmupDoneDay } from '../lib/sending';

const SECTIONS = [
  { id: 'spam', title: 'Pourquoi un e-mail finit en spam' },
  { id: 'reputation', title: 'La réputation de l’expéditeur' },
  { id: 'warmup', title: 'Le warm-up' },
  { id: 'cadence', title: 'La cadence' },
  { id: 'authentification', title: 'SPF, DKIM et DMARC' },
  { id: 'reflexes', title: 'Les bons réflexes' },
  { id: 'alertes', title: 'Les signaux d’alerte' },
  { id: 'glossaire', title: 'Petit glossaire' },
];

// The example of the warm-up section: 50 e-mails the first day, +20 % a day, up to 2 000.
const EXAMPLE = { enabled: true, start: 50, growth: 20, cap: 2000, since: new Date() };
const EXAMPLE_DAYS = [1, 2, 3, 5, 7, 10, 14, 18, 21];

function WarmupExample() {
  const done = warmupDoneDay(EXAMPLE);
  return (
    <figure className="ladder">
      <figcaption className="small muted">50 e-mails le premier jour, +20 % par jour, plafond de 2 000 :</figcaption>
      <ol>
        {EXAMPLE_DAYS.map((d) => (
          <li key={d}>
            <span className="sub">Jour {d}</span>
            <span className="strong num">{num(warmupCap(EXAMPLE, d))}</span>
          </li>
        ))}
      </ol>
      {done && <figcaption className="small muted">Le plafond de 2 000 est atteint au jour {done}, soit environ {Math.round(done / 7)} semaines.</figcaption>}
    </figure>
  );
}

export function Guide() {
  const { hash } = useLocation();

  // The router doesn't scroll to anchors on its own.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="view guide">
      <header className="view-head">
        <div>
          <p className="eyebrow">Guide</p>
          <h1>Arriver en boîte de réception</h1>
          <p className="lead">Ce qu’il faut savoir sur le spam, le warm-up et la cadence d’envoi, sans jargon. Dix minutes de lecture.</p>
        </div>
      </header>

      <div className="guide-layout">
        <nav className="guide-toc" aria-label="Sommaire du guide">
          <p className="eyebrow">Sommaire</p>
          <ol>
            {SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}
          </ol>
          <Link className="btn btn-sm" to="/relais"><Icon name="relay" size={15} /> Régler mes relais</Link>
        </nav>

        <article className="guide-body">
          <section id="spam">
            <h2>Pourquoi un e-mail finit en spam</h2>
            <p>
              Gmail, Outlook, Orange ou Yahoo reçoivent des milliards d’e-mails par jour. Pour protéger leurs utilisateurs, ils
              trient chaque message en quelques millisecondes et se posent trois questions :
            </p>
            <ul>
              <li><strong>Qui envoie ?</strong> L’expéditeur est-il bien celui qu’il prétend être, et a-t-il bonne réputation ?</li>
              <li><strong>Comment ?</strong> Le volume et le rythme ressemblent-ils à ceux d’un expéditeur normal, ou à une rafale suspecte ?</li>
              <li><strong>Qu’en pensent les destinataires ?</strong> Ouvrent-ils, répondent-ils, ou cliquent-ils sur « Signaler comme spam » ?</li>
            </ul>
            <p>
              Le contenu compte, mais beaucoup moins qu’on ne le croit : un message impeccable envoyé trop vite depuis un domaine
              inconnu finira en spam, alors qu’un message simple envoyé régulièrement à des gens qui l’attendent passera.
            </p>
          </section>

          <section id="reputation">
            <h2>La réputation de l’expéditeur</h2>
            <p>
              Chaque fournisseur tient une sorte de note de confiance pour votre <strong>domaine</strong> (ce qui suit le @ de
              l’adresse d’envoi) et pour l’<strong>adresse IP</strong> du serveur qui envoie. Cette note monte quand vos e-mails sont
              ouverts et attendus, et chute vite quand ils rebondissent ou sont signalés.
            </p>
            <p>
              Un domaine ou un serveur tout neuf n’a <strong>aucune réputation</strong> : ni bonne, ni mauvaise. Les fournisseurs se
              méfient donc de lui tant qu’il n’a pas fait ses preuves. C’est exactement à ça que sert le warm-up.
            </p>
          </section>

          <section id="warmup">
            <h2>Le warm-up</h2>
            <p>
              Le warm-up (« mise en température ») consiste à <strong>commencer petit et augmenter un peu chaque jour</strong>. Les
              fournisseurs voient arriver un volume modeste, observent que les destinataires réagissent bien, et vous font confiance
              pour un peu plus le lendemain.
            </p>
            <WarmupExample />
            <p>Dans Relais, un warm-up se règle avec quatre valeurs :</p>
            <dl className="guide-dl">
              <dt>Volume du 1er jour</dt>
              <dd>Combien d’e-mails au plus le premier jour. Pour un domaine neuf : 30 à 100.</dd>
              <dt>Hausse par jour</dt>
              <dd>De combien le plafond augmente chaque jour. 15 à 30 % est raisonnable ; au-delà de 50 %, le warm-up ne sert plus à grand-chose.</dd>
              <dt>Plafond</dt>
              <dd>Le volume visé à la fin du warm-up. Au-delà, le relais garde ce rythme de croisière.</dd>
              <dt>Mis en service le</dt>
              <dd>Le jour 1. Relais compte les jours à partir de cette date, même s’il redémarre.</dd>
            </dl>
            <p>
              Quand le plafond du jour est atteint, la campagne <strong>attend le lendemain toute seule</strong> et reprend là où elle
              s’était arrêtée. Les autres campagnes, sur d’autres relais, continuent pendant ce temps.
            </p>
            <p className="tip">
              <strong>Faut-il un warm-up ?</strong> Oui pour un nouveau domaine, un nouveau serveur, ou une liste qui n’a rien reçu
              depuis des mois. Non pour un relais réservé aux confirmations d’inscription, ni pour un prestataire (Brevo, Mailjet…)
              qui gère déjà la réputation de ses serveurs : là, il suffit de respecter ses limites.
            </p>
          </section>

          <section id="cadence">
            <h2>La cadence</h2>
            <p>
              La cadence, c’est le rythme d’envoi : combien d’e-mails par minute, par heure et par jour, et à quels moments. Elle sert
              à deux choses :
            </p>
            <ul>
              <li>
                <strong>Rester sous les limites de votre fournisseur.</strong> OVHcloud refuse au-delà de 200 e-mails par heure et par
                adresse, Google Workspace au-delà de 2 000 par jour… Dépasser bloque le compte pendant des heures. Les
                préconfigurations de Relais reprennent ces limites, avec une marge.
              </li>
              <li>
                <strong>Avoir l’air humain.</strong> Mille e-mails dans la même seconde ressemblent à du spam. Relais les espace
                régulièrement dans la minute.
              </li>
            </ul>
            <p>
              La <strong>plage d’envoi</strong> (jours et heures) évite d’envoyer la nuit ou le week-end, quand personne ne lit : un
              e-mail qui attend dix heures en haut de la boîte a moins de chances d’être ouvert.
            </p>
          </section>

          <section id="authentification">
            <h2>SPF, DKIM et DMARC</h2>
            <p>
              Ce sont trois réglages à faire <strong>une fois</strong>, dans la zone DNS de votre domaine (chez OVHcloud, Gandi,
              Cloudflare…). Ils prouvent que vos e-mails viennent bien de vous. Votre fournisseur d’envoi indique les valeurs exactes
              à recopier.
            </p>
            <dl className="guide-dl">
              <dt>SPF</dt>
              <dd>La liste des serveurs autorisés à envoyer pour votre domaine. Comme une liste d’invités à l’entrée.</dd>
              <dt>DKIM</dt>
              <dd>Une signature invisible ajoutée à chaque e-mail. Elle prouve qu’il n’a pas été modifié en route.</dd>
              <dt>DMARC</dt>
              <dd>La consigne donnée aux fournisseurs quand SPF ou DKIM échoue : ne rien faire, mettre en spam, ou refuser.</dd>
            </dl>
            <p className="tip">
              Depuis 2024, Gmail et Yahoo <strong>exigent</strong> SPF, DKIM et DMARC, ainsi qu’un lien de désinscription en un clic,
              pour tout expéditeur qui leur envoie plus de 5 000 e-mails par jour. En dessous, c’est très fortement conseillé.
            </p>
          </section>

          <section id="reflexes">
            <h2>Les bons réflexes</h2>
            <ul className="checklist">
              <li><Icon name="check" /> N’écrire qu’à des personnes qui ont demandé à recevoir vos e-mails. Jamais de fichier acheté.</li>
              <li><Icon name="check" /> Utiliser la double confirmation (l’abonné clique sur un lien pour confirmer) sur les formulaires publics.</li>
              <li><Icon name="check" /> Laisser un lien de désinscription bien visible : quelqu’un qui ne trouve pas comment partir clique sur « spam ».</li>
              <li><Icon name="check" /> Envoyer depuis une adresse à votre nom de domaine, jamais depuis une adresse @gmail.com.</li>
              <li><Icon name="check" /> Garder un rythme régulier : un envoi par semaine vaut mieux que rien pendant six mois puis une rafale.</li>
              <li><Icon name="check" /> Retirer les adresses qui rebondissent et celles qui n’ont rien ouvert depuis un an.</li>
              <li><Icon name="check" /> Écrire un objet honnête, éviter les pièces jointes et les messages faits d’une seule grande image.</li>
            </ul>
          </section>

          <section id="alertes">
            <h2>Les signaux d’alerte</h2>
            <p>Si l’un de ces signaux apparaît, ralentissez la cadence (ou baissez le plafond du warm-up) et nettoyez la liste.</p>
            <div className="table-wrap">
              <table className="table guide-table">
                <thead><tr><th scope="col">Signal</th><th scope="col">Bon</th><th scope="col">À surveiller</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Rebonds (adresses qui n’existent pas)</th><td>moins de 2 %</td><td>au-delà de 2 % : liste trop ancienne ou mal collectée</td></tr>
                  <tr><th scope="row">Signalements comme spam</th><td>moins de 0,1 %</td><td>Gmail sanctionne au-delà de 0,3 %</td></tr>
                  <tr><th scope="row">Taux d’ouverture</th><td>stable d’un envoi à l’autre</td><td>une chute brutale signale souvent une arrivée en spam</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Les rebonds sont listés dans l’ancienne interface, rubrique Abonnés › Rebonds. Google propose aussi les <em>Postmaster Tools</em>, gratuits,
              pour suivre la réputation de votre domaine chez Gmail.
            </p>
          </section>

          <section id="glossaire">
            <h2>Petit glossaire</h2>
            <dl className="guide-dl">
              <dt>Relais (ou serveur SMTP)</dt>
              <dd>Le serveur qui envoie réellement vos e-mails : celui de votre hébergeur, de Google, de Brevo…</dd>
              <dt>Délivrabilité</dt>
              <dd>La part de vos e-mails qui arrive en boîte de réception, et pas en spam ni nulle part.</dd>
              <dt>Rebond (bounce)</dt>
              <dd>Un e-mail refusé et renvoyé à l’expéditeur, souvent parce que l’adresse n’existe plus.</dd>
              <dt>Notifications système</dt>
              <dd>Les e-mails que Relais envoie de lui-même : confirmation d’inscription, alertes à l’équipe, mot de passe oublié.</dd>
              <dt>Liste blanche, liste noire</dt>
              <dd>Des listes publiques d’expéditeurs de confiance ou de spammeurs, consultées par les fournisseurs.</dd>
            </dl>
          </section>
        </article>
      </div>
    </div>
  );
}
