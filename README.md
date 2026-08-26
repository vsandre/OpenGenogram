# Genogram Canvas

[English](./README.md) | [简体中文](./README.zh-CN.md)

An open-source, browser-first genogram editor extracted from MyGenogramMaker.

Website: [MyGenogramMaker](https://mygenogrammaker.com/)

The deployed root page is a local project dashboard. Each project opens in the editor and is auto-saved to IndexedDB in the current browser without being uploaded to a server. Users can create multiple local projects, download and import versioned JSON project files, and export watermark-free PNG images.

## Features

- People, households, notes, text, family secrets, and relationship lines
- McGoldrick-style partner, child, sibling, twin, and emotional relationship geometry
- Undo/redo, multi-select, drag, resize, label and view controls
- Browser-local multi-project dashboard with create, rename, delete, and download actions
- Per-project IndexedDB autosave
- Versioned JSON import/export with validation
- Watermark-free PNG export
- Local MCP server for AI-generated, validated genogram projects
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
npm run test:mcp
npm run lint
npm run build
```

`npm run build` writes the deployable static site to `out/`.

## Generate genograms with AI over MCP

The optional local MCP server lets MCP-compatible AI clients generate importable Genogram Canvas projects. The server does not call a model, upload project data, or require an API key. Use an active LTS Node.js release: 20.19+, 22.13+, or 24+.

Build the local MCP executable:

```bash
npm install
npm run mcp:build
```

Add it to Codex, replacing the path with the absolute path to your clone:

```bash
codex mcp add genogram-canvas -- node /absolute/path/to/genogram-canvas/dist/genogram-mcp.mjs
```

Other MCP clients can use the equivalent stdio configuration:

```json
{
  "mcpServers": {
    "genogram-canvas": {
      "command": "node",
      "args": ["/absolute/path/to/genogram-canvas/dist/genogram-mcp.mjs"]
    }
  }
}
```

The server exposes three tools:

- `generate_genogram` converts people, families, and relationships into a validated, automatically laid-out project.
- `validate_genogram` checks an existing project against the current schema.
- `get_genogram_notation` lists the accepted gender and relationship values.

Example prompt for an MCP-enabled AI client:

> Use `generate_genogram` to create a genogram for Alex and Jordan, who are married, and their child Sam. Alex was born in 1988, Jordan in 1990, and Sam in 2016.

Save the returned project using the suggested JSON filename, then import it from the dashboard. Run `npm run test:mcp` to verify the bundled server over a real stdio connection.

## Deploy

Run `npm run build`, then upload the contents of `out/` to the root of any static host. No environment variables or backend services are required.

## Privacy boundary

Genogram data remains in the current browser unless the user explicitly downloads a JSON or PNG file. Project capacity depends on the browser's available storage. Clearing browser storage can remove every local project, so JSON download is the backup path. This project does not claim cloud storage or end-to-end encryption.

The local MCP server does not make network requests, but information included in a prompt may be processed by the AI client or model provider that the user chose. Review that provider's privacy terms before submitting sensitive family or health information.

## License

[MIT](./LICENSE)
