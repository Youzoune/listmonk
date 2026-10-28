import { Link } from 'react-router';
import { useCampaigns, useDashboard, useRelays } from '../api/hooks';
import type { Campaign } from '../api/types';
import { CampaignChip, Chip, ErrorState, Icon, Loading, Progress, Sparkline } from '../components/ui';
import { count, dateTime, num, percent, relayLabel } from '../lib/format';
import { useProject } from '../project';
import { relayName } from '../lib/relays';

const BOUNCE_ALERT = 0.03;

const sum = (a: { count: number }[] | null | undefined) => (a ?? []).reduce((n, x) => n + x.count, 0);
const series = (a: { count: number }[] | null | undefined) => (a ?? []).slice(-14).map((x) => x.count);

function Running({ c }: { c: Campaign }) {
  return (
    <li className="running">
      <div className="running-top">
        <Link to={`/campagnes?q=${encodeURIComponent(c.name)}`} className="strong plain-link">{c.name}</Link>
        <CampaignChip status={c.status} />
      </div>
      <Progress value={c.sent} max={c.to_send} tone={c.status === 'paused' ? 'warn' : 'run'} label={`${c.sent} sur ${c.to_send} envoyés`} />
      <p className="muted small num">{num(c.sent)} / {num(c.to_send)} envoyés · via {relayLabel(c.messenger)}</p>
    </li>
  );
}

export function Home() {
  const { project, can } = useProject();
  const { counts, charts } = useDashboard(project.id);
  const canCampaigns = can('campaigns:get_all', 'campaigns:get');
  const active = useCampaigns(project.id, { status: ['running', 'paused'], perPage: 10 });
  const scheduled = useCampaigns(project.id, { status: ['scheduled'], perPage: 5 });
  const finished = useCampaigns(project.id, { status: ['finished'], perPage: 20 });
  const canRelays = can('settings:get', 'campaigns:manage', 'campaigns:manage_all');
  const relays = useRelays(project.id, canRelays);
  // Relays worth a look today: those with a cadence of their own or that sent something.
  const busyRelays = (relays.data ?? []).filter((r) => r.enabled && r.status && (r.status.has_cadence || r.status.sent_today > 0));

  // Nothing can leave while every server is one of the installer's examples.
  const noRealServer = !!relays.data && relays.data.every((r) => r.example || !r.enabled || (!r.pool && !r.name));

  const alerts: { tone: 'bad' | 'warn'; text: string }[] = [];
  for (const c of [...(active.data?.results ?? []), ...(finished.data?.results ?? [])]) {
    if (c.sent >= 20 && c.bounces / c.sent >= BOUNCE_ALERT) {
      alerts.push({ tone: 'bad', text: `« ${c.name} » : ${percent(c.bounces, c.sent)} de rebonds. Au-delà de 3 %, la réputation du relais est en jeu.` });
    }
  }
  for (const c of active.data?.results ?? []) {
    if (c.status === 'paused') alerts.push({ tone: 'warn', text: `« ${c.name} » est en pause à ${percent(c.sent, c.to_send)}.` });
  }

  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const ch = charts.data;

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Aujourd’hui sur {project.name}</h1>
        </div>
        {can('campaigns:manage_all', 'campaigns:manage') && (
          <Link className="btn btn-primary" to="/campagnes/nouvelle"><Icon name="plus" /> Nouvelle campagne</Link>
        )}
      </header>

      {noRealServer && (
        <div className="alert alert-bad alert-stack" role="alert">
          <p className="strong">Aucun serveur d’envoi configuré : vos campagnes ne partiront pas.</p>
          <p className="small">Relais a besoin de l’adresse d’envoi de votre domaine (OVH, Google, Microsoft, Brevo…). Deux minutes suffisent.</p>
          {can('settings:manage') && <Link className="btn btn-primary self-start" to="/relais/nouveau"><Icon name="plus" /> Configurer mon serveur d’envoi</Link>}
        </div>
      )}

      {alerts.length > 0 && (
        <section className="alerts" aria-label="À surveiller">
          {alerts.map((a, i) => (
            <div key={i} className={`alert alert-${a.tone}`}>
              <Icon name="alert" />
              <p>{a.text}</p>
            </div>
          ))}
        </section>
      )}

      {counts.isError ? <ErrorState error={counts.error} retry={() => counts.refetch()} /> : (
        <dl className="kpi-strip">
          <div><dt>Contacts</dt><dd className="num">{counts.data ? num(counts.data.subscribers.total) : '…'}</dd>
            <dd className="sub">{counts.data ? `${num(counts.data.subscribers.blocklisted)} en liste noire` : ''}</dd></div>
          <div><dt>Listes</dt><dd className="num">{counts.data ? num(counts.data.lists.total) : '…'}</dd>
            <dd className="sub">{counts.data ? `${count(counts.data.lists.public, 'publique')}, ${count(counts.data.lists.private, 'privée')}` : ''}</dd></div>
          <div><dt>Campagnes</dt><dd className="num">{counts.data ? num(counts.data.campaigns.total) : '…'}</dd>
            <dd className="sub">{counts.data ? count(counts.data.campaigns.by_status.draft ?? 0, 'brouillon') : ''}</dd></div>
          <div><dt>E-mails envoyés</dt><dd className="num">{counts.data ? num(counts.data.messages) : '…'}</dd>
            <dd className="sub">depuis le début</dd></div>
        </dl>
      )}

      {busyRelays.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>Envois du jour, par relais</h2>
            <Link className="link" to="/relais">Gérer les relais <Icon name="arrow" size={15} /></Link>
          </div>
          <div className="relay-today">
            {busyRelays.map((r) => {
              const s = r.status!;
              const pct = s.limit_today > 0 ? Math.min(100, (s.sent_today / s.limit_today) * 100) : 0;
              return (
                <div key={r.uuid || r.name} className="relay-today-item">
                  <div className="relay-today-top">
                    <strong>{relayName(r)}</strong>
                    {!s.open_now ? <Chip tone="warn" icon="clock">Hors plage</Chip>
                      : s.warmup_day > 0 && s.warmup_done_day > 0 && s.warmup_day < s.warmup_done_day
                        ? <Chip tone="brand">Warm-up · jour {s.warmup_day} sur {s.warmup_done_day}</Chip>
                        : s.limit_today > 0 && s.sent_today >= s.limit_today ? <Chip tone="warn">Quota atteint</Chip>
                          : <Chip tone="ok" icon="check">Disponible</Chip>}
                  </div>
                  <div className="quota">
                    {s.limit_today > 0 && <div className="quota-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>}
                    <div className="quota-legend num">
                      <span><strong>{num(s.sent_today)}</strong> envoyés</span>
                      <span>{s.limit_today > 0 ? `${num(Math.max(0, s.limit_today - s.sent_today))} restants sur ${num(s.limit_today)}` : 'pas de plafond'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid-2">
        {canCampaigns && (
          <section className="panel">
            <div className="panel-head">
              <h2>En cours d’envoi</h2>
              <Link className="link" to="/campagnes">Toutes les campagnes <Icon name="arrow" size={15} /></Link>
            </div>
            {active.isPending ? <Loading /> : active.isError ? <ErrorState error={active.error} /> :
              active.data.results.length === 0 ? <p className="muted">Aucune campagne en cours.</p> : (
                <ul className="stack-list">{active.data.results.map((c) => <Running key={c.id} c={c} />)}</ul>
              )}
            {scheduled.data && scheduled.data.results.length > 0 && (
              <div className="upcoming">
                <h3>Prochains départs</h3>
                {scheduled.data.results.map((c) => (
                  <div key={c.id} className="upcoming-item">
                    <Icon name="clock" size={16} />
                    <span>
                      <span className="strong">{c.name}</span>
                      <span className="sub">{dateTime(c.send_at)} · {c.lists.map((l) => l.name).join(', ')}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="panel">
          <div className="panel-head">
            <h2>Les 30 derniers jours</h2>
          </div>
          {charts.isPending ? <Loading /> : charts.isError ? <ErrorState error={charts.error} /> : (
            <dl className="kpis">
              <div>
                <dt>Ouvertures</dt>
                <dd className="num">{num(sum(ch?.campaign_views))}</dd>
                <dd><Sparkline values={series(ch?.campaign_views)} label="Ouvertures par jour" /></dd>
              </div>
              <div>
                <dt>Clics</dt>
                <dd className="num">{num(sum(ch?.link_clicks))}</dd>
                <dd><Sparkline values={series(ch?.link_clicks)} label="Clics par jour" /></dd>
              </div>
            </dl>
          )}
          <p className="small muted">Les statistiques du tableau de bord sont recalculées périodiquement par listmonk.</p>
        </section>
      </div>
    </div>
  );
}
