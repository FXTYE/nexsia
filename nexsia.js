/* ============================================================================
   NEXSIA SITE CONFIG  —  the ONE file you edit to update affiliate links.
   ============================================================================

   HOW TO UPDATE AN AFFILIATE LINK (no coding needed):
   1. Find the tool in the AFFILIATE_LINKS list below.
   2. Replace the "#" (or old URL) inside the quotes with your real link.
   3. Save. That's it — the link updates everywhere that tool appears on the site.

   Example — after you get approved for OpusClip, change:
        opusclip:  "#",
   to:
        opusclip:  "https://opus.pro/?via=yourname",

   Leave a link as "#" until you're approved for that program — the button
   will still show, it just won't go anywhere yet.
   ============================================================================ */

const AFFILIATE_LINKS = {
  opusclip:    "#",   // Rewardful  → opus.pro
  vidiq:       "#",   // Impact     → vidiq.com
  tubebuddy:   "#",   // (program may be closed — verify)
  elevenlabs:  "#",   // PartnerStack → elevenlabs.io
  descript:    "#",   // descript.com
  jasper:      "#",   // jasper.ai
  pictory:     "#",   // pictory.ai
  outlierkit:  "#",   // outlierkit.com
  murf:        "#",   // PartnerStack → murf.ai
  vidyo:       "#",   // vidyo.ai
  copyai:      "#",   // copy.ai
  capcut:      "#",   // capcut.com
  canva:       "#",   // (often closed — verify)
  // --- Sales funnels & all-in-one (high-ticket recurring) ---
  clickfunnels: "#",  // clickfunnels.com — ~30% recurring
  kajabi:       "#",  // kajabi.com — ~30% recurring
  gohighlevel:  "#",  // gohighlevel.com — ~40% recurring
  teachable:    "#",  // teachable.com — verify current program
  systeme:      "#",  // systeme.io — verify current program
  skool:        "#",  // skool.com — 40% recurring
  circle:       "#",  // circle.so — verify current program
  adcreative:   "#",  // adcreative.ai — verify current program
  // --- Email marketing ---
  mailchimp:     "#",  // mailchimp.com — verify current program
  kit:           "#",  // kit.com — verify current program (formerly ConvertKit)
  activecampaign: "#", // activecampaign.com — verify current program
  getresponse:    "#", // getresponse.com — verify current program
  // --- Web hosting ---
  hostinger:   "#",  // hostinger.com — verify current program
  siteground:  "#",  // siteground.com — verify current program
  bluehost:    "#",  // bluehost.com — verify current program
  cloudways:   "#",  // cloudways.com — Slab (up to $125/sale) or Hybrid ($30 + 7% lifetime recurring), 90-day cookie
  // --- AI video generators ---
  sora:        "#",  // openai.com — access via ChatGPT Plus/Pro (no separate affiliate program)
  kling:       "#",  // klingai.com — verify current program
  veo:         "#",  // gemini.google.com / Flow — access via Google AI Pro/Ultra (no separate affiliate program)
  runway:      "#",  // runwayml.com — verify current program
  higgsfield:  "#",  // higgsfield.ai — verify current program
};

/* ============================================================================
   GOOGLE ANALYTICS  —  paste your Measurement ID below to turn on tracking.
   ============================================================================

   HOW TO GET IT (2 minutes, free):
   1. Go to analytics.google.com and create a free account + property.
   2. Add a "Web" data stream for your site — it gives you a Measurement ID
      that looks like  G-XXXXXXXXXX
   3. Paste it between the quotes below, replacing the empty string.

   Once set, this automatically:
     • counts visits to every page
     • logs a "select_content" event every time someone clicks an affiliate
       button — tagged with the TOOL name and the PAGE it was clicked from
   Leave it as "" to keep analytics off (nothing breaks; it just won't track).
   ============================================================================ */

const GA4_MEASUREMENT_ID = "";   // e.g. "G-XXXXXXXXXX"

/* ============================================================================
   Everything below is machinery — you don't need to touch it.
   ============================================================================ */

/* Apply affiliate links: any <a data-aff="opusclip"> gets the URL above,
   opens in a new tab, and is tagged rel="sponsored nofollow noopener". */
function applyAffiliateLinks() {
  document.querySelectorAll("a[data-aff]").forEach(function (a) {
    var key = a.getAttribute("data-aff");
    var url = AFFILIATE_LINKS[key];
    if (url && url !== "#") {
      a.setAttribute("href", url);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "sponsored nofollow noopener");
    } else {
      a.setAttribute("href", "#");           // not approved yet
      a.setAttribute("aria-disabled", "true");
    }
  });
}

/* Load Google Analytics (only if a Measurement ID is set above). */
function initAnalytics() {
  if (!GA4_MEASUREMENT_ID) return;                 // analytics off until you add an ID
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4_MEASUREMENT_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA4_MEASUREMENT_ID);
}

/* Log every affiliate button click to GA4, tagged with the tool + page. */
function trackAffiliateClicks() {
  document.querySelectorAll("a[data-aff]").forEach(function (a) {
    a.addEventListener("click", function () {
      if (!GA4_MEASUREMENT_ID || typeof window.gtag !== "function") return;
      window.gtag("event", "affiliate_click", {
        tool: a.getAttribute("data-aff"),          // e.g. "opusclip"
        page: document.title,                       // which page they clicked from
        path: window.location.pathname              // e.g. /opusclip-review.html
      });
    });
  });
}

/* Mobile menu: toggles the .nav-open class on the topbar nav. */
function initMobileMenu() {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".topbar nav");
  if (!toggle || !nav) return;

  // Lock the page body's scroll while the mobile menu is open, so a touch
  // gesture inside the menu can never be mistaken for scrolling the page
  // behind it -- this is the fix for "menu sometimes won't scroll".
  var scrollY = 0;
  function lockBodyScroll() {
    scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = "-" + scrollY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }
  function unlockBodyScroll() {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollY);
  }

  function closeMenu() {
    nav.classList.remove("nav-open");
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    unlockBodyScroll();
  }

  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.classList.toggle("is-open", open);
    if (open) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }
  });
  // close the menu when a real link (not a dropdown trigger) is tapped
  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });
}

/* Mega-menu dropdowns: works as click-to-open on both desktop and mobile,
   since hover-only menus are unusable on touch devices. */
function initMegaMenu() {
  var items = document.querySelectorAll(".nav-item.has-drop");
  if (!items.length) return;

  function closeAll(except) {
    items.forEach(function (item) {
      if (item !== except) {
        item.classList.remove("open");
        var trig = item.querySelector(".nav-trig");
        if (trig) trig.setAttribute("aria-expanded", "false");
      }
    });
  }

  items.forEach(function (item) {
    var trig = item.querySelector(".nav-trig");
    if (!trig) return;
    trig.addEventListener("click", function (e) {
      e.stopPropagation();
      var isOpen = item.classList.contains("open");
      closeAll(item);
      item.classList.toggle("open", !isOpen);
      trig.setAttribute("aria-expanded", !isOpen ? "true" : "false");
    });
  });

  // clicking a real link inside a mega-menu should close the dropdown
  // (the outer mobile-menu handler already closes the whole nav for these)
  document.querySelectorAll(".mega a").forEach(function (link) {
    link.addEventListener("click", function () {
      closeAll(null);
    });
  });

  // click outside any dropdown closes it
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav-item.has-drop")) closeAll(null);
  });

  // escape key closes any open dropdown
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAll(null);
  });
}

/* Injects the shared header and footer partials into every page, so the
   nav/footer markup lives in one place (header.html / footer.html) instead
   of being duplicated across every page. Falls back silently if a page has
   no placeholder (e.g. during local file:// testing without a server) --
   the page still works, it just won't have chrome injected. */
function injectPartials() {
  var headerSlot = document.getElementById("site-header");
  var footerSlot = document.getElementById("site-footer");
  var tasks = [];

  if (headerSlot) {
    tasks.push(
      fetch("header.html")
        .then(function (r) { return r.ok ? r.text() : ""; })
        .then(function (html) { headerSlot.outerHTML = html; })
        .catch(function () {})
    );
  }
  if (footerSlot) {
    tasks.push(
      fetch("footer.html")
        .then(function (r) { return r.ok ? r.text() : ""; })
        .then(function (html) { footerSlot.outerHTML = html; })
        .catch(function () {})
    );
  }
  return Promise.all(tasks);
}

/* Site search index: every real page's <title> (minus " | Nexsia") and
   filename, used by the header search box. Keep in sync when adding or
   renaming pages -- there's no build step to generate this automatically. */
var SITE_PAGES = [
  {t:"About Nexsia — Why We Compare Software Honestly",u:"about.html"},
  {t:"ActiveCampaign Review 2026: Pricing, Features, Pros & Cons",u:"activecampaign-review.html"},
  {t:"AdCreative.ai Review 2026: Worth It for Ad Creatives?",u:"adcreative-review.html"},
  {t:"Affiliate Disclosure",u:"affiliate-disclosure.html"},
  {t:"Background Remover — Free, Private, No Upload",u:"background-remover.html"},
  {t:"Best AI Copywriting & Ad Tools 2026: Jasper vs Copy.ai vs AdCreative.ai",u:"best-ai-copywriting-tools.html"},
  {t:"Best AI Tools for YouTubers in 2026 (Tested & Compared)",u:"best-ai-tools-for-youtubers.html"},
  {t:"Best AI Video Generators 2026: Veo 3 vs Kling vs Runway vs Sora",u:"best-ai-video-generators.html"},
  {t:"Best Email Marketing Software 2026: Mailchimp vs Kit vs ActiveCampaign",u:"best-email-marketing-software.html"},
  {t:"Best Sales Funnel Software 2026: ClickFunnels vs Kajabi vs GoHighLevel",u:"best-sales-funnel-software.html"},
  {t:"Best Web Hosting 2026: Hostinger vs SiteGround vs Bluehost",u:"best-web-hosting.html"},
  {t:"Bluehost Review 2026: Pricing, Features, Pros & Cons",u:"bluehost-review.html"},
  {t:"Bluehost vs SiteGround 2026: Which Web Host Wins?",u:"bluehost-vs-siteground.html"},
  {t:"ClickFunnels Review 2026: Pricing, Features, Pros & Cons",u:"clickfunnels-review.html"},
  {t:"ClickFunnels vs GoHighLevel 2026: Funnels vs All-in-One",u:"clickfunnels-vs-gohighlevel.html"},
  {t:"ClickFunnels vs Kajabi 2026: Which One Fits Your Business?",u:"clickfunnels-vs-kajabi.html"},
  {t:"ClickFunnels vs Systeme.io 2026: Which Funnel Builder Wins?",u:"clickfunnels-vs-systeme.html"},
  {t:"Cloudways Review 2026: Pricing, Features, Pros & Cons",u:"cloudways-review.html"},
  {t:"Cloudways vs Bluehost 2026: Which Web Host Wins?",u:"cloudways-vs-bluehost.html"},
  {t:"Cloudways vs Hostinger 2026: Which Web Host Wins?",u:"cloudways-vs-hostinger.html"},
  {t:"Cloudways vs SiteGround 2026: Which Web Host Wins?",u:"cloudways-vs-siteground.html"},
  {t:"Contact Us",u:"contact.html"},
  {t:"Copy.ai Review 2026: GTM Platform or Overpriced Writer?",u:"copyai-review.html"},
  {t:"Descript Review 2026: Best AI Video Editor for Creators?",u:"descript-review.html"},
  {t:"Descript vs CapCut 2026: Best Editor for YouTubers?",u:"descript-vs-capcut.html"},
  {t:"ElevenLabs Review 2026: Best AI Voice for Creators?",u:"elevenlabs-review.html"},
  {t:"ElevenLabs vs Murf 2026: Best AI Voice for YouTubers?",u:"elevenlabs-vs-murf.html"},
  {t:"Favicon Generator — Every Size, Free & Private",u:"favicon-generator.html"},
  {t:"GetResponse Review 2026: Pricing, Features, Pros & Cons",u:"getresponse-review.html"},
  {t:"GetResponse vs ActiveCampaign 2026: Which Email Platform Wins?",u:"getresponse-vs-activecampaign.html"},
  {t:"GetResponse vs Mailchimp 2026: Which Email Platform Wins?",u:"getresponse-vs-mailchimp.html"},
  {t:"GoHighLevel Review 2026: Pricing, Features, Pros & Cons",u:"gohighlevel-review.html"},
  {t:"Higgsfield AI Review 2026: Pricing, Soul ID & Verdict",u:"higgsfield-review.html"},
  {t:"Hostinger Review 2026: Pricing, Features, Pros & Cons",u:"hostinger-review.html"},
  {t:"Hostinger vs Bluehost 2026: Which Web Host Wins?",u:"hostinger-vs-bluehost.html"},
  {t:"Hostinger vs SiteGround 2026: Which Web Host Wins?",u:"hostinger-vs-siteground.html"},
  {t:"Image Compressor — Free, Private, No Upload",u:"image-compressor.html"},
  {t:"Image Converter — JPG, PNG & WebP, Free & Private",u:"image-converter.html"},
  {t:"Image Resizer — Free, Private, No Upload",u:"image-resizer.html"},
  {t:"Nexsia — Honest App Comparisons for Online Businesses",u:"index.html"},
  {t:"Jasper Review 2026: Is the AI Writer Worth It for Creators?",u:"jasper-review.html"},
  {t:"Jasper vs Copy.ai 2026: Best AI Writer for Creators?",u:"jasper-vs-copyai.html"},
  {t:"JPG to PDF — Free, Private Converter (No Upload)",u:"jpg-to-pdf.html"},
  {t:"Kajabi Review 2026: Pricing, Features, Pros & Cons",u:"kajabi-review.html"},
  {t:"Kajabi vs Teachable 2026: Which Course Platform Wins?",u:"kajabi-vs-teachable.html"},
  {t:"Kit (ConvertKit) Review 2026: Pricing, Features, Pros & Cons",u:"kit-review.html"},
  {t:"Kit vs ActiveCampaign 2026: Which Email Platform Wins?",u:"kit-vs-activecampaign.html"},
  {t:"Kling AI Review 2026: Pricing, Features, Is It Worth It?",u:"kling-review.html"},
  {t:"Kling AI vs Higgsfield 2026: Direct Model vs Character Platform",u:"kling-vs-higgsfield.html"},
  {t:"Kling AI vs Runway 2026: Value vs Editing Platform",u:"kling-vs-runway.html"},
  {t:"Kling AI vs Veo 3 2026: Value vs Native Audio",u:"kling-vs-veo.html"},
  {t:"Mailchimp Review 2026: Pricing, Features, Pros & Cons",u:"mailchimp-review.html"},
  {t:"Mailchimp vs ActiveCampaign 2026: Which Email Platform Wins?",u:"mailchimp-vs-activecampaign.html"},
  {t:"Mailchimp vs Kit 2026: Which Email Platform Wins?",u:"mailchimp-vs-kit.html"},
  {t:"Merge PDF — Combine PDFs Free, No Upload",u:"merge-pdf.html"},
  {t:"OpusClip Review 2026: Features, Pricing, Pros & Cons",u:"opusclip-review.html"},
  {t:"OpusClip vs Vidyo.ai 2026: Best AI Clipping Tool?",u:"opusclip-vs-vidyo.html"},
  {t:"OutlierKit Review 2026: YouTube Outlier Research Tool",u:"outlierkit-review.html"},
  {t:"PDF to JPG — Convert PDF Pages to Images Free",u:"pdf-to-jpg.html"},
  {t:"Pictory Review 2026: Turn Scripts & Blogs into Video",u:"pictory-review.html"},
  {t:"Privacy Policy",u:"privacy.html"},
  {t:"Remove PDF Pages — Delete & Reorder, Free & Private",u:"remove-pdf-pages.html"},
  {t:"Review Methodology — How We Test AI Tools",u:"review-methodology.html"},
  {t:"Rotate PDF — Free, Private, No Upload",u:"rotate-pdf.html"},
  {t:"Runway Review 2026: Gen-4.5, Pricing & Is It Worth It?",u:"runway-review.html"},
  {t:"Runway vs Higgsfield 2026: Editing Platform vs AI Characters",u:"runway-vs-higgsfield.html"},
  {t:"SiteGround Review 2026: Pricing, Features, Pros & Cons",u:"siteground-review.html"},
  {t:"Skool Review 2026: Pricing, Features, Pros & Cons",u:"skool-review.html"},
  {t:"Skool vs Circle 2026: Which Community Platform Wins?",u:"skool-vs-circle.html"},
  {t:"Skool vs Kajabi 2026: Which Platform Wins?",u:"skool-vs-kajabi.html"},
  {t:"Sora Review 2026: Is It Still Available? (Status Explained)",u:"sora-review.html"},
  {t:"Sora vs Higgsfield 2026: Single Model vs Multi-Model Platform",u:"sora-vs-higgsfield.html"},
  {t:"Sora vs Kling AI 2026: Photorealism vs Value",u:"sora-vs-kling.html"},
  {t:"Sora vs Runway 2026: Raw Model vs Editing Platform",u:"sora-vs-runway.html"},
  {t:"Sora vs Veo 3 2026: Which AI Video Model Should You Use?",u:"sora-vs-veo.html"},
  {t:"Split PDF — Extract Pages Free, No Upload",u:"split-pdf.html"},
  {t:"Terms of Service",u:"terms.html"},
  {t:"TubeBuddy Review 2026: Pricing, Features, Pros & Cons",u:"tubebuddy-review.html"},
  {t:"Veo 3 Review 2026: Google's AI Video Model, Tested",u:"veo-review.html"},
  {t:"Veo 3 vs Higgsfield 2026: Native Audio vs AI Characters",u:"veo-vs-higgsfield.html"},
  {t:"Veo 3 vs Runway 2026: Native Audio vs Editing Platform",u:"veo-vs-runway.html"},
  {t:"vidIQ Review 2026: Pricing, Features, Pros & Cons",u:"vidiq-review.html"},
  {t:"vidIQ vs TubeBuddy 2026: Which YouTube Tool Wins?",u:"vidiq-vs-tubebuddy.html"},
  {t:"Watermark PDF — Add Text & Page Numbers Free",u:"watermark-pdf.html"}
];

/* Ranks a page URL into a rough "kind" so results can be sorted with the
   most direct answer first (a tool's own review) ahead of the pages that
   merely mention it (comparisons, roundups). Shared by the header search
   box and search.html so both rank results identically. */
var SITE_SEARCH_KIND_RANK = { review: 0, best: 1, vs: 2, other: 3 };
function siteSearchKind(u) {
  if (u.indexOf("best-") === 0) return "best";
  if (u.indexOf("-vs-") !== -1) return "vs";
  if (u.indexOf("-review.html") !== -1) return "review";
  return "other";
}

/* Filters SITE_PAGES by title substring. No backend -- pure client-side
   match against page titles, which is enough for ~75 pages. Results are
   sorted so titles starting with the query beat titles that merely
   contain it, and within a tier, a tool's own review page beats roundups
   and "X vs Y" comparisons that just happen to mention it. */
function filterSitePages(query) {
  var q = query.trim().toLowerCase();
  if (!q) return [];
  var wordRe = new RegExp("\\b" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  return SITE_PAGES
    .filter(function (p) { return p.t.toLowerCase().indexOf(q) !== -1; })
    .map(function (p) {
      var titleLower = p.t.toLowerCase();
      var tier = titleLower.indexOf(q) === 0 ? 0 : (wordRe.test(titleLower) ? 1 : 2);
      return { p: p, tier: tier, kind: SITE_SEARCH_KIND_RANK[siteSearchKind(p.u)] };
    })
    .sort(function (a, b) { return a.tier - b.tier || a.kind - b.kind; })
    .map(function (x) { return x.p; });
}

/* Header search box: always visible (no click to reveal), shows a live
   preview of the top matches as you type, and sends you to search.html
   for the full result list -- via Enter or the "See all N results" link
   once there are more matches than fit here. */
function initSiteSearch() {
  var input = document.querySelector(".search-input");
  var results = document.querySelector(".search-results");
  if (!input || !results) return;

  var MAX_PREVIEW = 6;

  function renderPreview(query) {
    results.innerHTML = "";
    var q = query.trim();
    if (!q) { results.classList.remove("show"); return; }

    var matches = filterSitePages(query);
    if (!matches.length) {
      var empty = document.createElement("div");
      empty.className = "search-empty";
      empty.textContent = "No matches for “" + q + "”";
      results.appendChild(empty);
      results.classList.add("show");
      return;
    }

    matches.slice(0, MAX_PREVIEW).forEach(function (p) {
      var a = document.createElement("a");
      a.href = p.u;
      a.textContent = p.t;
      results.appendChild(a);
    });
    if (matches.length > MAX_PREVIEW) {
      var more = document.createElement("a");
      more.className = "search-view-all";
      more.href = "search.html?q=" + encodeURIComponent(q);
      more.textContent = "See all " + matches.length + " results →";
      results.appendChild(more);
    }
    results.classList.add("show");
  }

  function goToSearchPage() {
    var q = input.value.trim();
    window.location.href = "search.html" + (q ? "?q=" + encodeURIComponent(q) : "");
  }

  input.addEventListener("input", function () { renderPreview(input.value); });
  input.addEventListener("focus", function () { renderPreview(input.value); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); goToSearchPage(); }
    if (e.key === "Escape") { results.classList.remove("show"); input.blur(); }
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav-search")) results.classList.remove("show");
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initAnalytics();
  injectPartials().then(function () {
    applyAffiliateLinks();
    trackAffiliateClicks();
    initMobileMenu();
    initMegaMenu();
    initSiteSearch();
    // let any per-page inline scripts (e.g. the jump-nav scroll-spy) know
    // the header/footer are now in the DOM and safe to measure.
    document.dispatchEvent(new CustomEvent("nexsia:chrome-ready"));
  });
});
