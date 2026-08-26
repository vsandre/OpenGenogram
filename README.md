# Genogram Canvas

An open-source, browser-first genogram editor extracted from MyGenogramMaker.

The deployed root page is a local project dashboard. Each project opens in the editor and is auto-saved to IndexedDB in the current browser without being uploaded to a server. Users can create multiple local projects, download and import versioned JSON project files, and export watermark-free PNG images.

## Features

- People, households, notes, text, family secrets, and relationship lines
- McGoldrick-style partner, child, sibling, twin, and emotional relationship geometry
- Undo/redo, multi-select, drag, resize, label and view controls
- Browser-local multi-project dashboard with create, rename, delete, and download actions
- Per-project IndexedDB autosave
- Versioned JSON import/export with validation
- Watermark-free PNG export
- Static build with no authentication, payment, cloud project, analytics, or backend APIs

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify

```bash
npm run test:genogram
npm run lint
npm run build
```

`npm run build` writes the deployable static site to `out/`.

## Deploy

Run `npm run build`, then upload the contents of `out/` to the root of any static host. No environment variables or backend services are required.

## Privacy boundary

Genogram data remains in the current browser unless the user explicitly downloads a JSON or PNG file. Project capacity depends on the browser's available storage. Clearing browser storage can remove every local project, so JSON download is the backup path. This project does not claim cloud storage or end-to-end encryption.

## License

[MIT](./LICENSE)
