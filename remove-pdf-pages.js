/* ============================================================
   Remove / Reorder PDF Pages — runs entirely client-side.
   Uses pdf.js (ES module from CDN) to render page thumbnails and
   pdf-lib (loaded globally via CDN in remove-pdf-pages.html) to
   copy the surviving pages, in their new order, into a fresh PDF.
   No file is ever sent to a server.
   ============================================================ */

var PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.624/pdf.min.mjs";
var PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.624/pdf.worker.min.mjs";

(function () {
  "use strict";

  var pdfjsLib = null;
  function loadPdfJs() {
    if (pdfjsLib) return Promise.resolve(pdfjsLib);
    return import(/* webpackIgnore: true */ PDFJS_URL).then(function (mod) {
      mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      pdfjsLib = mod;
      return pdfjsLib;
    });
  }

  var currentFile = null;
  var pages = []; // { id, originalIndex (0-based), removed }
  var nextId = 1;

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var pageGrid = document.getElementById("pageGrid");
  var optionsRow = document.getElementById("optionsRow");
  var fileCount = document.getElementById("fileCount");
  var clearBtn = document.getElementById("clearBtn");
  var saveBtn = document.getElementById("saveBtn");
  var statusBar = document.getElementById("statusBar");

  if (!dropZone) return; // this script only runs on the tool page

  function setStatus(kind, html) {
    statusBar.className = "status-bar show " + kind;
    statusBar.innerHTML = html;
  }
  function clearStatus() {
    statusBar.className = "status-bar";
    statusBar.innerHTML = "";
  }

  function readFileAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("Could not read " + file.name)); };
      reader.readAsArrayBuffer(file);
    });
  }

  function reset() {
    currentFile = null;
    pages = [];
    pageGrid.innerHTML = "";
    pageGrid.classList.remove("show");
    optionsRow.style.display = "none";
    clearStatus();
  }

  async function handleFile(file) {
    var isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setStatus("error", "“" + file.name + "” isn't a PDF. Only PDF files are supported.");
      return;
    }
    reset();
    currentFile = file;
    clearStatus();

    try {
      var lib = await loadPdfJs();
      var bytes = await readFileAsArrayBuffer(file);
      var doc = await lib.getDocument({ data: bytes }).promise;
      var count = doc.numPages;
      for (var i = 0; i < count; i++) {
        pages.push({ id: nextId++, originalIndex: i, removed: false });
      }

      pageGrid.classList.add("show");
      optionsRow.style.display = "flex";
      render();
      renderThumbs(doc);
    } catch (err) {
      if (err && err.name === "PasswordException") {
        setStatus("error", "This PDF is password-protected and can't be read in the browser. Remove the password first.");
      } else {
        setStatus("error", "Couldn't read this PDF: " + (err && err.message ? err.message : "unknown error") + ".");
      }
    }
  }

  function render() {
    pageGrid.innerHTML = "";
    pages.forEach(function (p, displayIdx) {
      var thumb = document.createElement("div");
      thumb.className = "page-thumb" + (p.removed ? " removed" : "");
      thumb.draggable = true;
      thumb.dataset.id = p.id;

      var loading = document.createElement("div");
      loading.className = "loading";
      loading.textContent = "…";
      loading.dataset.role = "loading";
      thumb.appendChild(loading);

      if (p.dataUrl) {
        var img = document.createElement("img");
        img.src = p.dataUrl;
        img.alt = "Page " + (p.originalIndex + 1);
        thumb.insertBefore(img, thumb.firstChild);
        var l = thumb.querySelector('[data-role="loading"]');
        if (l) l.remove();
      }

      var pg = document.createElement("span");
      pg.className = "pg";
      pg.textContent = "Page " + (p.originalIndex + 1);
      thumb.appendChild(pg);

      var rm = document.createElement("button");
      rm.className = "rm";
      rm.type = "button";
      rm.setAttribute("aria-label", p.removed ? "Restore this page" : "Remove this page");
      rm.innerHTML = p.removed
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>'
        : "&times;";
      rm.addEventListener("click", function (e) {
        e.stopPropagation();
        p.removed = !p.removed;
        render();
      });
      thumb.appendChild(rm);

      addDragHandlers(thumb, p.id);
      pageGrid.appendChild(thumb);
    });
    updateSummary();
  }

  async function renderThumbs(doc) {
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      try {
        var page = await doc.getPage(p.originalIndex + 1);
        var viewport = page.getViewport({ scale: 0.4 });
        var canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        var ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        p.dataUrl = canvas.toDataURL("image/jpeg", 0.7);

        var thumbEl = pageGrid.querySelector('.page-thumb[data-id="' + p.id + '"]');
        if (thumbEl) {
          var loadingEl = thumbEl.querySelector('[data-role="loading"]');
          if (loadingEl) loadingEl.remove();
          var img = document.createElement("img");
          img.src = p.dataUrl;
          img.alt = "Page " + (p.originalIndex + 1);
          thumbEl.insertBefore(img, thumbEl.firstChild);
        }
      } catch (err) {
        console.error("Could not render page " + (p.originalIndex + 1), err);
      }
    }
  }

  function updateSummary() {
    var remaining = pages.filter(function (p) { return !p.removed; }).length;
    fileCount.textContent = remaining + " of " + pages.length + " page" + (pages.length === 1 ? "" : "s") + " kept";
    saveBtn.disabled = remaining === 0;
  }

  /* ---- drag-to-reorder ---- */
  var dragSrcId = null;
  function addDragHandlers(el, id) {
    el.addEventListener("dragstart", function () {
      dragSrcId = id;
      el.classList.add("dragging");
    });
    el.addEventListener("dragend", function () {
      el.classList.remove("dragging");
    });
    el.addEventListener("dragover", function (e) { e.preventDefault(); });
    el.addEventListener("drop", function (e) {
      e.preventDefault();
      if (dragSrcId === null || dragSrcId === id) return;
      var srcIdx = pages.findIndex(function (p) { return p.id === dragSrcId; });
      var tgtIdx = pages.findIndex(function (p) { return p.id === id; });
      if (srcIdx === -1 || tgtIdx === -1) return;
      var moved = pages.splice(srcIdx, 1)[0];
      pages.splice(tgtIdx, 0, moved);
      render();
    });
  }

  /* ---- input wiring ---- */
  dropZone.addEventListener("click", function () { fileInput.click(); });
  dropZone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
    fileInput.value = "";
  });
  ["dragenter", "dragover"].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
  });
  ["dragleave", "drop"].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
    });
  });
  dropZone.addEventListener("drop", function (e) {
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  clearBtn.addEventListener("click", reset);

  /* ---- the actual save ---- */

  async function save() {
    if (!currentFile) return;
    var keep = pages.filter(function (p) { return !p.removed; });
    if (!keep.length) return;

    saveBtn.disabled = true;
    setStatus("working", '<span class="spinner"></span><span>Building your PDF…</span>');

    try {
      if (typeof PDFLib === "undefined") {
        throw new Error("The PDF engine failed to load. Check your connection and try again.");
      }
      var bytes = await readFileAsArrayBuffer(currentFile);
      var srcDoc = await PDFLib.PDFDocument.load(bytes);
      var outDoc = await PDFLib.PDFDocument.create();
      var indices = keep.map(function (p) { return p.originalIndex; });
      var copiedPages = await outDoc.copyPages(srcDoc, indices);
      copiedPages.forEach(function (p) { outDoc.addPage(p); });

      var outBytes = await outDoc.save();
      downloadPdf(outBytes);
      setStatus("success", "✓ Your PDF is ready and downloading now — " + keep.length + " of " + pages.length + " pages kept.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong saving this PDF: " + (err && err.message ? err.message : "unknown error") + ".");
    } finally {
      saveBtn.disabled = false;
    }
  }

  function downloadPdf(bytes) {
    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var base = currentFile.name.replace(/\.pdf$/i, "");
    a.download = base + "-edited.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  saveBtn.addEventListener("click", save);
})();
