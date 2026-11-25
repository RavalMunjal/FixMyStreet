export default ({ config }) => {
  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    '';

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
    plugins: filteredPlugins,
  };
};
