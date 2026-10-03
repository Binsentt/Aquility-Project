module.exports = ({ config }) => {
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  if (!apiKey) return config;

  const android = config.android || {};
  const androidConfig = android.config || {};
  return {
    ...config,
    android: {
      ...android,
      config: {
        ...androidConfig,
        googleMaps: {
          ...androidConfig.googleMaps,
          apiKey,
        },
      },
    },
  };
};
