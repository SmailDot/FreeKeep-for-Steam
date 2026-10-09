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
    action: { default_title: '__MSG_extName__' },
  },
});
