import { useSettings } from '../api/hooks';
import { Chip, ErrorState, Loading, Upcoming } from '../components/ui';
import { num } from '../lib/format';
import { useProject } from '../project';

export function Relays() {
  const { project, can } = useProject();
  const settings = useSettings(can('settings:get'));

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>Relais d’envoi</h1>
        </div>
        {can('settings:manage') && <a className="btn" href="/admin/settings">Modifier dans les réglages</a>}
      </header>

      {settings.isPending ? <Loading /> : settings.isError ? <ErrorState error={settings.error} retry={() => settings.refetch()} /> : (
        <>
          <div className="relay-grid">
            {settings.data.smtp.map((s, i) => (
              <section key={s.uuid || i} className="panel relay-card">
                <div className="relay-detail-head">
                  <div>
                    <h2>{s.name || `Serveur ${i + 1}`}</h2>
                    <p className="sub mono">{s.host}:{s.port}</p>
                  </div>
                  {s.enabled ? <Chip tone="ok" icon="check">Actif</Chip> : <Chip tone="neutral">Désactivé</Chip>}
                </div>
                <dl className="facts facts-row">
                  <div><dt>Campagnes</dt><dd>{s.name ? `Choisissable sous le nom « ${s.name} »` : 'Sans nom : seulement via le relais par défaut'}</dd></div>
                  <div><dt>Relais par défaut</dt><dd>{s.exclude_from_default ? 'Exclu' : 'Inclus'}</dd></div>
                  <div><dt>Connexions simultanées</dt><dd className="num">{s.max_conns}</dd></div>
                  <div><dt>Chiffrement</dt><dd>{s.tls_type === 'none' ? 'Aucun' : s.tls_type}</dd></div>
                </dl>
              </section>
            ))}
          </div>

          <section className="panel">
            <h2>Cadence actuelle</h2>
            <p className="muted small">Aujourd’hui, listmonk applique une seule cadence à toute l’instance, tous relais confondus.</p>
            <dl className="health">
              <div><dt>Envois en parallèle</dt><dd className="num big">{num(settings.data['app.concurrency'])}</dd></div>
              <div><dt>Par seconde et par envoi</dt><dd className="num big">{num(settings.data['app.message_rate'])}</dd></div>
              <div>
                <dt>Fenêtre glissante</dt>
                <dd className="num big">{settings.data['app.message_sliding_window']
                  ? `${num(settings.data['app.message_sliding_window_rate'])} / ${settings.data['app.message_sliding_window_duration']}`
                  : 'Désactivée'}</dd>
              </div>
            </dl>
            <Upcoming lot="Lot 4">Chaque relais aura sa cadence (par minute, heure et jour), sa plage d’envoi et son warm-up, et un relais dédié aux notifications du système.</Upcoming>
          </section>
        </>
      )}
    </div>
  );
}
