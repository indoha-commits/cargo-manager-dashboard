export type CargoCategory = 'ELECTRONICS' | 'RAW_MATERIALS' | 'MEDS_BEVERAGE';
export type ClearancePathway = 'PORT_CLEARANCE' | 'T1_TRANSIT';

export function requiredDocsForCategory(category: CargoCategory, pathway: ClearancePathway = 'PORT_CLEARANCE'): string[] {
  const base = ['BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'PACKING_LIST'];
  const categoryDocs = (() => {
    switch (category) {
      case 'ELECTRONICS':
        return ['TYPE_APPROVAL'];
      case 'RAW_MATERIALS':
        return [];
      case 'MEDS_BEVERAGE':
        return ['IMPORT_LICENSE'];
    }
  })();

  const pathwayDocs = pathway === 'T1_TRANSIT' ? ['T1_FORM'] : [];
  return [...base, ...categoryDocs, ...pathwayDocs];
}

export function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}
