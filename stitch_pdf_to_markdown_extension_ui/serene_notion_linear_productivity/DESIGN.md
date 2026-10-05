---
name: Serene Notion-Linear Productivity
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#464554'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#904900'
  on-tertiary: '#ffffff'
  tertiary-container: '#b55d00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703700'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-base: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

The design system embodies a serene, high-utility productivity aesthetic inspired by contemporary workspace tools like Notion and Linear. It is built to evoke calm focus, precision, and effortless competence during micro-task workflows inside a compact extension environment.

### Design Movement
- **Refined Functional Minimalism:** Eliminates decorative noise in favor of high-craft typography, strict structural alignment, and subtle spatial hierarchy.
- **Tactile Softness:** Balanced by gentle curves (`rounded-xl`) and hairline borders that make dense technical workflows feel approachable and lightweight.
- **Emotional Resonance:** Quiet confidence, clarity, and frictionless utility. The interface acts as a silent canvas that recedes into the background, spotlighting the document conversion process.

## Colors

The palette is strictly calibrated for an immaculate light-theme environment with high textual contrast and subtle semantic indicators.

### Palette Architecture
- **Primary Canvas (`#FFFFFF`):** Pure white base for top-level windows, popups, and elevated dialogs.
- **Surface Secondary (`#FAFAFA`):** Soft off-white for dropzones, inactive states, container bays, and side trays.
- **Hairline Dividers & Borders (`#E5E7EB`):** Crisp 1px structural separation that avoids heavy visual weight.
- **Deep Indigo (`#6366F1`):** Focused primary interaction color applied to conversion triggers, focus rings, active tabs, and primary toggles.
- **Near-Black Primary Text (`#1A1A1A`):** Deep charcoal delivering maximum contrast without the harshness of pure `#000000`.
- **Muted Gray Secondary Text (`#6B7280`):** Neutral gray for supporting metadata, file details, keyboard shortcuts, and labels.
- **Muted Emerald (`#10B981`):** Reserved strictly for successful conversions, markdown ready notifications, and verified status badges.

## Typography

The typography system relies entirely on `Inter` (with `JetBrains Mono` as an auxiliary for token/markdown previews). Sizing is carefully tuned down for dense Chrome extension dimensions (typically 360px–420px width) without compromising accessibility.

- **Weight Economy:** Strict use of 400 (Regular) for data and descriptive text, 500 (Medium) for UI labels/interactive surfaces, and 600 (Semi-bold) exclusively for headers and prominent actions.
- **Negative Tracking:** Subtle negative tracking applied across all headlines gives a compact, editorial, and engineered feel typical of Linear and Notion.
- **Monospace Previews:** `JetBrains Mono` at 11px ensures code snippets, markdown blocks, and path tokens align neatly along the horizontal baseline.

## Layout & Spacing

Designed specifically for constrained Chrome extension popups (standard width: `380px`, dynamic height: `min-height: 480px`, `max-height: 580px`).

### Structure & Layout Rules
- **Base Grid:** Strict 4px/8px modular rhythm.
- **Content Margins:** Consistent outer container padding of `16px` (`space-base`) to preserve breathing room around core controls.
- **Vertical Stack Cadence:** Functional modules (Header, Dropzone, Conversion Settings, Action Bay) are separated by `12px` (`space-md`) or `16px` (`space-base`).
- **Micro-alignments:** Form controls, icon-text pairings, and inline badges adhere to strict 4px padding intervals (`space-xs` and `space-sm`).

## Elevation & Depth

Visual depth is achieved through high-craft ambient shadows and crisp hairline borders rather than heavy elevation tiers.

### Elevation Levels
- **Layer 0 (Base Canvas):** Pure `#FFFFFF` with no shadow.
- **Layer 1 (Recessed/Input):** Surface `#FAFAFA` with an inner or inset border of `1px solid #E5E7EB`. Used for dropzones, file containers, and code snippet wells.
- **Layer 2 (Floating Popovers / Tooltips / Dropdowns):** `#FFFFFF` surface with `1px solid #E5E7EB` and an ultra-diffused, ambient shadow:
  - `box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 4px 12px 0 rgba(0, 0, 0, 0.04);`
- **Focus & Interaction State:** Active inputs and key buttons leverage a diffused Indigo glow:
  - `box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px rgba(99, 102, 241, 0.2);`

## Shapes

The design adopts modern, polished curvature through the deliberate assignment of roundedness:
- **Base Components (Inputs, Buttons, Chips, Badges):** `rounded-md` (0.375rem / 6px) to `rounded-lg` (0.5rem / 8px) for crisp tactile interaction.
- **Structural Containers (Dropzone, Cards, Modal Windows):** Extended to `rounded-xl` (0.75rem / 12px) to frame content gently inside the extension canvas.
- **Status Badges & Pills:** Full pill (`9999px`) for conversion state and format tags.

## Components

### Buttons
- **Primary:** Solid `#6366F1` background, `#FFFFFF` text, `rounded-lg` (8px), height `36px`. Subtle hover shift to `#4F46E5`. Active scale down `scale-[0.99]`.
- **Secondary / Ghost:** `#FFFFFF` or transparent, `1px solid #E5E7EB`, `#1A1A1A` text. Hover changes background to `#FAFAFA` with border tint `#D1D5DB`.

### Dropzone & File Bay
- **Dropzone:** `#FAFAFA` background, 1.5px dashed `#E5E7EB`, `rounded-xl` (12px), 24px vertical padding. Active drag-over switches border to `#6366F1` and background to `rgba(99, 102, 241, 0.04)`.
- **File Card:** `#FFFFFF` tile with `1px solid #E5E7EB`, `rounded-lg` (8px), featuring document icon, truncate filename in `body-sm` (`#1A1A1A`), file size in `label-sm` (`#6B7280`), and an inline dismiss/clear trigger.

### Chips & Badges
- **Success Badge:** Background `rgba(16, 185, 129, 0.1)`, text `#047857`, border `1px solid rgba(16, 185, 129, 0.2)`, `rounded-full`, padding `2px 8px`, typography `label-sm`.
- **Format Pill (e.g., .MD, .PDF):** Background `#F3F4F6`, text `#4B5563`, `rounded-md`, 2px 6px.

### Form Inputs & Toggles
- **Checkboxes & Segmented Controls:** Low-contrast background `#F3F4F6` containers housing discrete switches. Active switch features an indigo highlight (`#6366F1`) or pure white tab with delicate shadow.
- **Input Fields (Options / Output Path):** `#FFFFFF` surface, `1px solid #E5E7EB`, `rounded-md` (6px), height `32px`, typography `body-sm`. Focused border shifts to `#6366F1`.

### Markdown Preview Well
- A recessed preview area (`#FAFAFA`, border `1px solid #E5E7EB`, `rounded-lg`) displaying raw converted markdown using `JetBrains Mono` at `code-sm`, accompanied by a one-click "Copy to Clipboard" floating secondary button.