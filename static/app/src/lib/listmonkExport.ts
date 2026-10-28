// The script that exports a listmonk instance from its own admin page, in
// the browser of someone signed in: no API user or token needed. It saves
// the API responses as a file that "Importer depuis listmonk" reads
// (cmd/migrate.go, lmBundle). Passwords are never in it: the API masks them.
export const LISTMONK_EXPORT_SCRIPT = `(async () => {
  const g = async (p) => {
    const r = await fetch(p, { credentials: 'same-origin' });
    if (!r.ok) throw new Error(p + ' : ' + r.status);
    return (await r.json()).data;
  };
  const lists = (await g('/api/lists?per_page=all&minimal=false')).results;
  const subscribers = [];
  for (let page = 1; ; page++) {
    const d = await g('/api/subscribers?per_page=1000&page=' + page + '&order_by=id&order=asc');
    subscribers.push(...d.results);
    if (d.results.length < 1000) break;
  }
  const templates = [];
  for (const t of await g('/api/templates?no_body=true')) templates.push(await g('/api/templates/' + t.id));
  const campaigns = (await g('/api/campaigns?per_page=all')).results;
  let smtp = null;
  try { smtp = (await g('/api/settings')).smtp.map(({ password, ...s }) => s); } catch (e) { /* needs the settings permission */ }
  const bundle = { format: 'relais-listmonk-export/1', source: location.origin, exported_at: new Date().toISOString(),
    lists, subscribers, templates, campaigns, smtp };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(bundle)], { type: 'application/json' }));
  a.download = 'listmonk-export-' + location.hostname + '.json';
  a.click();
  return { lists: lists.length, subscribers: subscribers.length, templates: templates.length, campaigns: campaigns.length };
})()`;
