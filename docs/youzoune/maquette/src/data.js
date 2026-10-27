// Example data for the Relais mock-up. None of it is real.

export const TODAY = new Date(2026, 9, 27, 10, 15); // mardi 27 octobre 2026, 10 h 15

export const projects = [
  {
    id: 'wesportive',
    name: 'WeSportive',
    domain: 'envoi.wesportive.fr',
    color: '#2F7D5B',
    initials: 'WS',
    from: 'Ahmed de WeSportive <ahmed@wesportive.fr>',
  },
  {
    id: 'youzoune',
    name: 'Youzoune',
    domain: 'news.youzoune.com',
    color: '#5B4BC4',
    initials: 'YZ',
    from: 'Youzoune <bonjour@youzoune.com>',
  },
];

// Sending servers ("relais"). Each one belongs to a project, except the system relay.
export const relays = [
  {
    id: 'ses-sport', project: 'wesportive', name: 'SES — prospection sport', provider: 'Amazon SES',
    host: 'email-smtp.eu-west-3.amazonaws.com', status: 'active',
    perMinute: 2, perHour: 60, perDay: 400,
    days: [1, 2, 3, 4, 5], fromHour: 8, toHour: 18,
    warmup: { enabled: true, start: 30, growth: 15, cap: 400, since: new Date(2026, 9, 16) },
    sentToday: 74, bounceRate: 1.4, complaintRate: 0.02,
  },
  {
    id: 'brevo-relances', project: 'wesportive', name: 'Brevo — relances', provider: 'Brevo',
    host: 'smtp-relay.brevo.com', status: 'active',
    perMinute: 1, perHour: 40, perDay: 250,
    days: [1, 2, 3, 4, 5], fromHour: 9, toHour: 17,
    warmup: { enabled: false, start: 20, growth: 10, cap: 250, since: new Date(2026, 7, 1) },
    sentToday: 31, bounceRate: 0.8, complaintRate: 0,
  },
  {
    id: 'brevo-agences', project: 'youzoune', name: 'Brevo — agences', provider: 'Brevo',
    host: 'smtp-relay.brevo.com', status: 'paused',
    perMinute: 1, perHour: 30, perDay: 150,
    days: [1, 2, 3, 4], fromHour: 9, toHour: 12,
    warmup: { enabled: true, start: 15, growth: 12, cap: 150, since: new Date(2026, 9, 21) },
    sentToday: 0, bounceRate: 3.6, complaintRate: 0.1,
  },
  {
    id: 'postmark-systeme', project: null, name: 'Postmark — notifications', provider: 'Postmark',
    host: 'smtp.postmarkapp.com', status: 'active', system: true,
    perMinute: 20, perHour: 600, perDay: 5000,
    days: [0, 1, 2, 3, 4, 5, 6], fromHour: 0, toHour: 24,
    warmup: { enabled: false, start: 0, growth: 0, cap: 5000, since: new Date(2025, 0, 10) },
    sentToday: 12, bounceRate: 0.1, complaintRate: 0,
  },
];

export const lists = [
  { id: 1, project: 'wesportive', name: 'Clubs sportifs — Île-de-France', count: 412, kind: 'Prospection' },
  { id: 2, project: 'wesportive', name: 'Clubs sportifs — Rhône-Alpes', count: 268, kind: 'Prospection' },
  { id: 3, project: 'wesportive', name: 'Newsletter WeSportive', count: 1190, kind: 'Newsletter' },
  { id: 4, project: 'youzoune', name: 'Agences web — Lyon', count: 96, kind: 'Prospection' },
  { id: 5, project: 'youzoune', name: 'Clients Youzoune', count: 38, kind: 'Clients' },
];

export const campaigns = [
  {
    id: 11, project: 'wesportive', name: 'Relance J+4 — clubs IDF', subject: 'Votre club est déjà sur WeSportive',
    status: 'running', list: 1, relay: 'ses-sport', total: 412, sent: 238, opens: 41, clicks: 9, bounces: 3, replies: 6,
    eta: 'jeudi 29 oct., 15 h',
  },
  {
    id: 12, project: 'wesportive', name: 'Premier contact — clubs Rhône-Alpes', subject: 'Gérer les licences sans tableur',
    status: 'scheduled', list: 2, relay: 'brevo-relances', total: 268, sent: 0, opens: 0, clicks: 0, bounces: 0, replies: 0,
    eta: 'départ lundi 2 nov., 9 h',
  },
  {
    id: 13, project: 'wesportive', name: 'Newsletter d’octobre', subject: 'Les nouveautés de WeSportive',
    status: 'finished', list: 3, relay: 'brevo-relances', total: 1190, sent: 1190, opens: 512, clicks: 87, bounces: 9, replies: 0,
    eta: 'terminée le 22 oct.',
  },
  {
    id: 14, project: 'wesportive', name: 'Premier contact — clubs IDF', subject: 'Gérer les licences sans tableur',
    status: 'finished', list: 1, relay: 'ses-sport', total: 412, sent: 412, opens: 133, clicks: 21, bounces: 6, replies: 14,
    eta: 'terminée le 21 oct.',
  },
  {
    id: 15, project: 'wesportive', name: 'Salon des sports — invitation', subject: 'Venez nous voir au stand B12',
    status: 'draft', list: 3, relay: null, total: 1190, sent: 0, opens: 0, clicks: 0, bounces: 0, replies: 0,
    eta: '',
  },
  {
    id: 21, project: 'youzoune', name: 'Agences web — offre partenaire', subject: 'Un partenariat pour vos clients sport',
    status: 'paused', list: 4, relay: 'brevo-agences', total: 96, sent: 41, opens: 12, clicks: 2, bounces: 4, replies: 1,
    eta: 'en pause : taux de rebond élevé',
  },
  {
    id: 22, project: 'youzoune', name: 'Clients — bilan de l’année', subject: 'Votre année avec Youzoune',
    status: 'draft', list: 5, relay: null, total: 38, sent: 0, opens: 0, clicks: 0, bounces: 0, replies: 0,
    eta: '',
  },
];

export const contacts = [
  { name: 'Camille Martin', email: 'camille.martin@as-creteil.example', org: 'AS Créteil Handball', city: 'Créteil', status: 'active', engagement: 3, lists: [1], last: 'a ouvert « Relance J+4 » il y a 2 h', project: 'wesportive' },
  { name: 'Hugo Bernard', email: 'hugo.bernard@fc-versailles.example', org: 'FC Versailles 78', city: 'Versailles', status: 'active', engagement: 2, lists: [1, 3], last: 'a cliqué il y a 1 j', project: 'wesportive' },
  { name: 'Inès Benali', email: 'ines.benali@judo-vincennes.example', org: 'Judo Club Vincennes', city: 'Vincennes', status: 'replied', engagement: 3, lists: [1], last: 'a répondu il y a 3 h', project: 'wesportive' },
  { name: 'Lucas Petit', email: 'lucas.petit@rugby-massy.example', org: 'Rugby Massy Essonne', city: 'Massy', status: 'active', engagement: 1, lists: [1], last: 'envoyé hier', project: 'wesportive' },
  { name: 'Manon Leroy', email: 'manon.leroy@tennis-lyon.example', org: 'Tennis Club Lyon 7', city: 'Lyon', status: 'active', engagement: 0, lists: [2], last: 'pas encore contactée', project: 'wesportive' },
  { name: 'Nathan Moreau', email: 'nathan.moreau@basket-grenoble.example', org: 'Grenoble Basket', city: 'Grenoble', status: 'unsubscribed', engagement: 1, lists: [2], last: 's’est désinscrit le 22 oct.', project: 'wesportive' },
  { name: 'Sarah Garcia', email: 's.garcia@natation-boulogne.example', org: 'Natation Boulogne', city: 'Boulogne', status: 'bounced', engagement: 0, lists: [1], last: 'adresse invalide (rebond)', project: 'wesportive' },
  { name: 'Théo Simon', email: 'theo.simon@volley-annecy.example', org: 'Annecy Volley', city: 'Annecy', status: 'active', engagement: 2, lists: [2, 3], last: 'a ouvert la newsletter', project: 'wesportive' },
  { name: 'Zoé Laurent', email: 'zoe@studio-presquile.example', org: 'Studio Presqu’île', city: 'Lyon', status: 'replied', engagement: 3, lists: [4], last: 'a répondu il y a 1 j', project: 'youzoune' },
  { name: 'Karim Fournier', email: 'karim@agence-confluence.example', org: 'Agence Confluence', city: 'Lyon', status: 'active', engagement: 1, lists: [4], last: 'a ouvert il y a 4 j', project: 'youzoune' },
  { name: 'Julie Roux', email: 'julie.roux@pixel-croix-rousse.example', org: 'Pixel Croix-Rousse', city: 'Lyon', status: 'bounced', engagement: 0, lists: [4], last: 'boîte pleine (rebond temporaire)', project: 'youzoune' },
  { name: 'Antoine Girard', email: 'antoine@girard-conseil.example', org: 'Girard Conseil', city: 'Villeurbanne', status: 'active', engagement: 2, lists: [5], last: 'client depuis 2024', project: 'youzoune' },
];

export const week = {
  wesportive: { opens: [22, 31, 18, 40, 52, 47, 41], clicks: [4, 6, 3, 8, 11, 9, 9], bounces: [1, 0, 2, 1, 1, 0, 3] },
  youzoune: { opens: [3, 5, 2, 6, 4, 7, 5], clicks: [0, 1, 0, 1, 2, 1, 0], bounces: [0, 1, 0, 2, 1, 0, 1] },
};

export const DAY_LABELS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
