/* ============================================================
   Merge PDF — runs entirely client-side.
   Uses pdf-lib (loaded via CDN in merge-pdf.html) to load and
   combine real PDF documents in-browser. No file is ever sent
   to a server.
   ============================================================ */

(function () {
  "use strict";

  var files = [];      // { id, file, pageCount }
  var nextId = 1;

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var fileGrid = document.getElementById("fileGrid");
  var optionsRow = document.getElementById("optionsRow");
  var fileCount = document.getElementById("fileCount");
  var clearBtn = document.getElementById("clearBtn");
  var convertBtn = document.getElementById("convertBtn");
  var statusBar = document.getElementById("statusBar");

  if (!dropZone) return; // this script only runs on the tool page

  var ACCEPTED = "application/pdf";

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

  async function addFiles(fileList) {
    var rejected = [];
    var toAdd = [];
    Array.prototype.forEach.call(fileList, function (f) {
      var isPdf = f.type === ACCEPTED || /\.pdf$/i.test(f.name);
      if (!isPdf) {
        rejected.push(f.name);
        return;
      }
      toAdd.push(f);
    });

    if (rejected.length) {
      setStatus("error", "Skipped " + rejected.length + " unsupported file" + (rejected.length > 1 ? "s" : "") +
        " (" + rejected.slice(0, 3).join(", ") + (rejected.length > 3 ? "…" : "") +
        "). Only PDF files are supported.");
    } else {
      clearStatus();
    }

    // read page counts up front so the list shows real info immediately
    for (var i = 0; i < toAdd.length; i++) {
      var f = toAdd[i];
      var entry = { id: nextId++, file: f, pageCount: null, error: null };
      files.push(entry);
      render(); // show it right away with a loading state
      try {
        var bytes = await readFileAsArrayBuffer(f);
        var doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        if (doc.isEncrypted) {
          entry.error = "Password-protected — can't be merged";
        } else {
          entry.pageCount = doc.getPageCount();
        }
      } catch (err) {
        entry.error = "Couldn't read this file";
      }
      render();
    }
  }

  function removeFile(id) {
    var idx = files.findIndex(function (f) { return f.id === id; });
    if (idx > -1) {
      files.splice(idx, 1);
      render();
    }
  }

  function docIconSvg() {
    return '<svg width="20" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  }
  function dragHandleSvg() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
  }

  function render() {
    fileGrid.innerHTML = "";
    files.forEach(function (f, i) {
      var thumb = document.createElement("div");
      thumb.className = "file-thumb";
      thumb.draggable = true;
      thumb.dataset.id = f.id;

      var handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.innerHTML = dragHandleSvg();
      thumb.appendChild(handle);

      var icon = document.createElement("div");
      icon.className = "doc-ic";
      icon.innerHTML = docIconSvg();
      thumb.appendChild(icon);

      var info = document.createElement("div");
      info.className = "doc-info";
      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = f.file.name;
      info.appendChild(nm);
      var meta = document.createElement("div");
      meta.className = "meta";
      if (f.error) {
        meta.textContent = f.error;
        meta.style.color = "var(--bad)";
      } else if (f.pageCount === null) {
        meta.textContent = "Reading…";
      } else {
        meta.textContent = f.pageCount + " page" + (f.pageCount === 1 ? "" : "s");
      }
      info.appendChild(meta);
      thumb.appendChild(info);

      var pg = document.createElement("span");
      pg.className = "pg";
      pg.textContent = "#" + (i + 1);
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

      addDragHandlers(thumb);
      fileGrid.appendChild(thumb);
    });

    optionsRow.style.display = files.length ? "flex" : "none";
    fileCount.textContent = files.length
      ? files.length + " file" + (files.length > 1 ? "s" : "") + " · drag to reorder"
      : "";
    var hasErrors = files.some(function (f) { return f.error; });
    convertBtn.disabled = files.length < 2 || hasErrors;
    if (files.length === 1 && !hasErrors) {
      convertBtn.title = "Add at least one more PDF to merge";
    } else {
      convertBtn.title = "";
    }
  }

  /* ---- drag-to-reorder within the list ---- */
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
    files = [];
    clearStatus();
    render();
  });

  /* ---- the actual merge ---- */

  async function mergePdfs() {
    if (files.length < 2) return;
    if (typeof PDFLib === "undefined") {
      setStatus("error", "The PDF engine failed to load. Check your connection and try again.");
      return;
    }
    if (files.some(function (f) { return f.error; })) {
      setStatus("error", "Remove the files with errors before merging.");
      return;
    }

    convertBtn.disabled = true;
    setStatus("working", '<span class="spinner"></span><span id="progressText">Preparing…</span>');
    var progressText = document.getElementById("progressText");

    try {
      var merged = await PDFLib.PDFDocument.create();

      for (var i = 0; i < files.length; i++) {
        if (progressText) progressText.textContent = "Adding " + files[i].file.name + " (" + (i + 1) + " of " + files.length + ")…";

        var bytes = await readFileAsArrayBuffer(files[i].file);
        var srcDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        var indices = srcDoc.getPageIndices();
        var copiedPages = await merged.copyPages(srcDoc, indices);
        copiedPages.forEach(function (page) { merged.addPage(page); });
      }

      if (progressText) progressText.textContent = "Finishing up…";
      var mergedBytes = await merged.save();
      downloadPdf(mergedBytes);
      setStatus("success", "✓ Your merged PDF is ready and downloading now (" + merged.getPageCount() + " pages total).");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong merging your PDFs: " + (err && err.message ? err.message : "unknown error") + ". Try removing the affected file and merging again.");
    } finally {
      convertBtn.disabled = files.length < 2;
    }
  }

  function downloadPdf(bytes) {
    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var stamp = new Date().toISOString().slice(0, 10);
    a.download = "nexsia-merged-" + stamp + ".pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  convertBtn.addEventListener("click", mergePdfs);
})();
