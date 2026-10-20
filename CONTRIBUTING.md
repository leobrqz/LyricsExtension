# Contributing

Lyrics Extension prioritizes flexible search, comfortable reading, personal favorites, and a simple installation. Read the [README](README.md) for the current product behavior.

## Set up the project

Use Node.js 22 or later and Firefox Desktop 140 or later. Run `npm ci` followed by `npm run dev`. Development tools are not included in the packaged extension.

The extension root is `src/`. Its JavaScript modules live in `src/src/`, alongside interface assets in `src/`. Build and validation tools live in `scripts/`. The generated `dist/` directory should not be edited or committed. Local product planning and validation notes belong in the Git-ignored `docs/` directory.

## Validate a change

Run `npm run check`. Add meaningful tests for behavior changes, especially translation alignment, concurrent searches, persistence, and video associations. Firefox tests use `.test-profile/`, separate from your everyday profile. Do not use that directory for daily browsing.

Use the original fixtures in `tests/fixtures/` for screenshots and repeatable tests. Avoid adding third-party lyrics to the repository. Reserve `npm run test:live` for checks against real songs and published translations in Firefox.

Check bundled dependencies with `npm audit --omit=dev`. Development dependencies, including the transitive Android support in `web-ext`, are not packaged. Avoid `npm audit fix --force` when it would downgrade tools or introduce incompatible changes.

## Submit a contribution

Open an issue or pull request in the [repository](https://github.com/leobrqz/LyricsExtension). Explain the problem, resulting behavior, and validation performed. Provide English and Brazilian Portuguese translations for new interface text. Preserve accessible names, keyboard navigation, error states, and reduced-motion support.

Explain new permissions or content services and update the [privacy section](README.md#privacy) accordingly. Document changes to external-service behavior in the README. Keep song discovery and fallback lyrics on the public lyrics.ovh API. Letras lyrics and published Portuguese translations are fetched directly by the extension. Do not add machine translation services or display unrelated verses as aligned translations.

Code contributions use the project's [MIT license](LICENSE). Preserve bundled dependency notices in the [credits section](README.md#credits), which is also distributed with the extension.
