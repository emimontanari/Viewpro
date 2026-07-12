export const propertyTypeOptions = [
  { value: 'HOUSE', label: 'Casa' },
  { value: 'APARTMENT', label: 'Departamento' },
  { value: 'LAND', label: 'Terreno' },
  { value: 'COMMERCIAL', label: 'Comercial' },
  { value: 'OTHER', label: 'Otro' }
];

export const operationTypeOptions = [
  { value: 'SALE', label: 'Venta' },
  { value: 'RENT', label: 'Alquiler' }
];

export const currencyOptions = [
  { value: 'ARS', label: 'ARS' },
  { value: 'USD', label: 'USD' }
];

export const propertyStatusOptions = [
  { value: 'CAPTURE', label: 'Captación' },
  { value: 'DOCUMENTATION_PENDING', label: 'Documentación pendiente' },
  { value: 'PUBLICATION_PREPARATION', label: 'Preparando publicación' },
  { value: 'ACTIVE_PUBLICATION', label: 'Publicación activa' },
  { value: 'INQUIRIES_AND_VISITS', label: 'Consultas y visitas' },
  { value: 'OFFER_NEGOTIATION', label: 'Negociación' },
  { value: 'RESERVATION_STARTED', label: 'Reserva iniciada' },
  { value: 'FINAL_DOCUMENTATION', label: 'Documentación final' },
  { value: 'CLOSED', label: 'Cerrada' },
  { value: 'CANCELLED', label: 'Cancelada' }
];

export const archiveFilterOptions = [
  { label: 'Activas', value: 'active' },
  { label: 'Archivadas', value: 'archived' },
  { label: 'Todas', value: 'all' }
];

// Backwards-compatible export name while product-named modules are migrated.
export const categoryOptions = operationTypeOptions;
