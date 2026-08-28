/* ============================================================
   Favicon Generator — runs entirely client-side.
   Draws the source image onto a square canvas at each target
   size and exports PNGs, plus packs a real multi-resolution
   .ico file by embedding PNG data directly (the format Windows
   Vista+ and every modern browser accepts). No file is ever
   sent to a server.
   ============================================================ */

(function () {
  "use strict";

  var PNG_SIZES = [
    { size: 16, label: "16×16", filename: "favicon-16x16.png" },
    { size: 32, label: "32×32", filename: "favicon-32x32.png" },
    { size: 48, label: "48×48", filename: "favicon-48x48.png" },
    { size: 180, label: "180×180", filename: "apple-touch-icon.png" },
    { size: 192, label: "192×192", filename: "android-chrome-192x192.png" },
    { size: 512, label: "512×512", filename: "android-chrome-512x512.png" }
  ];
  var ICO_SIZES = [16, 32, 48];

  var srcImage = null;   // HTMLImageElement
  var srcFile = null;
  var results = [];      // { filename, label, blob, url }
  var icoBlob = null;

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var srcRow = document.getElementById("srcRow");
  var srcPreview = document.getElementById("srcPreview");
  var srcName = document.getElementById("srcName");
  var srcMeta = document.getElementById("srcMeta");
  var clearBtn = document.getElementById("clearBtn");
  var iconGrid = document.getElementById("iconGrid");
  var statusBar = document.getElementById("statusBar");
  var resultsActions = document.getElementById("resultsActions");
  var resultCount = document.getElementById("resultCount");
  var downloadAllBtn = document.getElementById("downloadAllBtn");

  if (!dropZone) return; // this script only runs on the tool page

  var ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

  function setStatus(kind, html) {
    statusBar.className = "status-bar show " + kind;
    statusBar.innerHTML = html;
  }
  function clearStatus() {
    statusBar.className = "status-bar";
    statusBar.innerHTML = "";
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Could not load image")); };
      img.src = src;
    });
  }

  /* draws the source, center-cropped to a square, at the given size */
  function renderAtSize(img, size) {
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    var srcW = img.naturalWidth || img.width;
    var srcH = img.naturalHeight || img.height;
    var cropSize = Math.min(srcW, srcH);
    var sx = (srcW - cropSize) / 2;
    var sy = (srcH - cropSize) / 2;
    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, size, size);
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, "image/png");
    });
  }

  /* ---- minimal ICO packer: embeds PNG data directly per ICONDIRENTRY ---- */
  function buildIco(entries) {
    // entries: [{ size, buffer }] where buffer is an ArrayBuffer of PNG bytes
    var count = entries.length;
    var headerSize = 6 + count * 16;
    var totalSize = headerSize + entries.reduce(function (s, e) { return s + e.buffer.byteLength; }, 0);
    var buf = new ArrayBuffer(totalSize);
    var view = new DataView(buf);

    view.setUint16(0, 0, true);      // reserved
    view.setUint16(2, 1, true);      // type: 1 = icon
    view.setUint16(4, count, true);  // image count

    var dataOffset = headerSize;
    var entryOffset = 6;
    entries.forEach(function (e) {
      var dim = e.size >= 256 ? 0 : e.size; // 0 means 256px per the ICO spec
      view.setUint8(entryOffset, dim);        // width
      view.setUint8(entryOffset + 1, dim);    // height
      view.setUint8(entryOffset + 2, 0);      // color palette count
      view.setUint8(entryOffset + 3, 0);      // reserved
      view.setUint16(entryOffset + 4, 1, true);   // color planes
      view.setUint16(entryOffset + 6, 32, true);  // bits per pixel
      view.setUint32(entryOffset + 8, e.buffer.byteLength, true); // data size
      view.setUint32(entryOffset + 12, dataOffset, true);         // data offset
      new Uint8Array(buf, dataOffset, e.buffer.byteLength).set(new Uint8Array(e.buffer));
      dataOffset += e.buffer.byteLength;
      entryOffset += 16;
    });

    return new Blob([buf], { type: "image/x-icon" });
  }

  function formatBytes(n) {
    if (n < 1024) return n + " B";
    return (n / 1024).toFixed(1) + " KB";
  }

  function reset() {
    results.forEach(function (r) { URL.revokeObjectURL(r.url); });
    results = [];
    icoBlob = null;
    srcImage = null;
    srcFile = null;
    srcRow.classList.remove("show");
    iconGrid.classList.remove("show");
    iconGrid.innerHTML = "";
    resultsActions.classList.remove("show");
    clearStatus();
  }

  async function handleFile(file) {
    if (ACCEPTED.indexOf(file.type) === -1) {
      setStatus("error", "“" + file.name + "” isn't a supported image. Use PNG, JPG, WebP or SVG.");
      return;
    }
    reset();
    srcFile = file;
    var objectUrl = URL.createObjectURL(file);

    try {
      srcImage = await loadImage(objectUrl);
    } catch (err) {
      setStatus("error", "Couldn't load that image. Try a different file.");
      return;
    }

    srcPreview.src = objectUrl;
    srcName.textContent = file.name;
    var w = srcImage.naturalWidth || srcImage.width;
    var h = srcImage.naturalHeight || srcImage.height;
    srcMeta.textContent = w + "×" + h + "px";
    srcRow.classList.add("show");

    await generateAll();
  }

  async function generateAll() {
    setStatus("working", '<span class="spinner"></span><span>Generating every size…</span>');
    iconGrid.innerHTML = "";
    iconGrid.classList.add("show");

    try {
      var icoEntries = [];

      for (var i = 0; i < PNG_SIZES.length; i++) {
        var spec = PNG_SIZES[i];
        var canvas = renderAtSize(srcImage, spec.size);
        var blob = await canvasToBlob(canvas);
        var url = URL.createObjectURL(blob);
        var entry = { filename: spec.filename, label: spec.label, blob: blob, url: url };
        results.push(entry);
        addIconCard(entry, canvas.toDataURL("image/png"));

        if (ICO_SIZES.indexOf(spec.size) !== -1) {
          var buffer = await blob.arrayBuffer();
          icoEntries.push({ size: spec.size, buffer: buffer });
        }
      }

      // sizes 16/32/48 are already generated above for the PNG set, reuse them for the ICO
      icoBlob = buildIco(icoEntries);
      var icoUrl = URL.createObjectURL(icoBlob);
      var icoEntry = { filename: "favicon.ico", label: "favicon.ico", blob: icoBlob, url: icoUrl };
      results.push(icoEntry);
      addIconCard(icoEntry, results[0].url, true);

      resultsActions.classList.add("show");
      resultCount.textContent = results.length + " files ready";
      setStatus("success", "✓ Your favicon set is ready. Download individually or grab them all as a ZIP.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong generating the favicon set: " + (err && err.message ? err.message : "unknown error") + ".");
    }
  }

  function addIconCard(entry, previewSrc, isIco) {
    var card = document.createElement("div");
    card.className = "icon-card";

    var swatch = document.createElement("div");
    swatch.className = "swatch";
    var img = document.createElement("img");
    img.src = previewSrc;
    img.alt = entry.filename;
    swatch.appendChild(img);
    card.appendChild(swatch);

    var lbl = document.createElement("div");
    lbl.className = "lbl";
    lbl.textContent = isIco ? "favicon.ico" : entry.label;
    card.appendChild(lbl);

    var fn = document.createElement("span");
    fn.className = "fn";
    fn.textContent = isIco ? formatBytes(entry.blob.size) + " · multi-size" : entry.filename;
    card.appendChild(fn);

    var dl = document.createElement("button");
    dl.className = "dl";
    dl.type = "button";
    dl.setAttribute("aria-label", "Download " + entry.filename);
    dl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>';
    dl.addEventListener("click", function () { downloadEntry(entry); });
    card.appendChild(dl);

    iconGrid.appendChild(card);
  }

  function downloadEntry(entry) {
    var a = document.createElement("a");
    a.href = entry.url;
    a.download = entry.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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

  async function downloadAllAsZip() {
    if (!results.length || typeof JSZip === "undefined") {
      setStatus("error", "The ZIP engine failed to load. Try downloading files individually instead.");
      return;
    }
    downloadAllBtn.disabled = true;
    var originalText = downloadAllBtn.textContent;
    downloadAllBtn.textContent = "Building ZIP…";

    try {
      var zip = new JSZip();
      results.forEach(function (r) {
        zip.file(r.filename, r.blob);
      });
      var zipBlob = await zip.generateAsync({ type: "blob" });
      var url = URL.createObjectURL(zipBlob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "favicon-package.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (err) {
      console.error(err);
      setStatus("error", "Couldn't build the ZIP file. Try downloading files individually instead.");
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = originalText;
    }
  }

  downloadAllBtn.addEventListener("click", downloadAllAsZip);
})();
