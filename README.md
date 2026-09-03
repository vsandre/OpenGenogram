<div align="center">

# 🧬 Genogram Canvas

**A modern, open-source, browser-first McGoldrick-style genogram editor for therapists, social workers, educators, and students.**

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![MCP Supported](https://img.shields.io/badge/MCP-Supported-7c3aed.svg)](https://modelcontextprotocol.io/)
[![Static Export](https://img.shields.io/badge/Deploy-Static_Export-0ea5e9.svg)](#deploy)
[![Issues Welcome](https://img.shields.io/badge/Issues-welcome-brightgreen.svg)](https://github.com/Brewnut-98/genogram-canvas/issues)

### Want to draw a genogram without installing anything?

### 👉 [Open MyGenogramMaker](https://mygenogrammaker.com/)

The hosted website and this standalone open-source edition may offer different features. Run this repository for a fully local, watermark-free workflow.

</div>

---

## Why Genogram Canvas?

Family diagrams should not require fighting a general-purpose drawing tool or manually aligning every relationship.

Genogram Canvas provides a focused editor for structured family diagrams while keeping the open-source edition local and inspectable.

| Common approach | With Genogram Canvas |
|---|---|
| General drawing or slide tools | Purpose-built people, family, and emotional relationship elements |
| Desktop-only software | Browser-based interface that can be deployed as a static site |
| Cloud-first editors | Projects stay in the current browser's IndexedDB |
| Manual transcription and layout | Optional MCP tools generate, validate, and lay out importable projects |

## Key Features

- **McGoldrick-style notation:** People, households, family boundaries, notes, family secrets, and relationship lines.
- **Family and emotional relationships:** Partner, child, sibling, twin, adoption or foster, and emotional relationship geometry.
- **Practical editing:** Undo and redo, multi-select, drag, resize, label controls, and view controls.
- **Local multi-project workspace:** Create, rename, delete, and reopen projects stored in the current browser.
- **Portable project files:** Import and export versioned JSON files with validation.
- **Watermark-free PNG export:** Export the open-source canvas as a PNG without a watermark.
- **Local MCP server:** Generate and validate genogram projects through compatible AI clients.
- **Static and self-contained:** No authentication, payment, analytics, cloud project storage, or backend API is included.

## AI Workflow: Turn Case Notes into a Genogram

The optional local MCP server lets Codex, Claude Desktop, Cursor, and other MCP-compatible clients create an automatically laid-out project from structured case information.

1. Remove identifying or unnecessary sensitive information from the case notes.
2. Ask an MCP-enabled AI client to call `generate_genogram`.
3. Save the returned project with its suggested JSON filename.
4. Import the JSON file from the Genogram Canvas dashboard.

Example prompt:

> Use `generate_genogram` to create a genogram for Alex and Jordan, who are married, and their child Sam. Alex was born in 1988, Jordan in 1990, and Sam in 2016. Return an importable Genogram Canvas project.

The MCP server itself does not call a model or make network requests. Your chosen AI client or model provider may still process the text you submit. Review the [privacy boundary](#privacy-boundary) before using sensitive information.

## Developer Quickstart

Use an active LTS Node.js release: 20.19+, 22.13+, or 24+.

```bash
git clone https://github.com/Brewnut-98/genogram-canvas.git
cd genogram-canvas
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local MCP Server

Build the MCP executable:

```bash
npm run mcp:build
```

Add it to Codex, replacing the example with the absolute path to your clone:

```bash
codex mcp add genogram-canvas -- node /absolute/path/to/genogram-canvas/dist/genogram-mcp.mjs
```

Claude Desktop, Cursor, and other stdio MCP clients can use an equivalent configuration:

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

Run `npm run test:mcp` to verify the bundled server over a real stdio connection.

## Verify

```bash
npm run test:genogram
npm run test:mcp
npm run lint
npm run build
```

`npm run build` writes the deployable static site to `out/`.

## Deploy

Run `npm run build`, then upload the contents of `out/` to the root of any static host. The open-source app does not require environment variables or backend services.

## Privacy Boundary

In this standalone open-source edition, genogram data stays in the current browser unless the user explicitly downloads a JSON or PNG file. No patient identifiers, names, or diagrams are sent to a project backend.

Project capacity depends on available browser storage. Clearing browser data can remove every local project, so download a JSON backup when the work matters.

The local MCP server does not make network requests. Information in prompts may still be processed by the AI client or model provider you choose. Check that provider's terms before submitting sensitive family or health information.

Local-first architecture alone does not establish HIPAA or other regulatory compliance. Organizations remain responsible for evaluating their own policies, devices, workflows, and service providers.

## Contributing

Contributions from developers and genogram practitioners are welcome.

- Missing a symbol or relationship type? [Open an issue](https://github.com/Brewnut-98/genogram-canvas/issues) with a reference and use case.
- Found a bug or have an improvement? Submit a focused pull request.

## License

Genogram Canvas is available under the [MIT License](./LICENSE). See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) for dependency notices.
