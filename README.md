<p align="center">
  <img src="src/icons/icon.svg" width="76" height="76" alt="Lyrics Extension icon">
</p>

<h1 align="center">Lyrics Extension</h1>

<p align="center">
  Find the words. Keep your favorites. Read between the lines.
</p>

<p align="center">
  A minimal Firefox extension for song lyrics and line-by-line translations.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-a3e635?style=flat-square" alt="MIT license"></a>
  <a href="https://www.mozilla.org/firefox/"><img src="https://img.shields.io/badge/Firefox-140%2B-ff7139?style=flat-square&amp;logo=firefoxbrowser&amp;logoColor=white" alt="Firefox 140 or later"></a>
  <img src="https://img.shields.io/badge/Interface-English%20%2F%20Portuguese-94a3b8?style=flat-square" alt="English and Portuguese interface">
</p>

<p align="center">
  <a href="https://github.com/leobrqz/LyricsExtension/releases/latest"><img src="https://img.shields.io/badge/Download-GitHub-24292f?style=for-the-badge&amp;logo=github&amp;logoColor=white" alt="Download Lyrics Extension from GitHub" height="36"></a>
</p>

<p align="center">
  <a href="#installation">Get started</a> &nbsp;·&nbsp;
  <a href="#features">Features</a> &nbsp;·&nbsp;
  <a href="#privacy">Privacy</a> &nbsp;·&nbsp;
  <a href="https://github.com/leobrqz/LyricsExtension/issues">Report an issue</a>
</p>

---

## Features

- **Search as you type.** Use a song title, an artist, or a combination of both. No required format or separator.
- **Search from any page.** Select text, right-click, and choose the lyrics search action.
- **Read the original first.** Lyrics preserve their lines and stanzas. Published Portuguese translations from Letras.mus.br appear below the matching original lines in a softer color.
- **See the lyrics provider.** A link below the artist credits the exact Letras song page. API fallbacks say "via lyrics.ovh" and explain that its API does not disclose the original website. You can retry Letras directly from that label.
- **Keep your favorites.** Save songs, search your collection, and undo accidental removals. Previously loaded favorite lyrics and translations remain available offline.
- **Open YouTube.** Return to a matching video when the search started there, or open a search for the song.
- **Make yourself comfortable.** A dark slate interface, smooth transitions, keyboard navigation, reduced-motion support, and English or Brazilian Portuguese labels.
- **Pick up where you left off.** The current view, query, and reading position survive closing the popup during the same Firefox session.

## Installation

Download **LyricsExtension-Firefox-unsigned.zip** from the [latest release](https://github.com/leobrqz/LyricsExtension/releases/latest) and extract it to a folder. You need **Firefox Desktop 140 or later**; Node.js is only required to build from source.

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` inside the extracted folder.
4. Open **Lyrics Extension** from the extensions menu and pin it to the toolbar if desired.

This is an **unsigned development preview**. Temporary installations last until Firefox closes. Permanent installation in standard Firefox requires a [Mozilla-signed build](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/). Each release includes `SHA256SUMS.txt` to verify the downloaded ZIP.

## Usage

**From a page:** select text related to a song and use the context menu. A title alone is enough to start a search; artist names and separators are optional. Choose a result when several songs match.

**From the toolbar:** open the extension, type a query, and choose a song. Use the star to save it. The **Favorites** view filters your saved collection locally, without an internet request.

**Translations:** choose **Show translation** to load the Portuguese version published on Letras.mus.br. The extension checks the original and translated verse pairs before displaying them together. If no translation is available or the verses do not match, the original stays readable. Each newly opened song starts with its original lyrics. English and Portuguese remain available for the interface; published translations currently target Portuguese only.

**YouTube:** when a context-menu search starts on an identifiable YouTube video and its title matches both the artist and song, the extension remembers that video. Otherwise, the button opens a YouTube search. Manual searches do not automatically choose a specific video.

## Content services

Song discovery uses the [public lyrics.ovh API](https://github.com/NTag/lyrics.ovh#api). When you open a song, the extension requests its lyrics directly from [Letras.mus.br](https://www.letras.mus.br/) through your browser's connection. If a title alias points to a different version, the artist catalog is checked for an exact match. If Letras cannot supply the original, lyrics.ovh is used as a fallback. Its API does not disclose the original website, so the interface reports that source as unknown rather than guessing.

Translations come from the corresponding Letras `traducao.html` page and are requested only when you choose to show them. They are published content, without a machine translation service. This access is independent of the sources enabled on lyrics.ovh's server. No account, API key, or local server is required. Site coverage, page changes, or access restrictions can affect availability.

Favorites saved by older versions keep their original lyrics; their cached machine translations are removed on upgrade. Choose **Reload lyrics** in the translation panel to look for a Letras version of an older saved copy or an API fallback.

The extension requires no payment. External services control their availability, coverage, and limits; these can change. Search cannot guarantee a result for every song or spelling variation.

## Development

Use **Node.js 22 or later** and **Firefox Desktop 140 or later**.

```sh
npm ci
npm run dev
```

This builds the extension and opens Firefox with a temporary development profile, separate from your everyday browser. Changes inside `src/` are rebuilt and reloaded automatically. Set `FIREFOX_BINARY` to use a specific Firefox executable. On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution is restricted.

To load a source build in an existing Firefox window, run `npm run build` and select `dist/manifest.json` using the installation steps above.

The `src/` directory contains the extension manifest, interface assets, and JavaScript modules in `src/src/`. Build and development scripts live in `scripts/`, and tests live in `tests/`. Generated files are written to `dist/`.

```sh
npm run check
npm run package
```

`check` runs unit tests, Mozilla's extension validator, and integration tests in real Firefox with controlled local responses and an isolated test profile. Selenium Manager may download geckodriver on the first run. Coverage includes the real context menu, reading, translation, error states, favorites, keyboard navigation, and persistence after a browser restart.

`package` creates an unsigned archive in `artifacts/`. It contains the built extension, this README with its third-party notices, and `LICENSE`. Tests and development tools are excluded.

```sh
npm run test:live
```

This optional check opens real songs in Firefox and contacts lyrics.ovh and Letras.mus.br, including published translations and a song without one. It depends on those services and is separate from the deterministic test suite. Its output contains metadata and counts rather than song lyrics. The controlled test fixtures use original text written for this project.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Privacy

Lyrics Extension has no accounts, advertising, telemetry, or browsing-history collection.

### Data sent to services

- **Search:** text you type or explicitly select for a context-menu search is sent to `api.lyrics.ovh`. Its suggestions use the Deezer catalog. The rest of the page and its URL are not sent with this request.
- **Lyrics:** selecting a song requests a Letras page using the artist and title. If that lookup fails, the artist and title are sent to `api.lyrics.ovh` for fallback lyrics.
- **Translation:** choosing to show a translation requests the matching Portuguese translation page directly from Letras. Original verses are checked locally against that page; they are not submitted to a translation service. Providers receive connection information such as your public IP address, including your configured VPN or proxy when applicable.
- **YouTube:** the extension considers the source video after an explicit context-menu search. It saves the video link only when the artist and title match. Clicking the YouTube button opens that video or a search on YouTube, under YouTube's own policies.

Content requests omit authentication cookies and the source-page referrer. There is no project-operated intermediary server. External providers process requests under their own terms and control their own logs.

### Data stored in Firefox

Favorites, language preferences, and previously loaded lyrics and translations for favorite songs are stored locally in the current Firefox profile. They are not synced or shared across devices.

The current view, query, favorites filter, reading position, and open content use session storage and are discarded when Firefox restarts. The extension does not keep a permanent search history.

To delete a saved song and its cached content, remove its star or delete it from **Favorites**. You can undo the removal while the notification is visible. An already open copy may remain in the current session until Firefox restarts. Uninstalling the extension removes its installation data in normal browser use. Temporary development installations can preserve storage across reloads or reinstalls for testing.

### Permissions

| Permission | Purpose |
| --- | --- |
| Context menus | Offer a lyrics search for selected text. |
| Storage | Keep favorites, preferences, and the reading session. |
| Active tab | Read limited source-tab context after an explicit action to recognize a YouTube video. |
| lyrics.ovh access | Find songs and retrieve fallback original lyrics. |
| Letras.mus.br access | Retrieve original lyrics and published Portuguese translations directly through your connection. |

The extension does not monitor pages in the background, capture audio, read browsing history, or execute remote code. Search terms and selected content are declared in Firefox's data-transmission permissions.

For privacy questions, use the [project issues](https://github.com/leobrqz/LyricsExtension/issues). Avoid posting personal information or complete song lyrics.

## Credits

- [lyrics.ovh](https://github.com/NTag/lyrics.ovh) provides song discovery and fallback lyrics. The direct Letras reader is adapted from its MIT-licensed provider code, with the published-translation support developed for our contribution to that project.
- [Letras.mus.br](https://www.letras.mus.br/) supplies original lyrics and published Portuguese translations when available. Each displayed Letras song links to its source page.

<details>
<summary>Adapted source copyright and license notice</summary>

```text
MIT License

Copyright (c) Basile Bruneau

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

</details>

## License

The extension's source code is available under the [MIT license](LICENSE), allowing use, modification, and redistribution while preserving the license notice.

Song lyrics and translations remain subject to their respective rights holders and service terms. The code's MIT license does not grant rights to that content. Content services are accessed remotely and are not bundled software.
