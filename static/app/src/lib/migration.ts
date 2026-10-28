// Importing another listmonk instance: which project each list goes to.
// Lists are often named "<Marque> - <liste>": the brand is the project.
import { slugify } from './projects';

export function brandOf(name: string): string | null {
  const m = /^\s*([^-–·|:]+?)\s*[-–·|:]\s+\S/.exec(name);
  return m ? m[1].trim() : null;
}

// The project of a list or template: the one named like its brand.
export function suggestProject(name: string, projects: { id: number; name: string; slug: string }[]): number | null {
  const brand = brandOf(name);
  if (!brand) return null;
  const s = slugify(brand);
  return projects.find((p) => p.slug === s || slugify(p.name) === s)?.id ?? null;
}

// The brands that have no project yet, in the order they appear.
export function missingBrands(names: string[], projects: { id: number; name: string; slug: string }[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    const b = brandOf(n);
    if (b && suggestProject(n, projects) === null && !out.some((x) => slugify(x) === slugify(b))) out.push(b);
  }
  return out;
}

// The installer's own templates, not worth importing.
export const isStockTemplate = (name: string) => /^(Default|Sample) /.test(name);
