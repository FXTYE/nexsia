# Nexsia — Project Brief

Static affiliate comparison site (no framework, no build step) deployed to Cloudflare
Pages at `nexsia.pages.dev`. Currently ~59 HTML pages. Read this before making changes —
several conventions below aren't obvious from the file structure alone.

## How the site is built

- **Pure HTML/CSS/JS.** No React, no bundler, no npm build. Every page is a
  self-contained `.html` file with its own `<style>` block for page-specific CSS.
- **Shared chrome via runtime injection.** `header.html` and `footer.html` contain
  the nav and footer markup. Every page has `<div id="site-header"></div>` and
  `<div id="site-footer"></div>` placeholders. `nexsia.js` fetches both files and
  injects them on load, then dispatches a `nexsia:chrome-ready` event once done.
  **Editing `header.html` or `footer.html` changes every page at once** — this is
  the main lever for site-wide nav/footer changes.
- **Shared CSS.** All header/footer/mega-menu/mobile-nav CSS lives in `shared.css`,
  linked via `<link rel="stylesheet" href="shared.css">` on every page. Page-specific
  CSS (hero sections, comparison tables, pricing cards, etc.) stays inline in each
  page's own `<style>` block. If something looks like site chrome, it belongs in
  `shared.css`, not inline.
- **Deploy = zip and re-upload.** There's no CI/CD. To ship changes, the whole
  directory gets zipped and manually re-uploaded to Cloudflare Pages. If a page
  looks broken on the live site but correct in the repo, the most likely explanation
  is a stale deploy, not a code bug — confirm the repo state before chasing ghosts.

## Content structure

- **22 review pages** (`<tool>-review.html`) — one per tool.
- **22 comparison pages** (`<tool>-vs-<tool>.html`) — every possible pair within
  each category has a dedicated page (e.g. all 6 pairs across the 4 Email Marketing
  tools, all 6 pairs across the 4 Web Hosting tools).
- **5 pillar/category pages** (`best-<category>.html`) — "Best X" roundup pages
  that link out to the reviews and comparisons in that category.
- **3 free tools** (`jpg-to-pdf.html`, `pdf-to-jpg.html`, `merge-pdf.html`).
- **6 utility/legal pages** — `about.html`, `contact.html`, `privacy.html`,
  `terms.html`, `review-methodology.html`, `affiliate-disclosure.html`.
- **Categories covered so far:** Creator Tools, Sales Funnels, Course Platforms,
  Copywriting Tools, Email Marketing, Web Hosting.

## Conventions that aren't obvious

### `--maxw` (content width)
Each page sets a `--maxw` CSS custom property controlling its content column width:
- `1000px` — homepage, pillar/category pages (`best-*.html`), free tools
- `960px` — the site-wide standard (reviews, comparisons — the majority of pages)
- `760px` — the 6 simple text pages (about/privacy/terms/contact/etc.) — narrower
  for reading comfort

**Important:** the header and footer should always render at the `960px` standard
regardless of the page's own `--maxw`, since `.topbar` and `footer` reuse the page's
`.wrap` class for their inner content. The 6 narrow pages need this explicit override
to stay full standard width:
```css
.topbar .wrap,footer .wrap{max-width:960px}
```
This was a real bug (header/footer visibly narrower than the rest of the site) —
already fixed on the 6 affected pages, but worth knowing if a new simple page gets
added with a non-standard `--maxw`.

### Comparison page anatomy
Every `<tool>-vs-<tool>.html` page follows the same section order and ID scheme —
useful for scripting bulk edits:
`hero` → `quickpick` → VS image-slider (drag-to-compare) → `#compare` (table) →
`#categories` (round-by-round) → `#pros-cons` → `#features` → `#pricing` →
`#fit` (decision graphic) → `#verdict` → `#faq` → related-comparisons footer.

Each comparison page defines two CSS custom properties for its brand colors:
```css
--a:#763add;   /* left-side tool's brand color */
--b:#ff5c28;   /* right-side tool's brand color */
```
`.vs-mark.a` / `.vs-mark.b`, winner-pill badges, chart bars, and the pricing card
badges all key off these — so a comparison page's colors should always derive from
`var(--a)` / `var(--b)`, not be hardcoded per-element.

### Affiliate links
Centralized in `nexsia.js` in the `AFFILIATE_LINKS` object (~30 keys). **Every
value is currently the placeholder `"#"`** — none of the real affiliate program
URLs have been filled in yet. Each `<a data-aff="toolname">` button on every page
resolves its `href` from this object at runtime. To activate a real affiliate link,
update the value in `nexsia.js` — no per-page changes needed.

### Figures with desktop/mobile variants
Custom SVG charts and decision graphics use a `.fig-desktop` / `.fig-mobile` pair
(two separate `<svg>` blocks, same content, different aspect ratios/sizing). The
responsive show/hide rule lives in `shared.css`:
```css
@media(max-width:680px){.fig-desktop{display:none}.fig-mobile{display:block;width:100%;height:auto}}
@media(min-width:681px){.fig-mobile{display:none}.fig-desktop{display:block;width:100%;height:auto}}
```
This was missing for a long stretch (43 pages affected) — both SVGs rendered
stacked on every screen size until it was added. If a new page uses this pattern
and both variants show at once, this is the first thing to check.

### Favicon
`favicon.svg` is the source of truth (navy square, white "N", orange corner flag —
matches the wordmark's orange accent on "ia"). PNG/ICO variants
(`favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`,
`apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`,
`favicon.ico`) are generated from it — if the source SVG ever changes, regenerate
all of these rather than hand-editing the PNGs.

## Known recurring bug pattern — check for this first

Across this project, the single most common bug has been **markup and content
built correctly, but the CSS to render it never written** — not a logic error, a
missing rule. This has hit:
- The `.fig-desktop`/`.fig-mobile` responsive switch (above)
- `.pc-cols`/`.pc-item`/`.tag`/`.quote` (pros & cons cards) — existed on review
  pages, was completely absent on 22 comparison pages
- `.price-cols`/`.price-card`/`.ptier` (pricing cards) and `.feat-grid`/`.feat`
  (feature grids) — same story, comparison pages only
- `.vs-mark` badge colors — a hardcoded `background:#fff` on the *base* `.vs-mark`
  rule (added to support one page's logo-image hero badge) silently broke every
  other badge reusing that class on the same page, on 4 pages

**When auditing a page or building something new, don't just check the markup is
right — actually render it and look, or grep for every class used in the markup
and confirm each one has a matching CSS rule (check both the page's own `<style>`
block and `shared.css`).** A class existing in markup with zero matching selector
is the recurring failure mode here, and it's easy to miss by only skimming code.

## Verification checklist (what a full pass should include)

For any change touching multiple pages or shared files:
1. CSS brace balance per page (`{` count == `}` count inside `<style>`)
2. `<div>` / `</div>` balance
3. `<section>` / `</section>` balance
4. Zero broken internal links (`href="*.html"` targets all exist)
5. All inline `<script>` blocks pass `node --check`
6. `nexsia.js` passes `node --check`
7. `sitemap.xml` is valid XML
8. Actually render at least one changed page in a headless browser and look at it —
   don't rely on code review alone, given the pattern above

## Sitemap

`sitemap.xml` should be kept in sync with the page list — it has gone missing
entirely from a deploy at least once before. Homepage priority `1.0`, pillar pages
`0.9`, standard content `0.8`, utility/legal pages `0.4`.
