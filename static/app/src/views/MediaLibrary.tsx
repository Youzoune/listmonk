import { useState } from 'react';
import { useDeleteMedia, useMedia, useUploadMedia } from '../api/hooks';
import { ErrorState, Icon, Loading } from '../components/ui';
import { date } from '../lib/format';
import { useProject } from '../project';

// Images and files to use in campaigns and templates, per project.
export function MediaLibrary() {
  const { project, can } = useProject();
  const media = useMedia(project.id);
  const upload = useUploadMedia(project.id);
  const del = useDeleteMedia(project.id);
  const [copied, setCopied] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const canManage = can('media:manage');

  const copy = async (id: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* the URL stays visible to copy by hand */ }
  };

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">{project.name}</p>
          <h1>Médias</h1>
        </div>
        {canManage && (
          <label className="btn btn-primary" htmlFor="media-upload">
            <Icon name="plus" /> {upload.isPending ? 'Envoi…' : 'Ajouter des fichiers'}
            <input id="media-upload" type="file" multiple hidden accept="image/*,.pdf"
              onChange={async (e) => {
                const files = [...(e.target.files ?? [])];
                // One file at a time; the first error stops and shows.
                for (const f of files) {
                  try { await upload.mutateAsync(f); } catch { break; }
                }
                e.target.value = '';
              }} />
          </label>
        )}
      </header>
      <p className="small muted">Images et documents à insérer dans les campagnes et les modèles : copiez l’adresse d’un fichier et collez-la dans le contenu.</p>
      {upload.isError && <ErrorState error={upload.error} />}

      {media.isPending ? <Loading /> : media.isError ? <ErrorState error={media.error} retry={() => media.refetch()} /> : (
        media.data.results.length === 0 ? <p className="empty panel">Aucun fichier pour l’instant.</p> : (
          <ul className="media-grid">
            {media.data.results.map((m) => (
              <li key={m.id} className="panel media-card">
                <div className="media-thumb">
                  {m.thumb_url ? <img src={m.thumb_url} alt="" loading="lazy" /> : <Icon name="page" size={32} />}
                </div>
                <p className="strong small media-name" title={m.filename}>{m.filename}</p>
                <p className="sub">{date(m.created_at)}</p>
                <div className="row-gap">
                  <button type="button" className="btn btn-sm" onClick={() => copy(m.id, m.url)}>{copied === m.id ? 'Copiée' : 'Copier l’adresse'}</button>
                  <a className="btn btn-sm btn-ghost" href={m.url} target="_blank" rel="noreferrer">Ouvrir</a>
                  {canManage && (confirm === m.id
                    ? <button type="button" className="btn btn-sm btn-danger" onClick={() => del.mutate(m.id, { onSettled: () => setConfirm(null) })}>Confirmer</button>
                    : <button type="button" className="btn btn-sm btn-ghost" aria-label={`Supprimer ${m.filename}`} onClick={() => setConfirm(m.id)}><Icon name="x" size={14} /></button>)}
                </div>
              </li>
            ))}
          </ul>
        )
      )}
      {del.isError && <ErrorState error={del.error} />}
    </div>
  );
}
