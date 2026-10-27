import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useMedia } from '../api/hooks';
import { applyFormat, type Format } from '../lib/body';
import { useProject } from '../project';
import { Explain, Icon } from './ui';

const BUTTONS: { format: Format; label: string; text: string; className?: string }[] = [
  { format: 'bold', label: 'Gras', text: 'G', className: 'strong' },
  { format: 'italic', label: 'Italique', text: 'I', className: 'italic' },
  { format: 'heading', label: 'Titre', text: 'Titre' },
  { format: 'list', label: 'Liste à puces', text: 'Liste' },
  { format: 'link', label: 'Lien', text: 'Lien' },
];

// Formatting buttons above a campaign's text field. They write the marks
// that textToCampaignHTML understands, so the text stays readable.
export function FormatBar({ target, value, onChange }: {
  target: RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void;
}) {
  const { project, can } = useProject();
  const [picking, setPicking] = useState(false);
  const media = useMedia(project.id, picking);

  const apply = (format: Format, url?: string) => {
    const el = target.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const e = applyFormat(value, start, end, format, url);
    pending.current = e;
    onChange(e.value);
  };

  // Back in the field, with the part to type next selected, as soon as the
  // new text is in it (before any key typed next).
  const pending = useRef<{ start: number; end: number } | null>(null);
  useLayoutEffect(() => {
    const el = target.current;
    if (!pending.current || !el) return;
    el.focus();
    el.setSelectionRange(pending.current.start, pending.current.end);
    pending.current = null;
  }, [value, target]);

  const images = (media.data?.results ?? []).filter((m) => m.thumb_url);

  return (
    <div className="format-bar-wrap">
      <div className="format-bar" role="toolbar" aria-label="Mise en forme">
        {BUTTONS.map((b) => (
          <button key={b.format} type="button" className={`btn btn-sm btn-ghost ${b.className ?? ''}`} aria-label={b.label} title={b.label}
            onMouseDown={(e) => e.preventDefault()} onClick={() => apply(b.format)}>{b.text}</button>
        ))}
        {can('media:get') && (
          <button type="button" className="btn btn-sm btn-ghost" aria-expanded={picking} onClick={() => setPicking(!picking)}>Image</button>
        )}
      </div>
      {picking && (
        <div className="media-picker" role="group" aria-label="Choisir une image">
          {media.isPending ? <p className="small muted">Chargement…</p> : images.length === 0
            ? <p className="small muted">Aucune image : ajoutez-en dans <a className="link" href="/app/medias">Médias</a>.</p>
            : images.map((m) => (
              <button key={m.id} type="button" className="media-pick" aria-label={`Insérer ${m.filename}`}
                onClick={() => { apply('image', m.url); setPicking(false); }}>
                <img src={m.thumb_url} alt="" loading="lazy" />
              </button>
            ))}
          <button type="button" className="btn btn-sm btn-ghost" aria-label="Fermer" onClick={() => setPicking(false)}><Icon name="x" size={14} /></button>
        </div>
      )}
    </div>
  );
}

export function FormatHelp() {
  return (
    <Explain title="Mettre en forme le texte">
      <p>
        <span className="mono">**mots**</span> en gras, <span className="mono">*mots*</span> en italique,
        <span className="mono"> [texte](https://adresse)</span> pour un lien, une ligne qui commence par
        <span className="mono"> ## </span> pour un titre et par <span className="mono">- </span> pour une liste.
        Les boutons au-dessus du texte les écrivent pour vous.
      </p>
    </Explain>
  );
}
