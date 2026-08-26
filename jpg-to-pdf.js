/* ============================================================
   JPG to PDF converter — runs entirely client-side.
   Uses pdf-lib (loaded via CDN in jpg-to-pdf.html) to build a
   real PDF in-browser. No file is ever sent to a server.
   ============================================================ */

(function () {
  "use strict";

  var files = [];      // { id, file, objectUrl }
  var nextId = 1;

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var fileGrid = document.getElementById("fileGrid");
  var optionsRow = document.getElementById("optionsRow");
  var fileCount = document.getElementById("fileCount");
  var clearBtn = document.getElementById("clearBtn");
  var convertBtn = document.getElementById("convertBtn");
  var statusBar = document.getElementById("statusBar");
  var pageSizeSel = document.getElementById("pageSize");
  var orientationSel = document.getElementById("orientation");
  var marginSel = document.getElementById("margin");

  if (!dropZone) return; // this script only runs on the tool page

  var ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

  function setStatus(kind, html) {
    statusBar.className = "status-bar show " + kind;
    statusBar.innerHTML = html;
  }
  function clearStatus() {
    statusBar.className = "status-bar";
    statusBar.innerHTML = "";
  }

  function addFiles(fileList) {
    var rejected = [];
    Array.prototype.forEach.call(fileList, function (f) {
      if (ACCEPTED.indexOf(f.type) === -1) {
        rejected.push(f.name);
        return;
      }
      files.push({ id: nextId++, file: f, objectUrl: URL.createObjectURL(f) });
    });
    if (rejected.length) {
      setStatus("error", "Skipped " + rejected.length + " unsupported file" + (rejected.length > 1 ? "s" : "") +
        " (" + rejected.slice(0, 3).join(", ") + (rejected.length > 3 ? "…" : "") +
        "). Only JPG, PNG and WebP are supported — convert HEIC to JPG first.");
    } else {
      clearStatus();
    }
    render();
  }

  function removeFile(id) {
    var idx = files.findIndex(function (f) { return f.id === id; });
    if (idx > -1) {
      URL.revokeObjectURL(files[idx].objectUrl);
      files.splice(idx, 1);
      render();
    }
  }

  function render() {
    fileGrid.innerHTML = "";
    files.forEach(function (f, i) {
      var thumb = document.createElement("div");
      thumb.className = "file-thumb";
      thumb.draggable = true;
      thumb.dataset.id = f.id;

      var img = document.createElement("img");
      img.src = f.objectUrl;
      img.alt = f.file.name;
      thumb.appendChild(img);

      var pg = document.createElement("span");
      pg.className = "pg";
      pg.textContent = "Page " + (i + 1);
      thumb.appendChild(pg);

      var rm = document.createElement("button");
      rm.className = "rm";
      rm.type = "button";
      rm.setAttribute("aria-label", "Remove " + f.file.name);
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function (e) {
        e.stopPropagation();
        removeFile(f.id);
      });
      thumb.appendChild(rm);

      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = f.file.name;
      thumb.appendChild(nm);

      addDragHandlers(thumb);
      fileGrid.appendChild(thumb);
    });

    optionsRow.style.display = files.length ? "flex" : "none";
    fileCount.textContent = files.length
      ? files.length + " image" + (files.length > 1 ? "s" : "") + " · drag to reorder"
      : "";
    convertBtn.disabled = files.length === 0;
  }

  /* ---- drag-to-reorder within the grid ---- */
  var dragSrcId = null;
  function addDragHandlers(el) {
    el.addEventListener("dragstart", function (e) {
      dragSrcId = Number(el.dataset.id);
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragend", function () {
      el.classList.remove("dragging");
    });
    el.addEventListener("dragover", function (e) {
      e.preventDefault();
    });
    el.addEventListener("drop", function (e) {
      e.preventDefault();
      var targetId = Number(el.dataset.id);
      if (dragSrcId === null || dragSrcId === targetId) return;
      var srcIdx = files.findIndex(function (f) { return f.id === dragSrcId; });
      var tgtIdx = files.findIndex(function (f) { return f.id === targetId; });
      if (srcIdx === -1 || tgtIdx === -1) return;
      var moved = files.splice(srcIdx, 1)[0];
      files.splice(tgtIdx, 0, moved);
      render();
    });
  }

  /* ---- input wiring ---- */
  dropZone.addEventListener("click", function () { fileInput.click(); });
  dropZone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files.length) addFiles(fileInput.files);
    fileInput.value = ""; // allow re-selecting the same file later
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
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  clearBtn.addEventListener("click", function () {
    files.forEach(function (f) { URL.revokeObjectURL(f.objectUrl); });
    files = [];
    clearStatus();
    render();
  });

  /* ---- the actual conversion ---- */

  var PAGE_SIZES = {
    a4: [595.28, 841.89],     // points
    letter: [612, 792]
  };

  function readFileAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("Could not read " + file.name)); };
      reader.readAsArrayBuffer(file);
    });
  }

  async function embedImage(pdfDoc, file) {
    var bytes = await readFileAsArrayBuffer(file);
    if (file.type === "image/png") return pdfDoc.embedPng(bytes);
    // pdf-lib embeds JPEG directly; WebP is not natively supported by pdf-lib,
    // so we draw it to a canvas and re-encode as JPEG first.
    if (file.type === "image/webp") {
      var jpegBytes = await webpToJpegBytes(file);
      return pdfDoc.embedJpg(jpegBytes);
    }
    return pdfDoc.embedJpg(bytes);
  }

  function webpToJpegBytes(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (!blob) { reject(new Error("Could not convert " + file.name)); return; }
          blob.arrayBuffer().then(resolve, reject);
        }, "image/jpeg", 0.95);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not load " + file.name));
      };
      img.src = url;
    });
  }

  async function convert() {
    if (!files.length) return;
    if (typeof PDFLib === "undefined") {
      setStatus("error", "The PDF engine failed to load. Check your connection and try again.");
      return;
    }

    convertBtn.disabled = true;
    setStatus("working", '<span class="spinner"></span><span id="progressText">Preparing…</span>');
    var progressText = document.getElementById("progressText");

    try {
      var pdfDoc = await PDFLib.PDFDocument.create();
      var sizeChoice = pageSizeSel.value;
      var orientChoice = orientationSel.value;
      var margin = Number(marginSel.value);

      for (var i = 0; i < files.length; i++) {
        if (progressText) progressText.textContent = "Converting image " + (i + 1) + " of " + files.length + "…";

        var embedded = await embedImage(pdfDoc, files[i].file);
        var imgW = embedded.width, imgH = embedded.height;

        var pageW, pageH;
        if (sizeChoice === "auto") {
          pageW = imgW + margin * 2;
          pageH = imgH + margin * 2;
        } else {
          var base = PAGE_SIZES[sizeChoice];
          var wantLandscape = orientChoice === "landscape" ||
            (orientChoice === "auto" && imgW > imgH);
          pageW = wantLandscape ? base[1] : base[0];
          pageH = wantLandscape ? base[0] : base[1];
        }

        var page = pdfDoc.addPage([pageW, pageH]);

        // scale image to fit inside the page minus margins, preserving aspect ratio
        var availW = pageW - margin * 2;
        var availH = pageH - margin * 2;
        var scale = Math.min(availW / imgW, availH / imgH, 1 * (sizeChoice === "auto" ? Infinity : 1));
        if (sizeChoice === "auto") scale = 1; // already sized exactly to the image
        var drawW = imgW * scale;
        var drawH = imgH * scale;
        var x = (pageW - drawW) / 2;
        var y = (pageH - drawH) / 2;

        page.drawImage(embedded, { x: x, y: y, width: drawW, height: drawH });
      }

      if (progressText) progressText.textContent = "Finishing up…";
      var pdfBytes = await pdfDoc.save();
      downloadPdf(pdfBytes);
      setStatus("success", "✓ Your PDF is ready and downloading now.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong converting your images: " + (err && err.message ? err.message : "unknown error") + ". Try removing the affected image and converting again.");
    } finally {
      convertBtn.disabled = false;
    }
  }

  function downloadPdf(bytes) {
    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var stamp = new Date().toISOString().slice(0, 10);
    a.download = "nexsia-converted-" + stamp + ".pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  convertBtn.addEventListener("click", convert);
})();
