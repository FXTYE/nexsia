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

document.addEventListener("DOMContentLoaded", function () {
  initAnalytics();
  injectPartials().then(function () {
    applyAffiliateLinks();
    trackAffiliateClicks();
    initMobileMenu();
    initMegaMenu();
    // let any per-page inline scripts (e.g. the jump-nav scroll-spy) know
    // the header/footer are now in the DOM and safe to measure.
    document.dispatchEvent(new CustomEvent("nexsia:chrome-ready"));
  });
});
