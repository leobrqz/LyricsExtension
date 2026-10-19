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
- **Read the original first.** Lyrics preserve their lines and stanzas. Optional translations appear below each original line in a softer color.
- **See the lyrics provider.** A link below the artist credits lyrics.ovh. Its API does not disclose the original source website.
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

**Translations:** choose **Show translation**. The source language is detected on your device and can be corrected manually. Translation targets are English and Portuguese. Each newly opened song starts with its original lyrics. Translations are machine-generated and may differ from an editorial translation.

**YouTube:** when a context-menu search starts on an identifiable YouTube video and its title matches both the artist and song, the extension remembers that video. Otherwise, the button opens a YouTube search. Manual searches do not automatically choose a specific video.

## Content services

Song discovery and original lyrics use the [public lyrics.ovh API](https://github.com/NTag/lyrics.ovh#api) directly. No account, API key, or self-hosted server is required. A song can appear in suggestions without having available lyrics. The interface distinguishes missing content from connection failures.

Translations use [MyMemory by Translated](https://mymemory.translated.net/doc/spec.php). Its [documented anonymous allowance](https://mymemory.translated.net/doc/usagelimits.php) is **5,000 characters per day**. Requests from the same connection can share that allowance. Repeated lines are translated once per request, and saved translations are reused. If the allowance runs out or some lines cannot be translated, the original stays readable and you can retry the missing lines later.

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

`package` creates an unsigned distribution archive in `artifacts/`. It contains the built extension, this README with its third-party notices, and `LICENSE`. Tests and development tools are excluded. The archive can be temporarily loaded in Firefox or submitted to Mozilla for signing.

```sh
npm run test:live
```

This optional integration check contacts the public services and consumes translation allowance. It depends on their availability and is separate from the deterministic test suite. Its output contains metadata and counts rather than song lyrics. Test fixtures use original text written for this project.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Publishing a release

The release scripts use PowerShell and an authenticated [GitHub CLI](https://cli.github.com/) on Windows. Keep the version synchronized in `package.json`, both root version fields in `package-lock.json`, and `src/manifest.json`.

```powershell
npm.cmd run check
npm.cmd run release:prepare
```

Preparation rebuilds the extension and writes `LyricsExtension-Firefox-unsigned.zip` and `SHA256SUMS.txt` to `artifacts/release/`. It verifies the manifest version, extension ID, package contents, production endpoints, privacy information, license notices, and checksum.

Write English release notes to `artifacts/release-notes.md`, then commit the intended source changes on `main`. Build outputs and release notes stay outside Git. Publish with:

```powershell
npm.cmd run release:publish -- -NotesFile artifacts/release-notes.md
```

The script creates an annotated `vMAJOR.MINOR.PATCH` tag, pushes `main` and the tag, uploads the ZIP and checksum to a draft, downloads and verifies both attachments, and publishes the release as the latest only after verification. To validate artifacts without changing Git or GitHub, add `-ValidateOnly`. Published releases are not overwritten; use a new version for subsequent deliveries.

The download button points to the latest GitHub release. These packages remain unsigned previews until a Mozilla-signed distribution is set up. Mozilla signing is separate from publishing a GitHub release.

## Privacy

Lyrics Extension has no accounts, advertising, telemetry, or browsing-history collection.

### Data sent to services

- **Search:** text you type or explicitly select for a context-menu search is sent to `api.lyrics.ovh`. Its suggestions use the Deezer catalog. Selecting a song sends its artist and title to retrieve lyrics. The rest of the page and its URL are not sent with this request.
- **Translation:** when you request a translation, the necessary original lines and language pair are sent to `api.mymemory.translated.net`, operated by Translated. Initial language detection runs locally. The extension sends no email address or personal identifier. Service providers receive connection information such as your IP address.
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
| lyrics.ovh and MyMemory access | Request lyrics, suggestions, and translations. |

The extension does not monitor pages in the background, capture audio, read browsing history, or execute remote code. Search terms and selected content are declared in Firefox's data-transmission permissions.

For privacy questions, use the [project issues](https://github.com/leobrqz/LyricsExtension/issues). Avoid posting personal information or complete song lyrics.

## Credits

- [lyrics.ovh](https://github.com/NTag/lyrics.ovh) provides the public API used for song discovery and original lyrics.
- [MyMemory by Translated](https://mymemory.translated.net/) provides machine translations.
- [franc-min](https://github.com/wooorm/franc), [trigram-utils](https://github.com/wooorm/trigram-utils), [n-gram](https://github.com/words/n-gram), and [collapse-white-space](https://github.com/wooorm/collapse-white-space) provide local language detection and its supporting utilities. These MIT-licensed dependencies are included in the extension; their notices are preserved below.

<details>
<summary>Bundled dependency copyright and license notices</summary>

```text
MIT License

Copyright (c) 2014 Titus Wormer <tituswormer@gmail.com>
Copyright (c) 2015 Titus Wormer <tituswormer@gmail.com>
Copyright (c) 2008 Kent S Johnson
Copyright (c) 2006 Jacob R Rideout <kde@jacobrideout.net>
Copyright (c) 2004 Maciej Ceglowski

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
