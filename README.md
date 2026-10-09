<div align="center">

<img src="docs/assets/icon-512.png" width="96" alt="FreeKeep icon" />

# FreeKeep for Steam

**Auto-claim free Steam games, no password required.**
A lightweight browser extension that claims Steam's limited-time free games in the background, with
optional reminders for Epic Games Store giveaways.

🔒 **No password, no access to your login cookie, no server. Everything runs in your browser.**

[繁體中文](README.zh-TW.md) · [Why it's safe](#-why-its-safe) · [Install](#install) · [How it works](#how-it-works) · [Privacy](PRIVACY.md)

![FreeKeep demo](docs/assets/demo-en.gif)

</div>

## 🔒 Why it's safe

Auto-claimers that ask for your password or login cookie put your account's security in a third
party's hands. FreeKeep is designed so it never needs them:

1. **It reuses your existing browser session**
   Once you're signed in to Steam, your browser attaches your session to every request to the Steam
   store. FreeKeep sends the same request as Steam's **Add to Account** button, and the browser
   handles authentication.
2. **It can't read your login credentials**
   Steam protects its login cookie with the HttpOnly flag, which blocks scripts and extensions from
   reading it. FreeKeep doesn't request the cookies permission either.
3. **No server involved**
   FreeKeep has no backend. It doesn't upload or collect any data.
4. **Verifiable**
   On Chrome's extension Details page, FreeKeep shows only notifications and access to the Steam
   store (plus Epic's public list if Epic reminders are on). The [source code](src/) is public.

### Compared with typical auto-claimers

| | Typical auto-claimers | FreeKeep |
|---|---|---|
| Needs your password or login cookie | Usually | **No** |
| How it claims | Opens store tabs and clicks, or signs in on a server | **A single background request, no tabs** |
| Where it runs | Usually a bot, a server or an always-on machine | **Your browser** |
| Your login data | Copied to the tool's config or server | **Stays in your browser** |
| Connects to | The tool's server, Discord or other third-party services | **The Steam store only**¹ |
| Data collection | Varies | **None. No analytics, no tracking** |
| Source code | Varies | **Open source, about 40 KB** |

¹ Plus Epic's public list of free games, only if you turn on the optional
[Epic reminders](#epic-games-store-reminders). That request contains no login information.

For details, see the [privacy policy](PRIVACY.md) and the [architecture notes](docs/ARCHITECTURE.md).

## Features

- **Claims free-to-keep games automatically.** Only genuine limited-time promotions (Steam's
  "Limited Free Promotional Package"); demos, playtests and free-to-play games are excluded.
- **No credentials, fully local.** No password, no token, no server. It connects only to the Steam
  store and never opens tabs or clicks on your behalf.
- **Checks your library.** Skips games you own, and claims DLC only if you own the base game (Steam
  would reject it otherwise).
- **Region-aware.** Uses your Steam store region, so it claims only what's free in your region.
- **Minimal notifications.** Notifies you only when a game is claimed or needs your attention.
- **Flexible schedule.** Checks every 1, 3, 6, 12 or 24 hours, and once at browser startup. Checks
  missed while your computer was asleep run when it wakes up.
- **Automatic or confirm first.** Claim right away, or get notified and decide yourself.
- **Optional Epic Games Store reminders.** Notifies you when Epic gives a game away, with a link to
  claim it. Off by default; [details below](#epic-games-store-reminders).
- **Lightweight and auditable.** About 40 KB of code, no runtime dependencies, written in TypeScript
  with unit tests.
- **12 languages.** English, 繁體中文, 简体中文, Русский, Español, Português, Deutsch, 日本語, Français,
  Polski, 한국어, Türkçe. [Help translate](CONTRIBUTING.md#translations).

## Install

| Browser | How |
|---|---|
| Chrome, Edge, Brave, Opera | Chrome Web Store (coming soon) |
| Any Chromium browser, manually | Download `freekeep-for-steam-*-chrome.zip` from [Releases](../../releases), unzip it, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and pick the folder |

Then sign in to the [Steam store](https://store.steampowered.com/) in the same browser to get started.

> Manual installs don't update automatically. Steam occasionally changes its website, so keep an eye
> on the releases, or switch to the store version once it's available.

## How it works

```
every N hours (and at browser start)
  └─ search the store for 100%-off items           GET /search/results?maxprice=free&specials=1
      └─ new app? read its packages                GET /api/appdetails
          └─ keep "Limited Free Promotional Package" subs
              └─ compare with your library          GET /dynamicstore/userdata
                  └─ claim, one at a time            POST /freelicense/addfreelicense/<subid>
```

The last request is the same one Steam's **Add to Account** button sends. FreeKeep interprets Steam's
result codes (`9` already owned, `24` base game required) and retries failed claims up to three times.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

### Epic Games Store reminders

Turn on **Remind me of free games on the Epic Games Store** in the settings, and FreeKeep also tracks
Epic's weekly giveaways. This feature **only sends reminders**: one notification when a new giveaway
starts, a list in the popup with a **Get on Epic** button, and a preview of next week's games. You
claim the games on Epic's site.

<p align="center"><img src="docs/assets/epic-en.png" width="320" alt="The popup's Epic Games tab: this week's free games with Get on Epic buttons, and next week's games below" /></p>

- Epic's giveaway list is public, so FreeKeep reads it anonymously, without an Epic account, login
  information or cookies. The request includes only your browser's language, so game names match
  Epic's site; it doesn't include your country or Steam data.
- Turning it on asks your browser for one additional permission: reading
  `store-site-backend-static-ipv4.ak.epicgames.com`. Turning it off removes the permission. Chrome's
  extension page may still list the site, because Chrome remembers that you granted it and won't ask
  again, but FreeKeep can no longer connect to it.
- If you never turn it on, FreeKeep never connects to Epic.

### Permissions

| Permission | Why |
|---|---|
| `store.steampowered.com` | Find promotions, check your library, claim games |
| `storage` | Store settings and handled promotions, on your device only |
| `alarms` | Run the periodic check |
| `notifications` | Tell you when a game is claimed or needs your attention |
| `store-site-backend-static-ipv4.ak.epicgames.com` (optional) | Read Epic's public list of free games, only after you turn on Epic reminders |

It doesn't use the `tabs`, `scripting` or `cookies` permissions and can't access any other site.

## FAQ

**Is my account safe?** FreeKeep never learns your password and can't read your login cookie: Steam
protects it with the HttpOnly flag, and FreeKeep doesn't have the cookies permission. Your browser
attaches your session when connecting to the Steam store, just as it does when you browse. The source
code is public for anyone to review.

**Does Steam allow this?** FreeKeep sends the same request as clicking *Add to Account*, at a low
frequency. It is still unofficial automation, so use it at your own discretion. FreeKeep is not
affiliated with Valve.

**Does it work on new or limited accounts?** Yes. It has been tested on a brand-new account.

**Why doesn't it claim Epic games automatically?** On Steam, a free license takes a single request,
the same one the *Add to Account* button sends. On Epic, claiming a game goes through the checkout
flow. Automating it would require scripting Epic's website or handling your Epic login, which goes
against FreeKeep's principle of never touching user credentials. For Epic, FreeKeep sends reminders
instead.

**Someone else got a free game that FreeKeep didn't detect for me. Why?** Usually for one of two
reasons:

- **Region-limited promotions.** FreeKeep uses your Steam store region, and some promotions are only
  available in certain countries.
- **Not a Steam promotion.** Some developers list a new game as *Free to Play* and only mention in
  the description that adding it during a launch period lets you keep it. Steam offers no
  free-to-keep promotion to claim for these, so add them to your library from the store page.

**Why wasn't a DLC claimed?** Steam only lets accounts that own the base game claim a DLC. FreeKeep
marks these as *Needs base game* and claims them automatically if you get the base game while the
promotion is running.

**Something isn't working?** Open the popup, click **Copy diagnostics** and paste the report into an
[issue](../../issues). The report contains no account data.

## Development

```bash
npm install
npm run dev        # Chrome with hot reload
npm test           # unit tests
npm run compile    # type check
npm run build      # .output/chrome-mv3
npm run zip        # store-ready zip
```

The demo above is rendered from the real popup: `npm run build && node scripts/demo/record.mjs en`
(needs Playwright and ffmpeg). The Epic screenshot comes from `npm run epic-shot`.

### Translations

FreeKeep speaks 12 languages, and you can add yours in a few minutes: copy
[`public/_locales/en/messages.json`](public/_locales/en/messages.json), translate it and open a pull
request. Native speakers reviewing the machine-assisted languages are just as welcome. See
[CONTRIBUTING.md](CONTRIBUTING.md#translations) for the status table and steps.

## Contact

Maintained by [@SmailDot](https://github.com/SmailDot). Questions, bugs and ideas:
[open an issue](../../issues) or email [smaildot@aidot.me](mailto:smaildot@aidot.me).

## License

Code: [MIT](LICENSE). The FreeKeep name and logo are not covered by the license; please don't
publish forks or copies under that name or with that logo.

Steam is a trademark of Valve Corporation. FreeKeep is not affiliated with or endorsed by Valve.
