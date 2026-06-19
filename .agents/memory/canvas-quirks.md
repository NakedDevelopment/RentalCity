---
name: Canvas quirks (this project)
description: Non-obvious behaviors when placing/presenting canvas iframe shapes in this mockup-sandbox-only project.
---

# Canvas quirks

## presentArtifact has no artifact to target here
The canvas skill says to always finish canvas work by calling `presentArtifact({ artifactId, shapeIds })`. In THIS project that call always fails with:
`Artifact '<id>' not found. Available artifacts: []`
— for every artifactId tried (`default-start-application`, `artifact:v3:default-start-application`, `canvas`, `default`).

**Why:** the project is mockup-sandbox-only (see artifacts skill) and no presentable artifact is registered, so `presentArtifact` has an empty registry.

**How to apply:** Still create/update the iframe shape with `applyCanvasActions` — that works and the shape appears on the board. Then just tell the user where it is (coords / "open Preview tab, toggle canvas"). Do NOT loop retrying `presentArtifact` with different artifactIds; it will keep returning `Available artifacts: []`.

## Standalone non-SPA view = static HTML in client/public/
To show a real app page as a canvas iframe that is NOT the React SPA shell, drop a self-contained HTML file at `client/public/<folder>/index.html`. Vite (dev, port 5000) and the prod Express static handler serve it at `/<folder>/index.html`, bypassing react-router. Iframe URL = `https://<$REPLIT_DOMAINS>/<folder>/index.html` (no port suffix for the main app on 5000).
