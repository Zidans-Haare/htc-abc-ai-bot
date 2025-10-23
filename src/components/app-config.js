let configPromise;

const parseColorsToRoot = (branding) => {
  if (!branding || !branding.primary_color) {
    return;
  }
  const root = document.documentElement;
  const colorMap = {
    '--brand-primary': branding.primary_color,
    '--brand-secondary': branding.secondary_color,
    '--brand-accent': branding.accent_color,
    '--brand-neutral': branding.neutral_color,
    '--brand-text': branding.text_color,
    '--primary-color': branding.primary_color,
    '--secondary-color': branding.secondary_color,
    '--accent-color': branding.accent_color,
    '--accent-dark': branding.accent_color,
    '--primary-text': branding.text_color,
    '--secondary-text': branding.text_color,
    '--content-bg': branding.neutral_color,
    '--bg-color': branding.neutral_color,
  };

  Object.entries(colorMap).forEach(([key, value]) => {
    if (value) {
      root.style.setProperty(key, value);
    }
  });
};

const applyBrandingAssets = (branding = {}) => {
  const { logo = {}, favicon } = branding;

  const faviconElement = document.querySelector('link[rel="icon"]');
  if (faviconElement && favicon) {
    faviconElement.href = favicon;
  }

  if (branding.app_name) {
    document.title = branding.app_name;
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) {
      appleTitle.setAttribute('content', branding.app_name);
    }
  }

  if (branding.meta_description) {
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute('content', branding.meta_description);
    }
  }

  const logoTargets = document.querySelectorAll('[data-app-logo]');
  logoTargets.forEach((img) => {
    const mode = img.dataset.appLogo || 'light';
    const src = logo[mode] || logo.light || img.getAttribute('src');
    if (src) {
      img.setAttribute('src', src);
      if (logo.light) {
        img.dataset.logoLight = logo.light;
      }
      if (logo.dark) {
        img.dataset.logoDark = logo.dark;
      }
      if (logo.square) {
        img.dataset.logoSquare = logo.square;
      }
    }
  });

  const orgNames = document.querySelectorAll('[data-app-organization]');
  orgNames.forEach((node) => {
    node.textContent = branding.organization_name || node.textContent;
  });

  const appNames = document.querySelectorAll('[data-app-name]');
  appNames.forEach((node) => {
    node.textContent = branding.app_name || node.textContent;
  });

  const footerTextTargets = document.querySelectorAll('[data-app-footer]');
  footerTextTargets.forEach((node) => {
    if (branding.footer_text) {
      node.textContent = branding.footer_text;
    }
  });
};

export const loadAppConfig = async () => {
  if (!configPromise) {
    configPromise = fetch('/api/config/ui')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load configuration');
        }
        return response.json();
      })
      .then((config) => {
        window.__appConfig = config;
        applyBrandingAssets(config.branding);
        parseColorsToRoot(config.branding);
        return config;
      })
      .catch((error) => {
        console.error('Unable to load UI config:', error);
        return {
          branding: {},
          features: {},
          themes: {},
        };
      });
  }
  return configPromise;
};

export const getAppConfigSync = () => window.__appConfig;
