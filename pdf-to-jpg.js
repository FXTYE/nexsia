/* ============================================================
   PDF to JPG — runs entirely client-side.
   Uses pdf.js (loaded as an ES module from the CDN, pinned to
   5.4.624 to match the worker version) to render each PDF page
   onto a canvas, then exports each canvas as a JPG. JSZip
   bundles everything into one download. No file is ever sent
   to a server.
   ============================================================ */

import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.624/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.624/pdf.worker.min.mjs";

(function () {
  "use strict";

  var currentFile = null;
  var pages = []; // { index, dataUrl, blob }

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var fileGrid = document.getElementById("fileGrid");
  var resultGrid = document.getElementById("resultGrid");
  var optionsRow = document.getElementById("optionsRow");
  var fileCount = document.getElementById("fileCount");
  var clearBtn = document.getElementById("clearBtn");
  var convertBtn = document.getElementById("convertBtn");
  var qualitySelect = document.getElementById("quality");
  var statusBar = document.getElementById("statusBar");
  var resultsActions = document.getElementById("resultsActions");
  var resultCount = document.getElementById("resultCount");
  var downloadAllBtn = document.getElementById("downloadAllBtn");

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

  function docIconSvg() {
    return '<svg width="20" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  }

  async function addFile(file) {
    var isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setStatus("error", "\u201c" + file.name + "\u201d isn't a PDF. Only PDF files are supported.");
      return;
    }
    clearStatus();
    currentFile = { file: file, pageCount: null, error: null };
    resultGrid.innerHTML = "";
    resultsActions.classList.remove("show");
    pages = [];
    renderFileCard();

    try {
      var bytes = await readFileAsArrayBuffer(file);
      var doc = await pdfjsLib.getDocument({ data: bytes }).promise;
      currentFile.pageCount = doc.numPages;
      currentFile.doc = doc;
    } catch (err) {
      if (err && err.name === "PasswordException") {
        currentFile.error = "Password-protected — can't be converted";
      } else {
        currentFile.error = "Couldn't read this file";
      }
    }
    renderFileCard();
  }

  function renderFileCard() {
    fileGrid.innerHTML = "";
    if (!currentFile) return;

    var thumb = document.createElement("div");
    thumb.className = "file-thumb";

    var icon = document.createElement("div");
    icon.className = "doc-ic";
    icon.innerHTML = docIconSvg();
    thumb.appendChild(icon);

    var info = document.createElement("div");
    info.className = "doc-info";
    var nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = currentFile.file.name;
    info.appendChild(nm);
    var meta = document.createElement("div");
    meta.className = "meta";
    if (currentFile.error) {
      meta.textContent = currentFile.error;
      meta.style.color = "var(--bad)";
    } else if (currentFile.pageCount === null) {
      meta.textContent = "Reading\u2026";
    } else {
      meta.textContent = currentFile.pageCount + " page" + (currentFile.pageCount === 1 ? "" : "s");
    }
    info.appendChild(meta);
    thumb.appendChild(info);

    var rm = document.createElement("button");
    rm.className = "rm";
    rm.type = "button";
    rm.setAttribute("aria-label", "Remove " + currentFile.file.name);
    rm.innerHTML = "&times;";
    rm.addEventListener("click", function () {
      currentFile = null;
      pages = [];
      fileGrid.innerHTML = "";
      resultGrid.innerHTML = "";
      resultsActions.classList.remove("show");
      optionsRow.style.display = "none";
      clearStatus();
    });
    thumb.appendChild(rm);

    fileGrid.appendChild(thumb);

    var hasError = !!currentFile.error;
    optionsRow.style.display = "flex";
    fileCount.textContent = hasError ? "" : (currentFile.pageCount === null ? "" : currentFile.pageCount + " page" + (currentFile.pageCount === 1 ? "" : "s") + " ready to convert");
    convertBtn.disabled = hasError || currentFile.pageCount === null;
  }

  /* ---- input wiring ---- */
  dropZone.addEventListener("click", function () { fileInput.click(); });
  dropZone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files.length) addFile(fileInput.files[0]);
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
    if (e.dataTransfer.files.length) addFile(e.dataTransfer.files[0]);
  });

  clearBtn.addEventListener("click", function () {
    currentFile = null;
    pages = [];
    fileGrid.innerHTML = "";
    resultGrid.innerHTML = "";
    resultsActions.classList.remove("show");
    optionsRow.style.display = "none";
    clearStatus();
  });

  /* ---- the actual conversion ---- */

  async function convert() {
    if (!currentFile || currentFile.error || !currentFile.doc) return;

    convertBtn.disabled = true;
    setStatus("working", '<span class="spinner"></span><span id="progressText">Preparing\u2026</span>');
    var progressText = document.getElementById("progressText");

    try {
      var doc = currentFile.doc;
      var quality = parseFloat(qualitySelect.value);
      pages = [];
      resultGrid.innerHTML = "";

      for (var i = 1; i <= doc.numPages; i++) {
        if (progressText) progressText.textContent = "Rendering page " + i + " of " + doc.numPages + "\u2026";

        var page = await doc.getPage(i);
        var viewport = page.getViewport({ scale: 2.0 });
        var canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        var ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        var blob = await new Promise(function (resolve) {
          canvas.toBlob(resolve, "image/jpeg", quality);
        });
        var dataUrl = canvas.toDataURL("image/jpeg", quality);

        pages.push({ index: i, dataUrl: dataUrl, blob: blob });
        addResultCard(i, dataUrl, doc.numPages);
      }

      resultsActions.classList.add("show");
      resultCount.textContent = pages.length + " page" + (pages.length === 1 ? "" : "s") + " converted";
      setStatus("success", "\u2713 All pages converted. Download individually or grab them all as a ZIP.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong converting this PDF: " + (err && err.message ? err.message : "unknown error") + ".");
    } finally {
      convertBtn.disabled = false;
    }
  }

  function addResultCard(index, dataUrl, total) {
    var card = document.createElement("div");
    card.className = "result-card";

    var img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "Page " + index + " of " + total;
    card.appendChild(img);

    var foot = document.createElement("div");
    foot.className = "rc-foot";
    var span = document.createElement("span");
    span.textContent = "Page " + index;
    foot.appendChild(span);

    var dlBtn = document.createElement("button");
    dlBtn.className = "rc-dl";
    dlBtn.type = "button";
    dlBtn.setAttribute("aria-label", "Download page " + index);
    dlBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>';
    dlBtn.addEventListener("click", function () {
      downloadDataUrl(dataUrl, filenameFor(index));
    });
    foot.appendChild(dlBtn);

    card.appendChild(foot);
    resultGrid.appendChild(card);
  }

  function filenameFor(index) {
    var base = currentFile.file.name.replace(/\.pdf$/i, "");
    return base + "-page-" + index + ".jpg";
  }

  function downloadDataUrl(dataUrl, filename) {
    var a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function downloadAllAsZip() {
    if (!pages.length || typeof JSZip === "undefined") {
      setStatus("error", "The ZIP engine failed to load. Try downloading pages individually instead.");
      return;
    }
    downloadAllBtn.disabled = true;
    var originalText = downloadAllBtn.textContent;
    downloadAllBtn.textContent = "Building ZIP\u2026";

    try {
      var zip = new JSZip();
      pages.forEach(function (p) {
        zip.file(filenameFor(p.index), p.blob);
      });
      var zipBlob = await zip.generateAsync({ type: "blob" });
      var url = URL.createObjectURL(zipBlob);
      var a = document.createElement("a");
      a.href = url;
      var base = currentFile.file.name.replace(/\.pdf$/i, "");
      a.download = base + "-pages.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (err) {
      console.error(err);
      setStatus("error", "Couldn't build the ZIP file. Try downloading pages individually instead.");
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = originalText;
    }
  }

  convertBtn.addEventListener("click", convert);
  downloadAllBtn.addEventListener("click", downloadAllAsZip);
})();
