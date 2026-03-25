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

### Logo Colors (reference)
| Role | Hex | Usage |
|------|-----|-------|
| Primary green | `#7ED321` | Main frog color (bright lime) |
| Dark green | `#2E7D32` | Shadows, depth |
| Background dark | `#0F2B1A` | Dark contexts, pixel frog background |
| Accent cyan | `#00BCD4` | Node dots, highlights, checkmarks |
| Light/cream | `#F1F8E9` | Belly, mouth area |
| Near-black | `#1A1A2E` | Eyes, outlines |

### App Brand Tokens (CSS + Tailwind)

Defined as CSS custom properties in `apps/web/src/index.css` and Tailwind tokens in `tailwind.config.js`:

| Token | CSS Variable | Hex | Tailwind Class | Usage |
|-------|-------------|-----|----------------|-------|
| Brand Green | `--brand-green` | `#4CAF50` | `bg-brand-green` | Primary CTA buttons |
| Brand Lime | `--brand-lime` | `#8BC34A` | `bg-brand-lime` | Accent highlights |
| Brand Dark | `--brand-dark` | `#1B2631` | `bg-brand-dark` | Dark backgrounds |
| Brand Cyan | `--brand-cyan` | `#00BCD4` | `bg-brand-cyan` | Data/analytics accents |
| Brand Green Light | `--brand-green-light` | `#E8F5E9` | `bg-brand-green-light` | Light green backgrounds |
| Brand Green Hover | `--brand-green-hover` | `#43A047` | `hover:bg-brand-green-hover` | Hover state for brand-green buttons |

To change a brand color, update the CSS variable in `index.css` — Tailwind classes reference the vars automatically.

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

## Tommy the Toad — AI Assistant Persona (Future)

The AI autopilot should have a consistent identity: **Tommy**. Not a gimmick — the face of all AI interactions.

**Where Tommy appears (AI is making decisions or communicating):**
- AI suggestions use Tommy's voice: "I'd recommend Next.js for this — here's why..."
- Project chat is a conversation with Tommy, not a generic AI chat box
- Approval prompts: "Tommy wants to create a PR — approve?" not "Action requires approval"
- Error recovery: "I hit a problem with the auth service. Here's what happened and what I'd try next."
- Stack recommendations, task suggestions, project health insights — all from Tommy

**Where Tommy does NOT appear (avoid gimmicky):**
- Loading spinners, generic buttons, non-AI UI elements
- Error messages that aren't AI-related (404, network errors)
- Standard PM features (boards, task lists, sprint views)
- Everywhere by default — Tommy appears where the AI is active, invisible where it's not

**Voice guidelines:**
- Confident but not arrogant — "I'd recommend..." not "You should..."
- Concise — no filler, no forced personality in every sentence
- Helpful when relevant, invisible when not
- Can express uncertainty: "I'm not sure about this approach — here are two options"
- Think Copilot energy, not Clippy energy

**Visual:**
- Uses the Node Frog logo variant (AI/automation identity)
- Small avatar next to AI-generated content
- Subtle — doesn't dominate the UI

**Implementation:** Post-pipeline polish. Don't build now, but keep AI-facing UI language consistent so it's easy to add Tommy's voice later. Avoid hardcoding generic language like "AI suggests..." — use a pattern that can be swapped to "Tommy suggests..." in one place.

**Reference:** GitHub Copilot's chat identity, Linear's Dolt, Vercel's v0.

---

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

## Deployed Assets

| Public Path | Source | Where Used |
|-------------|--------|------------|
| `/logo.png` | `frog-t.png` | Sidebar, login, signup, home page |
| `/logo-data.png` | `frog-data.png` | Project dashboard header |
| `/favicon.png` | `frog-t.png` | Browser tab favicon |

### Logo Placements in UI
- **Sidebar header** (`AppLayout.tsx`): 28x28px logo next to "TaskToad" text
- **Login page** (`Login.tsx`): 40x40px centered logo above form
- **Signup page** (`Signup.tsx`): 40x40px centered logo above form
- **Home page** (`Home.tsx`): 64x64px centered logo above heading
- **Project Dashboard** (`ProjectDashboard.tsx`): 32x32px data logo at 60% opacity

### Brand-Green CTA Buttons
- Home page "Generate project options"
- Login "Sign in"
- Signup "Create account"
- TaskPlanApprovalDialog "Approve & create"

### What Stays Slate
- Sidebar background (`bg-slate-800`)
- Secondary/ghost buttons
- Status and priority color tokens

## Current Status

- **Logos finalized:** T-Frog (`frog-t.png`), Node Frog (`frog-data.png`), Pixel Frog (`frog-bot.png`)
- **Brand system deployed:** CSS custom properties + Tailwind tokens, favicon, meta tags, logo placements
- **Not yet deployed:** `frog-bot.png` (reserved for GitHub bot avatar), `frog-minimal.webp` (future use)
- **Future:** SVG favicon, proper OG social preview image, PWA manifest icons
