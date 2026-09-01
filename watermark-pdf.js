/* ============================================================
   Watermark PDF — runs entirely client-side.
   Uses pdf.js (ES module from CDN) to render a first-page
   preview and pdf-lib (loaded globally via CDN in
   watermark-pdf.html) to draw the watermark text and/or page
   numbers onto every page and re-save. No file is ever sent to
   a server.
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

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var fileInfoRow = document.getElementById("fileInfoRow");
  var fileName = document.getElementById("fileName");
  var fileMeta = document.getElementById("fileMeta");
  var clearBtn = document.getElementById("clearBtn");
  var previewWrap = document.getElementById("previewWrap");
  var previewFrame = document.getElementById("previewFrame");
  var wmOverlay = document.getElementById("wmOverlay");
  var pnOverlay = document.getElementById("pnOverlay");
  var formGrid = document.getElementById("formGrid");
  var statusBar = document.getElementById("statusBar");

  var wmEnabled = document.getElementById("wmEnabled");
  var wmFields = document.getElementById("wmFields");
  var wmText = document.getElementById("wmText");
  var wmColor = document.getElementById("wmColor");
  var wmOpacity = document.getElementById("wmOpacity");
  var wmOpacityVal = document.getElementById("wmOpacityVal");
  var wmSize = document.getElementById("wmSize");
  var wmSizeVal = document.getElementById("wmSizeVal");

  var pnEnabled = document.getElementById("pnEnabled");
  var pnFields = document.getElementById("pnFields");
  var pnPosition = document.getElementById("pnPosition");
  var pnFormat = document.getElementById("pnFormat");

  var applyBtn = document.getElementById("applyBtn");

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
    fileInfoRow.classList.remove("show");
    previewWrap.classList.remove("show");
    formGrid.style.display = "none";
    previewFrame.querySelectorAll("canvas").forEach(function (c) { c.remove(); });
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
    fileName.textContent = file.name;
    fileInfoRow.classList.add("show");

    try {
      var lib = await loadPdfJs();
      var bytes = await readFileAsArrayBuffer(file);
      var doc = await lib.getDocument({ data: bytes }).promise;
      pageCount = doc.numPages;
      fileMeta.textContent = pageCount + " page" + (pageCount === 1 ? "" : "s");

      var page = await doc.getPage(1);
      var viewport = page.getViewport({ scale: 0.6 });
      var canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      var ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      previewFrame.insertBefore(canvas, wmOverlay);

      previewWrap.classList.add("show");
      formGrid.style.display = "flex";
      updatePreview();
    } catch (err) {
      if (err && err.name === "PasswordException") {
        setStatus("error", "This PDF is password-protected and can't be read in the browser. Remove the password first.");
      } else {
        setStatus("error", "Couldn't read this PDF: " + (err && err.message ? err.message : "unknown error") + ".");
      }
    }
  }

  function updatePreview() {
    wmFields.classList.toggle("hidden", !wmEnabled.checked);
    pnFields.classList.toggle("hidden", !pnEnabled.checked);
    wmOpacityVal.textContent = wmOpacity.value + "%";
    wmSizeVal.textContent = wmSize.value;

    if (wmEnabled.checked) {
      wmOverlay.style.display = "flex";
      wmOverlay.textContent = wmText.value || "CONFIDENTIAL";
      wmOverlay.style.color = wmColor.value;
      wmOverlay.style.opacity = Number(wmOpacity.value) / 100;
      wmOverlay.style.fontSize = (Number(wmSize.value) / 3.2) + "px";
      wmOverlay.style.transform = "rotate(-45deg)";
    } else {
      wmOverlay.style.display = "none";
    }

    if (pnEnabled.checked) {
      pnOverlay.style.display = "block";
      var sample = pnFormat.value === "number" ? "1" : "Page 1 of " + pageCount;
      pnOverlay.textContent = sample;
      pnOverlay.style.textAlign = pnPosition.value === "bottom-left" ? "left"
        : pnPosition.value === "bottom-right" ? "right" : "center";
      pnOverlay.style.padding = pnPosition.value === "bottom-left" ? "0 0 0 10px"
        : pnPosition.value === "bottom-right" ? "0 10px 0 0" : "0";
    } else {
      pnOverlay.style.display = "none";
    }
  }

  [wmEnabled, wmText, wmColor, wmOpacity, wmSize, pnEnabled, pnPosition, pnFormat].forEach(function (el) {
    el.addEventListener("input", updatePreview);
    el.addEventListener("change", updatePreview);
  });

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

  /* ---- the actual stamping ---- */

  function hexToRgb01(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
  }

  async function apply() {
    if (!currentFile) return;
    if (!wmEnabled.checked && !pnEnabled.checked) {
      setStatus("error", "Turn on at least one of the watermark or page numbers before applying.");
      return;
    }

    applyBtn.disabled = true;
    setStatus("working", '<span class="spinner"></span><span>Stamping every page…</span>');

    try {
      if (typeof PDFLib === "undefined") {
        throw new Error("The PDF engine failed to load. Check your connection and try again.");
      }
      var bytes = await readFileAsArrayBuffer(currentFile);
      var pdfDoc = await PDFLib.PDFDocument.load(bytes);
      var font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      var pages = pdfDoc.getPages();
      var total = pages.length;

      var wmString = wmText.value || "CONFIDENTIAL";
      var wmSizeNum = Number(wmSize.value);
      var wmColorRgb = hexToRgb01(wmColor.value);
      var wmOpacityNum = Number(wmOpacity.value) / 100;
      var angleDeg = 45;
      var angleRad = (angleDeg * Math.PI) / 180;

      pages.forEach(function (page, idx) {
        var pageW = page.getWidth();
        var pageH = page.getHeight();

        if (wmEnabled.checked) {
          var textWidth = font.widthOfTextAtSize(wmString, wmSizeNum);
          var cx = pageW / 2;
          var cy = pageH / 2;
          var x = cx - (textWidth / 2) * Math.cos(angleRad);
          var y = cy - (textWidth / 2) * Math.sin(angleRad);
          page.drawText(wmString, {
            x: x, y: y, size: wmSizeNum, font: font,
            color: PDFLib.rgb(wmColorRgb.r, wmColorRgb.g, wmColorRgb.b),
            opacity: wmOpacityNum,
            rotate: PDFLib.degrees(angleDeg)
          });
        }

        if (pnEnabled.checked) {
          var pnText = pnFormat.value === "number" ? String(idx + 1) : "Page " + (idx + 1) + " of " + total;
          var pnSize = 10;
          var pnWidth = font.widthOfTextAtSize(pnText, pnSize);
          var margin = 24;
          var px;
          if (pnPosition.value === "bottom-left") px = margin;
          else if (pnPosition.value === "bottom-right") px = pageW - margin - pnWidth;
          else px = (pageW - pnWidth) / 2;
          page.drawText(pnText, {
            x: px, y: margin * 0.6, size: pnSize, font: font,
            color: PDFLib.rgb(0.4, 0.46, 0.55)
          });
        }
      });

      var outBytes = await pdfDoc.save();
      downloadPdf(outBytes);
      setStatus("success", "✓ Your PDF is ready and downloading now.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong stamping this PDF: " + (err && err.message ? err.message : "unknown error") + ".");
    } finally {
      applyBtn.disabled = false;
    }
  }

  function downloadPdf(bytes) {
    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var base = currentFile.name.replace(/\.pdf$/i, "");
    a.download = base + "-watermarked.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  applyBtn.addEventListener("click", apply);
})();
