import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
/**
 * Firefox only. The add-on id is permanent once published on addons.mozilla.org. FreeKeep collects
 * no data, which AMO requires new add-ons to declare; that key needs Firefox 140 (an ESR) on desktop
 * and 142 on Android, which also cover everything the UI needs (CSS :has(), OffscreenCanvas).
 */
const GECKO = {
  id: 'freekeep-for-steam@smaildot.github.io',
  strict_min_version: '140.0',
  data_collection_permissions: { required: ['none'] },
};
const GECKO_ANDROID = { strict_min_version: '142.0' };

export default defineConfig({
  srcDir: 'src',
  zip: {
    // The sources zip for AMO review only needs what the build reads; the demo videos are large.
    excludeSources: ['docs/assets/**', '.output/**'],
  },
  manifest: ({ browser }) => ({
    ...(browser === 'firefox' ? { browser_specific_settings: { gecko: GECKO, gecko_android: GECKO_ANDROID } } : {}),
    name: '__MSG_extName__',
    short_name: 'FreeKeep',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    homepage_url: 'https://github.com/SmailDot/FreeKeep-for-Steam',
    // Keep this list minimal: no tabs, scripting or cookies access is needed.
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: ['https://store.steampowered.com/*'],
    // Each is only requested when the user turns its feature on in the options page:
    // Epic reminders, and automatic renewal of Steam's 24-hour web login.
    optional_host_permissions: [
      'https://store-site-backend-static-ipv4.ak.epicgames.com/*',
      'https://login.steampowered.com/*',
    ],
    action: { default_title: '__MSG_extName__' },
    // Enforced by the browser for the popup, the options page and the service worker: FreeKeep can
    // only talk to the Steam store, Steam's login renewal and Epic's giveaway feed, load images only
    // from their CDNs, and run no inline or remote script. "Only talks to Steam" is a browser
    // guarantee, not a promise. `data:` reaches no server: Chrome loads the notification icon (the
    // chest in the user's colours, drawn locally) through connect-src.
    content_security_policy: {
      extension_pages: [
        "default-src 'self'",
        'connect-src data: https://store.steampowered.com https://login.steampowered.com https://store-site-backend-static-ipv4.ak.epicgames.com',
        "img-src 'self' data: https://*.steamstatic.com https://*.epicgames.com https://*.unrealengine.com",
        "style-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    },
  }),
});
