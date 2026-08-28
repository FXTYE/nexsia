/* ============================================================
   Image Compressor — runs entirely client-side.
   Draws each image to a canvas and re-encodes it via
   canvas.toBlob at an adjustable quality. JSZip bundles multiple
   results into one download. No file is ever sent to a server.
   ============================================================ */

(function () {
  "use strict";

  var files = [];      // { id, file, objectUrl, originalSize, compressedBlob, compressedSize, mimeOut }
  var nextId = 1;

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var fileGrid = document.getElementById("fileGrid");
  var optionsRow = document.getElementById("optionsRow");
  var fileCount = document.getElementById("fileCount");
  var clearBtn = document.getElementById("clearBtn");
  var compressBtn = document.getElementById("compressBtn");
  var statusBar = document.getElementById("statusBar");
  var qualityInput = document.getElementById("quality");
  var qualityVal = document.getElementById("qualityVal");
  var outFormatSel = document.getElementById("outFormat");
  var resultsActions = document.getElementById("resultsActions");
  var resultCount = document.getElementById("resultCount");
  var downloadAllBtn = document.getElementById("downloadAllBtn");

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

  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }

  qualityInput.addEventListener("input", function () {
    qualityVal.textContent = qualityInput.value + "%";
  });

  function addFiles(fileList) {
    var rejected = [];
    Array.prototype.forEach.call(fileList, function (f) {
      if (ACCEPTED.indexOf(f.type) === -1) {
        rejected.push(f.name);
        return;
      }
      files.push({
        id: nextId++, file: f, objectUrl: URL.createObjectURL(f),
        originalSize: f.size, compressedBlob: null, compressedSize: null, mimeOut: null
      });
    });
    if (rejected.length) {
      setStatus("error", "Skipped " + rejected.length + " unsupported file" + (rejected.length > 1 ? "s" : "") +
        " (" + rejected.slice(0, 3).join(", ") + (rejected.length > 3 ? "…" : "") +
        "). Only JPG, PNG and WebP are supported.");
    } else {
      clearStatus();
    }
    resultsActions.classList.remove("show");
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

  function outExtFor(f) {
    var mime = f.mimeOut || f.file.type;
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    return "jpg";
  }

  function filenameFor(f) {
    var base = f.file.name.replace(/\.[^.]+$/, "");
    return base + "-compressed." + outExtFor(f);
  }

  function render() {
    fileGrid.innerHTML = "";
    files.forEach(function (f) {
      var thumb = document.createElement("div");
      thumb.className = "file-thumb";

      var imWrap = document.createElement("div");
      imWrap.className = "im-wrap";
      var img = document.createElement("img");
      img.src = f.objectUrl;
      img.alt = f.file.name;
      imWrap.appendChild(img);
      thumb.appendChild(imWrap);

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

      var foot = document.createElement("div");
      foot.className = "foot";
      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = f.file.name;
      foot.appendChild(nm);

      var sz = document.createElement("span");
      sz.className = "sz";
      if (f.compressedSize !== null) {
        var pct = Math.max(0, Math.round((1 - f.compressedSize / f.originalSize) * 100));
        sz.innerHTML = formatBytes(f.originalSize) + " → " + formatBytes(f.compressedSize) +
          (pct > 0 ? ' <span class="saved">(' + pct + "% smaller)</span>" : "");
      } else {
        sz.textContent = formatBytes(f.originalSize);
      }
      foot.appendChild(sz);
      thumb.appendChild(foot);

      if (f.compressedBlob) {
        var dlRow = document.createElement("div");
        dlRow.className = "dl-row";
        var dl = document.createElement("button");
        dl.className = "dl";
        dl.type = "button";
        dl.setAttribute("aria-label", "Download " + f.file.name);
        dl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>';
        dl.addEventListener("click", function () { downloadFile(f); });
        dlRow.appendChild(dl);
        thumb.appendChild(dlRow);
      }

      fileGrid.appendChild(thumb);
    });

    optionsRow.style.display = files.length ? "flex" : "none";
    fileCount.textContent = files.length
      ? files.length + " image" + (files.length > 1 ? "s" : "")
      : "";
    compressBtn.disabled = files.length === 0;
  }

  /* ---- input wiring ---- */
  dropZone.addEventListener("click", function () { fileInput.click(); });
  dropZone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files.length) addFiles(fileInput.files);
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
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  clearBtn.addEventListener("click", function () {
    files.forEach(function (f) { URL.revokeObjectURL(f.objectUrl); });
    files = [];
    clearStatus();
    resultsActions.classList.remove("show");
    render();
  });

  /* ---- the actual compression ---- */

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Could not load image")); };
      img.src = src;
    });
  }

  function compressOne(f, quality, formatChoice) {
    return loadImage(f.objectUrl).then(function (img) {
      var canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      var mimeOut = formatChoice === "keep" ? f.file.type : formatChoice;
      if (ACCEPTED.indexOf(mimeOut) === -1) mimeOut = "image/jpeg";

      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          if (!blob) { resolve(null); return; }
          f.compressedBlob = blob;
          f.compressedSize = blob.size;
          f.mimeOut = mimeOut;
          resolve(blob);
        }, mimeOut, mimeOut === "image/png" ? undefined : quality);
      });
    });
  }

  async function compressAll() {
    if (!files.length) return;

    compressBtn.disabled = true;
    setStatus("working", '<span class="spinner"></span><span id="progressText">Preparing…</span>');
    var progressText = document.getElementById("progressText");

    try {
      var quality = Number(qualityInput.value) / 100;
      var formatChoice = outFormatSel.value;

      for (var i = 0; i < files.length; i++) {
        if (progressText) progressText.textContent = "Compressing image " + (i + 1) + " of " + files.length + "…";
        await compressOne(files[i], quality, formatChoice);
        render();
      }

      resultsActions.classList.toggle("show", files.length > 1);
      resultCount.textContent = files.length + " image" + (files.length > 1 ? "s" : "") + " compressed";
      setStatus("success", "✓ Done. Download individually or grab them all as a ZIP.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong compressing your images: " + (err && err.message ? err.message : "unknown error") + ".");
    } finally {
      compressBtn.disabled = false;
    }
  }

  function downloadFile(f) {
    var url = URL.createObjectURL(f.compressedBlob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filenameFor(f);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  async function downloadAllAsZip() {
    var done = files.filter(function (f) { return f.compressedBlob; });
    if (!done.length || typeof JSZip === "undefined") {
      setStatus("error", "The ZIP engine failed to load. Try downloading images individually instead.");
      return;
    }
    downloadAllBtn.disabled = true;
    var originalText = downloadAllBtn.textContent;
    downloadAllBtn.textContent = "Building ZIP…";

    try {
      var zip = new JSZip();
      done.forEach(function (f) {
        zip.file(filenameFor(f), f.compressedBlob);
      });
      var zipBlob = await zip.generateAsync({ type: "blob" });
      var url = URL.createObjectURL(zipBlob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "nexsia-compressed-images.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (err) {
      console.error(err);
      setStatus("error", "Couldn't build the ZIP file. Try downloading images individually instead.");
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = originalText;
    }
  }

  compressBtn.addEventListener("click", compressAll);
  downloadAllBtn.addEventListener("click", downloadAllAsZip);
})();
