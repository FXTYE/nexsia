/* ============================================================
   Image Converter — runs entirely client-side.
   Draws each image to a canvas and re-encodes it in the chosen
   output format via canvas.toBlob. JSZip bundles multiple
   results into one download. No file is ever sent to a server.
   ============================================================ */

(function () {
  "use strict";

  var files = [];      // { id, file, objectUrl, convertedBlob, convertedMime }
  var nextId = 1;

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var fileGrid = document.getElementById("fileGrid");
  var optionsRow = document.getElementById("optionsRow");
  var fileCount = document.getElementById("fileCount");
  var clearBtn = document.getElementById("clearBtn");
  var convertBtn = document.getElementById("convertBtn");
  var statusBar = document.getElementById("statusBar");
  var outFormatSel = document.getElementById("outFormat");
  var resultsActions = document.getElementById("resultsActions");
  var resultCount = document.getElementById("resultCount");
  var downloadAllBtn = document.getElementById("downloadAllBtn");

  if (!dropZone) return; // this script only runs on the tool page

  var ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
  var EXT_FOR_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  var LABEL_FOR_MIME = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WebP" };

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
      files.push({ id: nextId++, file: f, objectUrl: URL.createObjectURL(f), convertedBlob: null, convertedMime: null });
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

  function filenameFor(f) {
    var base = f.file.name.replace(/\.[^.]+$/, "");
    return base + "." + EXT_FOR_MIME[f.convertedMime || f.file.type];
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
      var fromLabel = LABEL_FOR_MIME[f.file.type] || f.file.type;
      if (f.convertedBlob) {
        sz.innerHTML = fromLabel + ' <span class="arrow">→</span> ' + LABEL_FOR_MIME[f.convertedMime];
      } else {
        sz.textContent = fromLabel;
      }
      foot.appendChild(sz);
      thumb.appendChild(foot);

      if (f.convertedBlob) {
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
    convertBtn.disabled = files.length === 0;
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

  /* ---- the actual conversion ---- */

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Could not load image")); };
      img.src = src;
    });
  }

  function convertOne(f, targetMime) {
    return loadImage(f.objectUrl).then(function (img) {
      var canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext("2d");
      if (targetMime === "image/jpeg") {
        // JPG has no transparency — fill white first so transparent PNG/WebP sources don't turn black.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);

      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          if (!blob) { resolve(null); return; }
          f.convertedBlob = blob;
          f.convertedMime = targetMime;
          resolve(blob);
        }, targetMime, targetMime === "image/png" ? undefined : 0.92);
      });
    });
  }

  async function convertAll() {
    if (!files.length) return;

    convertBtn.disabled = true;
    setStatus("working", '<span class="spinner"></span><span id="progressText">Preparing…</span>');
    var progressText = document.getElementById("progressText");

    try {
      var targetMime = outFormatSel.value;

      for (var i = 0; i < files.length; i++) {
        if (progressText) progressText.textContent = "Converting image " + (i + 1) + " of " + files.length + "…";
        await convertOne(files[i], targetMime);
        render();
      }

      resultsActions.classList.toggle("show", files.length > 1);
      resultCount.textContent = files.length + " image" + (files.length > 1 ? "s" : "") + " converted";
      setStatus("success", "✓ Done. Download individually or grab them all as a ZIP.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong converting your images: " + (err && err.message ? err.message : "unknown error") + ".");
    } finally {
      convertBtn.disabled = false;
    }
  }

  function downloadFile(f) {
    var url = URL.createObjectURL(f.convertedBlob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filenameFor(f);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  async function downloadAllAsZip() {
    var done = files.filter(function (f) { return f.convertedBlob; });
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
        zip.file(filenameFor(f), f.convertedBlob);
      });
      var zipBlob = await zip.generateAsync({ type: "blob" });
      var url = URL.createObjectURL(zipBlob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "nexsia-converted-images.zip";
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

  convertBtn.addEventListener("click", convertAll);
  downloadAllBtn.addEventListener("click", downloadAllAsZip);
})();
