export type CargoCategory = 'ELECTRONICS' | 'RAW_MATERIALS' | 'MEDS_BEVERAGE';

export function requiredDocsForCategory(category: CargoCategory): string[] {
  const base = ['BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'PACKING_LIST'];
  switch (category) {
    case 'ELECTRONICS':
      return [...base, 'TYPE_APPROVAL'];
    case 'RAW_MATERIALS':
      return [...base];
    case 'MEDS_BEVERAGE':
      return [...base, 'IMPORT_LICENSE'];
  }
}

export function formatLabel(value: string): string {
  if (value === 'WH7_DOC') return 'WH7';
  if (value === 'EXIT_NOTE') return 'Exit note';
  return value.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}
