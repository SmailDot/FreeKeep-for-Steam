import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: '__MSG_extName__',
    short_name: 'FreeKeep',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    homepage_url: 'https://github.com/SmailDot/FreeKeep-for-Steam',
    // Keep this list minimal: no tabs, scripting or cookies access is needed.
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: ['https://store.steampowered.com/*'],
    // Only requested when the user turns on Epic reminders in the options page.
    optional_host_permissions: ['https://store-site-backend-static-ipv4.ak.epicgames.com/*'],
    action: { default_title: '__MSG_extName__' },
    // Enforced by the browser for the popup, the options page and the service worker: FreeKeep can
    // only talk to the Steam store and Epic's giveaway feed, load images only from their CDNs, and
    // run no inline or remote script. "Only talks to Steam" is a browser guarantee, not a promise.
    content_security_policy: {
      extension_pages: [
        "default-src 'self'",
        'connect-src https://store.steampowered.com https://store-site-backend-static-ipv4.ak.epicgames.com',
        "img-src 'self' data: https://*.steamstatic.com https://*.epicgames.com https://*.unrealengine.com",
        "style-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    },
  },
});
