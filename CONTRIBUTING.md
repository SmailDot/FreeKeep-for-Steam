# Contributing to FreeKeep

Thanks for helping! The easiest and most valuable contributions are **translations**.

## Translations

FreeKeep uses Chrome's built-in i18n. Every language is one file:
`public/_locales/<code>/messages.json` (codes: [Chrome locale list](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales)).

| Language | Code | Status |
|---|---|---|
| English | `en` | ✅ maintained |
| 繁體中文 | `zh_TW` | ✅ maintained |
| 简体中文 | `zh_CN` | ✅ reviewed |
| Русский | `ru` | 🤖 machine-assisted, review welcome |
| Español | `es` | 🤖 machine-assisted, review welcome |
| Português (Brasil) | `pt_BR` | 🤖 machine-assisted, review welcome |
| Deutsch | `de` | 🤖 machine-assisted, review welcome |
| 日本語 | `ja` | 🤖 machine-assisted, review welcome |
| Français | `fr` | 🤖 machine-assisted, review welcome |
| Polski | `pl` | 🤖 machine-assisted, review welcome |
| 한국어 | `ko` | 🤖 machine-assisted, review welcome |
| Türkçe | `tr` | 🤖 machine-assisted, review welcome |
| Italiano, Українська, Tiếng Việt, ไทย, Bahasa Indonesia, Nederlands, Čeština, Svenska, … | | 🙋 wanted |

**Add a language**

1. Copy `public/_locales/en/messages.json` to `public/_locales/<code>/messages.json`.
2. Translate every `message`. Keep `$PLACEHOLDERS$` as they are and leave `placeholders` untouched.
3. Keep `extDescription` within 132 characters (Chrome Web Store limit).
4. Run `npm install && npm test`: a test checks keys, placeholders and length.
5. Open a pull request. Add yourself to the table above.

**Improve a translation:** edit the file and open a pull request, even for a single word. Native
speakers reviewing the 🤖 languages are very welcome.

To see it in the browser, run `npm run dev` and switch your browser language, or start Chrome with
`--lang=<code>`.

## Code

```bash
npm install
npm run dev        # Chrome with hot reload
npm test           # unit tests
npm run compile    # type check
```

- Core logic lives in `src/core` and has no browser APIs, so it can be unit tested. Add a test for
  behaviour changes.
- Keep the permission list minimal. A change that needs a new permission needs a strong reason.
- FreeKeep must never read, store or send credentials, and must only talk to
  `store.steampowered.com`. Pull requests that change this won't be merged.
- See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how detection and claiming work.

## Bugs

Use the bug report template and paste the popup's **Copy diagnostics** output. It contains no
account data.
