/* ============================================================
   Rotate PDF — runs entirely client-side.
   Uses pdf.js (ES module from CDN) to render page thumbnails and
   pdf-lib (loaded globally via CDN in rotate-pdf.html) to apply
   each page's rotation to the PDF's own metadata and re-save. No
   file is ever sent to a server.
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
  var rotations = {}; // 1-indexed page number -> degrees (0/90/180/270), relative to original

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var pageGrid = document.getElementById("pageGrid");
  var optionsRow = document.getElementById("optionsRow");
  var fileCount = document.getElementById("fileCount");
  var clearBtn = document.getElementById("clearBtn");
  var rotateBtn = document.getElementById("rotateBtn");
  var statusBar = document.getElementById("statusBar");
  var rotateAllBtn = document.getElementById("rotateAllBtn");

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
    rotations = {};
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
      for (var i = 1; i <= pageCount; i++) rotations[i] = 0;

      pageGrid.classList.add("show");
      optionsRow.style.display = "flex";

      for (var p = 1; p <= pageCount; p++) addThumbPlaceholder(p);
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
    thumb.className = "page-thumb";
    thumb.dataset.page = pageNum;

    var imWrap = document.createElement("div");
    imWrap.className = "im-wrap";
    var loading = document.createElement("div");
    loading.className = "loading";
    loading.textContent = "…";
    imWrap.appendChild(loading);
    thumb.appendChild(imWrap);

    var pg = document.createElement("span");
    pg.className = "pg";
    pg.textContent = pageNum;
    thumb.appendChild(pg);

    var rotBtn = document.createElement("button");
    rotBtn.className = "rot-btn";
    rotBtn.type = "button";
    rotBtn.setAttribute("aria-label", "Rotate page " + pageNum);
    rotBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/></svg>';
    rotBtn.addEventListener("click", function () {
      rotatePage(pageNum);
    });
    thumb.appendChild(rotBtn);

    pageGrid.appendChild(thumb);
  }

  function rotatePage(pageNum) {
    rotations[pageNum] = (rotations[pageNum] + 90) % 360;
    var thumb = pageGrid.querySelector('.page-thumb[data-page="' + pageNum + '"] .im-wrap');
    if (thumb) thumb.style.transform = "rotate(" + rotations[pageNum] + "deg)";
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

        var imWrap = pageGrid.querySelector('.page-thumb[data-page="' + i + '"] .im-wrap');
        if (imWrap) {
          imWrap.innerHTML = "";
          var img = document.createElement("img");
          img.src = canvas.toDataURL("image/jpeg", 0.7);
          img.alt = "Page " + i;
          imWrap.appendChild(img);
        }
      } catch (err) {
        console.error("Could not render page " + i, err);
      }
    }
  }

  function updateSummary() {
    fileCount.textContent = pageCount + " page" + (pageCount === 1 ? "" : "s");
    rotateBtn.disabled = pageCount === 0;
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

  rotateAllBtn.addEventListener("click", function () {
    for (var i = 1; i <= pageCount; i++) rotatePage(i);
  });

  /* ---- the actual rotation ---- */

  async function rotateAndSave() {
    if (!currentFile) return;

    rotateBtn.disabled = true;
    setStatus("working", '<span class="spinner"></span><span>Applying rotation…</span>');

    try {
      if (typeof PDFLib === "undefined") {
        throw new Error("The PDF engine failed to load. Check your connection and try again.");
      }
      var bytes = await readFileAsArrayBuffer(currentFile);
      var pdfDoc = await PDFLib.PDFDocument.load(bytes);
      var pages = pdfDoc.getPages();

      pages.forEach(function (page, idx) {
        var pageNum = idx + 1;
        var addDeg = rotations[pageNum] || 0;
        if (addDeg) {
          var current = page.getRotation().angle;
          page.setRotation(PDFLib.degrees((current + addDeg) % 360));
        }
      });

      var outBytes = await pdfDoc.save();
      downloadPdf(outBytes);
      setStatus("success", "✓ Your rotated PDF is ready and downloading now.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong rotating this PDF: " + (err && err.message ? err.message : "unknown error") + ".");
    } finally {
      rotateBtn.disabled = false;
    }
  }

  function downloadPdf(bytes) {
    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var base = currentFile.name.replace(/\.pdf$/i, "");
    a.download = base + "-rotated.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  rotateBtn.addEventListener("click", rotateAndSave);
})();
