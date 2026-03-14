# TaskToad Branding & Logo System

## Logo Variants

Three logo variants, all derived from one canonical frog face to ensure product cohesion.

### 1. Pixel Frog — Bot / Developer Identity
- **Use for:** GitHub bot avatar, CLI branding, dev-facing contexts
- **Style:** Retro 8-bit pixel art, dark teal/green background square
- **Key trait:** Chunky, obviously pixelated — should read as distinctly 8-bit, not just slightly blocky

### 2. T-Frog — Primary Logomark
- **Use for:** Favicon, app icon, minor branding, wordmark pairing
- **Style:** Letter "T" merged with the frog face — eyes must sit on/above the crossbar
- **Key trait:** Works at all sizes (16px to billboard). Keep shading flat or subtle — avoid heavy 3D gradients

### 3. Node Frog — AI / Automation Identity
- **Use for:** AI feature branding, automation UI, task generation, sprint planning contexts
- **Style:** Canonical frog face with network/graph pattern (connected nodes and edges) extending below
- **Key trait:** Nodes use the cyan accent color; communicates orchestration/automation

## Cohesion Rules

All three variants **must** share:
- **Same silhouette** — wide flat head, two eye bumps on top, light chin area
- **Same eye design** — round dark eyes with subtle highlight
- **Same color palette** (see below)
- **Same proportions** — blurred thumbnails of all three should look identical

What **can** differ:
- Rendering style (pixel grid vs. smooth vector vs. node-network)
- Complexity/detail level
- Context-specific elements (nodes only on Node Frog, pixel grid only on Pixel Frog)

Think of it as "three outfits for the same character" — like Discord's Clyde appearing as 3D render, flat icon, and simplified favicon.

## Color Palette

| Role | Hex | Usage |
|------|-----|-------|
| Primary green | `#7ED321` | Main frog color (bright lime) |
| Dark green | `#2E7D32` | Shadows, depth |
| Background dark | `#0F2B1A` | Dark contexts, pixel frog background |
| Accent cyan | `#00BCD4` | Node dots, highlights, checkmarks |
| Light/cream | `#F1F8E9` | Belly, mouth area |
| Near-black | `#1A1A2E` | Eyes, outlines |

## Typography

- **Typeface:** Montserrat Bold (for wordmark and headings)
- Clean, free, good weight range

## Design Principles

- Geometric and minimal — no organic/hand-drawn textures
- Friendly but professional — SaaS tool, not a children's game
- Smart/competent expression, not goofy
- Designed for dark backgrounds primarily, but must also work on white
- Head/face only (no full body, except T-Frog where the T acts as abstract body)
- Reference peers: GitHub Octocat, Docker whale, Go gopher

## Full Brand System Needs (Future)

### Core Identity
- Primary logo (icon + wordmark), icon-only, wordmark-only variants
- Favicon set (16px, 32px, 180px apple-touch, SVG)
- Logo spacing/sizing rules (clear space, minimum size)

### Application Assets
- GitHub bot avatar and org avatar
- Social media profiles (Twitter/X, LinkedIn) — banner + avatar
- Open Graph / social preview image for link shares
- Favicon + PWA manifest icons
- Email templates (transactional: welcome, invite, password reset)
- In-app loading states, empty states, error pages featuring the mascot

### Marketing
- Landing page hero with clear value prop
- Screenshot/demo mockups
- Pitch deck template
- Blog/docs header styles

### Brand Guidelines Doc
- Logo usage dos/don'ts
- Color specs (hex, RGB, HSL)
- Typography scale
- Voice & tone guide

## Current Status

- **Round 1:** Generated initial concepts via ChatGPT — 6 styles explored
- **Favorites selected:** Pixel Frog, T-Frog, Node Frog
- **Round 2:** Refined with cohesion prompt — silhouette and palette now unified
- **Outstanding issues:**
  - T-Frog lost its eyes in round 2 — needs eyes on/above the T crossbar
  - Pixel Frog not chunky enough — needs bigger, more obvious pixels
  - T-Frog 3D shading is heavier than other variants — flatten to match
- **Reference images:** `.claude-knowledge/images/` (favorites.png, favorites2.png, and ChatGPT generations)

## Next Steps

1. Iterate with ChatGPT to fix T-Frog eyes and Pixel Frog chunkiness
2. Once concepts are locked, get a designer to produce proper SVG/AI vector files (~$200-500 freelancer)
3. Build out favicon set and basic brand assets
4. Integrate chosen marks into the app (favicon, loading states, etc.)
