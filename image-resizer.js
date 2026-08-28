/* ============================================================
   Image Resizer — runs entirely client-side.
   Draws each image to a canvas at the target size and re-encodes
   it via canvas.toBlob. JSZip bundles multiple results into one
   download. No file is ever sent to a server.
   ============================================================ */

(function () {
  "use strict";

  var files = [];      // { id, file, objectUrl, naturalW, naturalH, resizedBlob, resizedW, resizedH }
  var nextId = 1;
  var mode = "pixels";  // "pixels" | "percent"
  var lockAspect = true;

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var fileGrid = document.getElementById("fileGrid");
  var optionsRow = document.getElementById("optionsRow");
  var fileCount = document.getElementById("fileCount");
  var clearBtn = document.getElementById("clearBtn");
  var resizeBtn = document.getElementById("resizeBtn");
  var statusBar = document.getElementById("statusBar");
  var widthInput = document.getElementById("widthInput");
  var heightInput = document.getElementById("heightInput");
  var lockBtn = document.getElementById("lockBtn");
  var percentInput = document.getElementById("percentInput");
  var pixelFields = document.getElementById("pixelFields");
  var percentField = document.getElementById("percentField");
  var modeTabs = document.querySelectorAll(".mode-tabs button");
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

  modeTabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      mode = btn.dataset.mode;
      modeTabs.forEach(function (b) { b.classList.toggle("active", b === btn); });
      pixelFields.style.display = mode === "pixels" ? "flex" : "none";
      percentField.style.display = mode === "percent" ? "flex" : "none";
    });
  });

  lockBtn.addEventListener("click", function () {
    lockAspect = !lockAspect;
    lockBtn.classList.toggle("on", lockAspect);
  });

  var firstAspect = null; // width/height of the first added image, used to link the two inputs
  widthInput.addEventListener("input", function () {
    if (lockAspect && firstAspect && widthInput.value) {
      heightInput.value = Math.round(Number(widthInput.value) / firstAspect);
    }
  });
  heightInput.addEventListener("input", function () {
    if (lockAspect && firstAspect && heightInput.value) {
      widthInput.value = Math.round(Number(heightInput.value) * firstAspect);
    }
  });

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Could not load image")); };
      img.src = src;
    });
  }

  function addFiles(fileList) {
    var rejected = [];
    var toAdd = [];
    Array.prototype.forEach.call(fileList, function (f) {
      if (ACCEPTED.indexOf(f.type) === -1) {
        rejected.push(f.name);
        return;
      }
      toAdd.push(f);
    });
    if (rejected.length) {
      setStatus("error", "Skipped " + rejected.length + " unsupported file" + (rejected.length > 1 ? "s" : "") +
        " (" + rejected.slice(0, 3).join(", ") + (rejected.length > 3 ? "…" : "") +
        "). Only JPG, PNG and WebP are supported.");
    } else {
      clearStatus();
    }
    resultsActions.classList.remove("show");

    Promise.all(toAdd.map(function (f) {
      var objectUrl = URL.createObjectURL(f);
      return loadImage(objectUrl).then(function (img) {
        var entry = {
          id: nextId++, file: f, objectUrl: objectUrl,
          naturalW: img.naturalWidth, naturalH: img.naturalHeight,
          resizedBlob: null, resizedW: null, resizedH: null
        };
        files.push(entry);
        if (firstAspect === null) {
          firstAspect = entry.naturalW / entry.naturalH;
          if (!widthInput.value) widthInput.value = entry.naturalW;
          if (!heightInput.value) heightInput.value = entry.naturalH;
        }
      });
    })).then(render);
  }

  function removeFile(id) {
    var idx = files.findIndex(function (f) { return f.id === id; });
    if (idx > -1) {
      URL.revokeObjectURL(files[idx].objectUrl);
      files.splice(idx, 1);
      if (!files.length) firstAspect = null;
      render();
    }
  }

  function outExtFor(f) {
    if (f.file.type === "image/png") return "png";
    if (f.file.type === "image/webp") return "webp";
    return "jpg";
  }
  function filenameFor(f) {
    var base = f.file.name.replace(/\.[^.]+$/, "");
    return base + "-resized." + outExtFor(f);
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
      if (f.resizedW) {
        sz.innerHTML = f.naturalW + "×" + f.naturalH + ' <span class="arrow">→</span> ' + f.resizedW + "×" + f.resizedH;
      } else {
        sz.textContent = f.naturalW + "×" + f.naturalH + " px";
      }
      foot.appendChild(sz);
      thumb.appendChild(foot);

      if (f.resizedBlob) {
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
    resizeBtn.disabled = files.length === 0;
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
    firstAspect = null;
    clearStatus();
    resultsActions.classList.remove("show");
    render();
  });

  /* ---- the actual resize ---- */

  function targetSizeFor(f) {
    if (mode === "percent") {
      var pct = Number(percentInput.value) / 100;
      return { w: Math.max(1, Math.round(f.naturalW * pct)), h: Math.max(1, Math.round(f.naturalH * pct)) };
    }
    var w = Number(widthInput.value) || f.naturalW;
    var h = Number(heightInput.value) || f.naturalH;
    if (lockAspect) {
      var ratio = f.naturalW / f.naturalH;
      h = Math.round(w / ratio);
    }
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  function resizeOne(f) {
    return loadImage(f.objectUrl).then(function (img) {
      var size = targetSizeFor(f);
      var canvas = document.createElement("canvas");
      canvas.width = size.w;
      canvas.height = size.h;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size.w, size.h);

      var mimeOut = f.file.type;
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          if (!blob) { resolve(null); return; }
          f.resizedBlob = blob;
          f.resizedW = size.w;
          f.resizedH = size.h;
          resolve(blob);
        }, mimeOut, mimeOut === "image/png" ? undefined : 0.92);
      });
    });
  }

  async function resizeAll() {
    if (!files.length) return;

    resizeBtn.disabled = true;
    setStatus("working", '<span class="spinner"></span><span id="progressText">Preparing…</span>');
    var progressText = document.getElementById("progressText");

    try {
      for (var i = 0; i < files.length; i++) {
        if (progressText) progressText.textContent = "Resizing image " + (i + 1) + " of " + files.length + "…";
        await resizeOne(files[i]);
        render();
      }

      resultsActions.classList.toggle("show", files.length > 1);
      resultCount.textContent = files.length + " image" + (files.length > 1 ? "s" : "") + " resized";
      setStatus("success", "✓ Done. Download individually or grab them all as a ZIP.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong resizing your images: " + (err && err.message ? err.message : "unknown error") + ".");
    } finally {
      resizeBtn.disabled = false;
    }
  }

  function downloadFile(f) {
    var url = URL.createObjectURL(f.resizedBlob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filenameFor(f);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  async function downloadAllAsZip() {
    var done = files.filter(function (f) { return f.resizedBlob; });
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
        zip.file(filenameFor(f), f.resizedBlob);
      });
      var zipBlob = await zip.generateAsync({ type: "blob" });
      var url = URL.createObjectURL(zipBlob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "nexsia-resized-images.zip";
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

  resizeBtn.addEventListener("click", resizeAll);
  downloadAllBtn.addEventListener("click", downloadAllAsZip);
})();
