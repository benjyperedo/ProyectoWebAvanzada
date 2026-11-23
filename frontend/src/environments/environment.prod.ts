import { Capacitor } from '@capacitor/core';

export const environment = {
  production: true,
  apiUrl: Capacitor.isNativePlatform()
    ? 'https://listoco-staging-980.mexicocentral.cloudapp.azure.com/api'
    : '/api',
};