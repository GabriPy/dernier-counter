import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import 'vuetify/styles';

/**
 * Tema "tavolo da carte": panno verde scuro, dettagli oro.
 */
export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dernierDark',
    themes: {
      dernierDark: {
        dark: true,
        colors: {
          background: '#0B1A12',
          surface: '#12281C',
          'surface-variant': '#1B3A28',
          'surface-bright': '#1F4530',
          primary: '#1DB954',
          'primary-darken-1': '#169343',
          secondary: '#D4AF37',
          'secondary-darken-1': '#A98A26',
          accent: '#F2C94C',
          error: '#E5484D',
          info: '#4FA3E3',
          success: '#2FBF71',
          warning: '#E2B03C',
          'on-background': '#EAF4EC',
          'on-surface': '#EAF4EC',
        },
      },
    },
  },
  defaults: {
    VCard: { rounded: 'xl', elevation: 6 },
    VBtn: { rounded: 'lg' },
    VTextField: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
    VSelect: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
    VTable: { density: 'comfortable' },
    VChip: { rounded: 'lg' },
  },
});
