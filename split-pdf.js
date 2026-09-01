/* ============================================================
   Split PDF — runs entirely client-side.
   Uses pdf.js (ES module from CDN) to render page thumbnails and
   pdf-lib (loaded globally via CDN in split-pdf.html) to copy the
   selected pages into a brand-new PDF. No file is ever sent to a
   server.
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
  var pageCount = 0;
  var selected = {}; // 1-indexed page number -> boolean

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var pageGrid = document.getElementById("pageGrid");
  var optionsRow = document.getElementById("optionsRow");
  var fileCount = document.getElementById("fileCount");
  var clearBtn = document.getElementById("clearBtn");
  var splitBtn = document.getElementById("splitBtn");
  var statusBar = document.getElementById("statusBar");
  var selectAllBtn = document.getElementById("selectAllBtn");
  var selectNoneBtn = document.getElementById("selectNoneBtn");
  var rangeFrom = document.getElementById("rangeFrom");
  var rangeTo = document.getElementById("rangeTo");
  var applyRangeBtn = document.getElementById("applyRangeBtn");

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
    pageCount = 0;
    selected = {};
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
      pageCount = doc.numPages;
      for (var i = 1; i <= pageCount; i++) selected[i] = true;

      pageGrid.classList.add("show");
      optionsRow.style.display = "flex";
      rangeFrom.max = pageCount; rangeFrom.value = 1;
      rangeTo.max = pageCount; rangeTo.value = pageCount;

      for (var p = 1; p <= pageCount; p++) {
        addThumbPlaceholder(p);
      }
      updateSummary();
      renderThumbs(doc);
    } catch (err) {
      if (err && err.name === "PasswordException") {
        setStatus("error", "This PDF is password-protected and can't be read in the browser. Remove the password first.");
      } else {
        setStatus("error", "Couldn't read this PDF: " + (err && err.message ? err.message : "unknown error") + ".");
      }
    }
  }

  function addThumbPlaceholder(pageNum) {
    var thumb = document.createElement("div");
    thumb.className = "page-thumb selected";
    thumb.dataset.page = pageNum;

    var loading = document.createElement("div");
    loading.className = "loading";
    loading.textContent = "…";
    thumb.appendChild(loading);

    var pg = document.createElement("span");
    pg.className = "pg";
    pg.textContent = pageNum;
    thumb.appendChild(pg);

    var chk = document.createElement("span");
    chk.className = "chk";
    chk.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    thumb.appendChild(chk);

    thumb.addEventListener("click", function () {
      selected[pageNum] = !selected[pageNum];
      thumb.classList.toggle("selected", selected[pageNum]);
      updateSummary();
    });

    pageGrid.appendChild(thumb);
  }

  async function renderThumbs(doc) {
    for (var i = 1; i <= pageCount; i++) {
      try {
        var page = await doc.getPage(i);
        var viewport = page.getViewport({ scale: 0.4 });
        var canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        var ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        var thumb = pageGrid.querySelector('.page-thumb[data-page="' + i + '"]');
        if (thumb) {
          var loadingEl = thumb.querySelector(".loading");
          if (loadingEl) loadingEl.remove();
          var img = document.createElement("img");
          img.src = canvas.toDataURL("image/jpeg", 0.7);
          img.alt = "Page " + i;
          thumb.insertBefore(img, thumb.firstChild);
        }
      } catch (err) {
        console.error("Could not render page " + i, err);
      }
    }
  }

  function updateSummary() {
    var count = Object.keys(selected).filter(function (k) { return selected[k]; }).length;
    fileCount.textContent = count + " of " + pageCount + " page" + (pageCount === 1 ? "" : "s") + " selected";
    splitBtn.disabled = count === 0;
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

  selectAllBtn.addEventListener("click", function () {
    for (var i = 1; i <= pageCount; i++) selected[i] = true;
    pageGrid.querySelectorAll(".page-thumb").forEach(function (t) { t.classList.add("selected"); });
    updateSummary();
  });
  selectNoneBtn.addEventListener("click", function () {
    for (var i = 1; i <= pageCount; i++) selected[i] = false;
    pageGrid.querySelectorAll(".page-thumb").forEach(function (t) { t.classList.remove("selected"); });
    updateSummary();
  });
  applyRangeBtn.addEventListener("click", function () {
    var from = Math.max(1, Number(rangeFrom.value) || 1);
    var to = Math.min(pageCount, Number(rangeTo.value) || pageCount);
    if (from > to) { var tmp = from; from = to; to = tmp; }
    for (var i = 1; i <= pageCount; i++) selected[i] = (i >= from && i <= to);
    pageGrid.querySelectorAll(".page-thumb").forEach(function (t) {
      var p = Number(t.dataset.page);
      t.classList.toggle("selected", selected[p]);
    });
    updateSummary();
  });

  /* ---- the actual split ---- */

  async function split() {
    if (!currentFile) return;
    var pagesToExtract = [];
    for (var i = 1; i <= pageCount; i++) if (selected[i]) pagesToExtract.push(i - 1); // pdf-lib is 0-indexed
    if (!pagesToExtract.length) return;

    splitBtn.disabled = true;
    setStatus("working", '<span class="spinner"></span><span>Extracting pages…</span>');

    try {
      if (typeof PDFLib === "undefined") {
        throw new Error("The PDF engine failed to load. Check your connection and try again.");
      }
      var bytes = await readFileAsArrayBuffer(currentFile);
      var srcDoc = await PDFLib.PDFDocument.load(bytes);
      var outDoc = await PDFLib.PDFDocument.create();
      var copiedPages = await outDoc.copyPages(srcDoc, pagesToExtract);
      copiedPages.forEach(function (p) { outDoc.addPage(p); });

      var outBytes = await outDoc.save();
      downloadPdf(outBytes);
      setStatus("success", "✓ " + pagesToExtract.length + " page" + (pagesToExtract.length === 1 ? "" : "s") + " extracted and downloading now.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong splitting this PDF: " + (err && err.message ? err.message : "unknown error") + ".");
    } finally {
      splitBtn.disabled = false;
    }
  }

  function downloadPdf(bytes) {
    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var base = currentFile.name.replace(/\.pdf$/i, "");
    a.download = base + "-split.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  splitBtn.addEventListener("click", split);
})();
