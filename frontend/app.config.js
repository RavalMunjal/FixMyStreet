const fs = require('fs');
const path = require('path');

export default ({ config }) => {
  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    '';

  const easProjectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    config?.extra?.eas?.projectId ||
    '';

  const googleServicesPath = path.join(__dirname, 'google-services.json');
  const hasGoogleServicesFile = fs.existsSync(googleServicesPath);

  const existingPlugins = Array.isArray(config.plugins) ? config.plugins : [];
  const filteredPlugins = existingPlugins.filter((p) => {
    const name = Array.isArray(p) ? p[0] : p;
    return name !== 'react-native-maps';
  });

  if (googleMapsApiKey) {
    filteredPlugins.push([
      'react-native-maps',
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
      },
    ]);
  }

  return {
    ...config,
    android: {
      ...config.android,
      ...(hasGoogleServicesFile ? { googleServicesFile: './google-services.json' } : {}),
      ...(googleMapsApiKey
        ? {
            config: {
              ...(config.android?.config || {}),
              googleMaps: {
                apiKey: googleMapsApiKey,
              },
            },
          }
        : {}),
    },
    extra: {
      ...(config.extra || {}),
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
    plugins: filteredPlugins,
  };
};
