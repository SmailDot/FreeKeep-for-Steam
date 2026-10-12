# Bundled fonts

The popup and options page use two pixel fonts for headings, buttons and labels. Both are bundled,
so FreeKeep never loads anything from a font server, and both are licensed under the SIL Open Font
License 1.1 (license texts next to the fonts).

| File | Font | Version | Covers | Source |
|---|---|---|---|---|
| `Cubic_11.woff2` | Cubic 11 (俐方體11號) by ACh-K | 1.500 | Chinese, Japanese, Latin | <https://github.com/ACh-K/Cubic-11> |
| `Galmuri11.woff2` | Galmuri11 by Lee Minseo | 2.40.3 | Korean, Cyrillic, extended Latin | <https://github.com/quiple/galmuri> |

Both are drawn on a 12 px grid and are only used at 12 px and 24 px, where they render crisply.
Cubic 11's Cyrillic and Greek letters are full-width, so `theme.css` routes those to Galmuri11.

## Subsets

The files here are subsets (about 66 KB together instead of about 880 KB): the characters of all
interface languages, the relative times Intl shows in the status chips, Latin with Latin-1 and
Latin Extended-A, and Cyrillic, so Steam's English (and accented or Cyrillic) game titles stay in
pixels. A title the subsets can't draw, typically a localized Epic title, is shown entirely in the
system font instead of mixing two fonts (`pixelSafe` in `src/lib/pixel.ts`).

The full fonts are in `scripts/fonts/src/`. After changing interface text, run `npm run fonts`
(Python with `pip install fonttools brotli`), which rewrites these files and
`src/lib/pixel-coverage.ts`; `tests/fonts.test.ts` fails until you do.

SHA-256 of the full sources:

```
d28e92846e00c3696b30d950d4eddf445dd90b2a970e67cdb629796c1997ef67  scripts/fonts/src/Cubic_11.woff2
f467d1b10e6b88dfa8399c9f93b38c7643e050abfe4fc15800ac0b000f5a57d6  scripts/fonts/src/Galmuri11.woff2
```
