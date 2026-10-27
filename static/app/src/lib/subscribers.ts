// Contact attributes as editable rows. Text stays text; a value that was a
// number, a boolean or an object is written back as JSON and read again as
// such, so nothing is lost by editing a contact here.

export interface AttrRow {
  key: string;
  value: string;
  // The value was not a string: parse it back from JSON.
  json?: boolean;
}

export function attribsToRows(attribs: Record<string, unknown>): AttrRow[] {
  return Object.entries(attribs ?? {}).map(([key, v]) => (typeof v === 'string'
    ? { key, value: v }
    : { key, value: JSON.stringify(v), json: true }));
}

export function attribsFromRows(rows: AttrRow[]): { attribs?: Record<string, unknown>; error?: string } {
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k && !r.value.trim()) continue;
    if (!k) return { error: 'Chaque attribut a besoin d’un nom.' };
    if (k in out) return { error: `L’attribut « ${k} » apparaît deux fois.` };
    if (r.json) {
      try {
        out[k] = JSON.parse(r.value);
      } catch {
        return { error: `La valeur de « ${k} » n’est plus un JSON valide.` };
      }
    } else {
      out[k] = r.value;
    }
  }
  return { attribs: out };
}
