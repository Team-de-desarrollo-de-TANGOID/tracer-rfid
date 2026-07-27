export const APP_NAME = 'RFID TRACER';
export const APP_TAGLINE = 'Trazabilidad y gestión de activos con RFID';
export const APP_FULL_TITLE = `${APP_NAME} — ${APP_TAGLINE}`;
export const APP_VERSION = '0.2.0';

export const COMPANY = {
  legalName: 'TANGOID SRL',
  brand: 'TANGOID',
  website: 'https://www.tangoid.com.ar',
  websiteLabel: 'www.tangoid.com.ar',
  addressLines: [
    'Agustín Alvarez 3915',
    'Villa Martelli, CP 1603',
    'Buenos Aires, Argentina',
  ],
  phones: [
    { label: 'Central', value: '+54 (11) 6091-3333', tel: '+541160913333' },
    { label: 'Alternativo', value: '+54 (11) 5236-8777', tel: '+541152368777' },
  ],
  commercial: {
    label: 'Contacto comercial',
    email: 'ventas@tangoid.com.ar',
    hint: 'Consultas comerciales, cotizaciones y nuevas implementaciones.',
  },
  support: {
    label: 'Soporte técnico',
    email: 'soporte@tangoid.com.ar',
    hint: 'Asistencia técnica, incidencias y acompañamiento postventa.',
  },
  copyrightYear: new Date().getFullYear(),
} as const;
