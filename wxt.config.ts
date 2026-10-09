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
  },
});
