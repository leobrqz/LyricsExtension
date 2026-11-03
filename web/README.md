# Lyrics, Please website

React, Tailwind CSS, and Vite. Requires Node.js 22.12 or later.

```sh
cd web
npm ci
npm run dev
```

Open http://localhost:5173. On Windows PowerShell, use `npm.cmd` if needed.

`npm run build` generates the static site in `dist/`. `npm run preview` serves that build on port 4173. No server runtime is needed for hosting.

The interactive preview uses public-domain song excerpts and example Portuguese translations. It does not contact lyrics or translation services. Fonts and artwork are served locally. The website is separate from the Firefox extension build.

Dependency and font license texts are included in `public/licenses/`.
