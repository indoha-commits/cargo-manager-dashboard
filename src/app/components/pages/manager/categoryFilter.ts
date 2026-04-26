export type OpsCategory = '' | 'MEDS_BEVERAGE' | 'RAW_MATERIALS' | 'ELECTRONICS';

export function categoryLabel(cat: OpsCategory): string {
  if (!cat) return 'All categories';
  if (cat === 'MEDS_BEVERAGE') return 'Meds & Beverage';
  if (cat === 'RAW_MATERIALS') return 'Raw Materials';
  return 'Electronics';
}

export function matchesCategory(rowCategory: string | null | undefined, selected: OpsCategory): boolean {
  if (!selected) return true;
  return String(rowCategory ?? '') === selected;
}

