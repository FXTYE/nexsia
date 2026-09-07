/* ============================================================
   Background Remover — runs entirely client-side.
   Uses @imgly/background-removal, which runs an ONNX segmentation
   model in-browser via WASM/WebGPU. The library itself is loaded
   lazily (dynamic import) only when the user clicks "Remove
   background", so the rest of the page stays fully interactive
   even if the CDN it ships from is ever unreachable. The model
   and WASM assets are fetched on demand from IMG.LY's asset CDN
   and cached by the browser; the image itself never leaves the
   device.
   ============================================================ */

(function () {
  "use strict";

  var BG_REMOVAL_URL = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/index.mjs";
  var removeBackgroundFn = null;

  function loadEngine() {
    if (removeBackgroundFn) return Promise.resolve(removeBackgroundFn);
    return import(/* webpackIgnore: true */ BG_REMOVAL_URL).then(function (mod) {
      removeBackgroundFn = mod.removeBackground;
      return removeBackgroundFn;
    });
  }

  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var fileInfoRow = document.getElementById("fileInfoRow");
  var fileName = document.getElementById("fileName");
  var clearBtn = document.getElementById("clearBtn");
  var removeBtn = document.getElementById("removeBtn");
  var statusBar = document.getElementById("statusBar");
  var compareWrap = document.getElementById("compareWrap");
  var origImg = document.getElementById("origImg");
  var resultCanvas = document.getElementById("resultCanvas");
  var downloadBtn = document.getElementById("downloadBtn");
  var modeRestoreBtn = document.getElementById("modeRestoreBtn");
  var modeEraseBtn = document.getElementById("modeEraseBtn");
  var brushSizeInput = document.getElementById("brushSizeInput");
  var undoBtn = document.getElementById("undoBtn");
  var resetEditsBtn = document.getElementById("resetEditsBtn");

  if (!dropZone) return; // this script only runs on the tool page

  var ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
  var currentFile = null;
  var currentObjectUrl = null;
  var resultUrl = null;
  var resultFilename = null;

  /* ---- brush-editing state ---- */
  var resultCtx = resultCanvas.getContext("2d");
  var originalCanvas = document.createElement("canvas"); // offscreen: full-res source for "Restore"
  var originalCtx = originalCanvas.getContext("2d");
  var aiResultSnapshot = null; // ImageData of the fresh AI result, for "Reset touch-ups"
  var undoStack = [];
  var MAX_UNDO = 6;
  var brushMode = "restore";
  var brushSize = Number(brushSizeInput.value) || 40;
  var isDrawing = false;
  var lastPoint = null;
  resultCanvas.width = 0;
  resultCanvas.height = 0;

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Could not load image")); };
      img.src = src;
    });
  }

  function getCanvasPos(e) {
    var rect = resultCanvas.getBoundingClientRect();
    var scaleX = resultCanvas.width / rect.width;
    var scaleY = resultCanvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function paintAt(x, y) {
    var r = brushSize / 2;
    resultCtx.save();
    if (brushMode === "erase") {
      resultCtx.globalCompositeOperation = "destination-out";
      resultCtx.beginPath();
      resultCtx.arc(x, y, r, 0, Math.PI * 2);
      resultCtx.fill();
    } else {
      resultCtx.beginPath();
      resultCtx.arc(x, y, r, 0, Math.PI * 2);
      resultCtx.clip();
      resultCtx.drawImage(originalCanvas, 0, 0);
    }
    resultCtx.restore();
  }

  function strokeTo(x, y) {
    if (!lastPoint) { paintAt(x, y); lastPoint = { x: x, y: y }; return; }
    var dx = x - lastPoint.x, dy = y - lastPoint.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var step = Math.max(1, brushSize / 4);
    var steps = Math.max(1, Math.round(dist / step));
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      paintAt(lastPoint.x + dx * t, lastPoint.y + dy * t);
    }
    lastPoint = { x: x, y: y };
  }

  function pushUndo() {
    if (!resultCanvas.width) return;
    undoStack.push(resultCtx.getImageData(0, 0, resultCanvas.width, resultCanvas.height));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    undoBtn.disabled = false;
  }

  function undo() {
    if (!undoStack.length) return;
    var data = undoStack.pop();
    resultCtx.putImageData(data, 0, 0);
    undoBtn.disabled = undoStack.length === 0;
  }

  function resetEdits() {
    if (!aiResultSnapshot) return;
    resultCtx.putImageData(aiResultSnapshot, 0, 0);
    undoStack = [];
    undoBtn.disabled = true;
  }

  function setMode(mode) {
    brushMode = mode;
    modeRestoreBtn.classList.toggle("active", mode === "restore");
    modeRestoreBtn.setAttribute("aria-pressed", mode === "restore" ? "true" : "false");
    modeEraseBtn.classList.toggle("active", mode === "erase");
    modeEraseBtn.setAttribute("aria-pressed", mode === "erase" ? "true" : "false");
  }

  modeRestoreBtn.addEventListener("click", function () { setMode("restore"); });
  modeEraseBtn.addEventListener("click", function () { setMode("erase"); });
  brushSizeInput.addEventListener("input", function () { brushSize = Number(brushSizeInput.value); });
  undoBtn.addEventListener("click", undo);
  resetEditsBtn.addEventListener("click", resetEdits);

  resultCanvas.addEventListener("pointerdown", function (e) {
    if (!resultCanvas.width) return;
    isDrawing = true;
    lastPoint = null;
    try { resultCanvas.setPointerCapture(e.pointerId); } catch (err) {}
    pushUndo();
    var p = getCanvasPos(e);
    paintAt(p.x, p.y);
    lastPoint = p;
    e.preventDefault();
  });
  resultCanvas.addEventListener("pointermove", function (e) {
    if (!isDrawing) return;
    var p = getCanvasPos(e);
    strokeTo(p.x, p.y);
    e.preventDefault();
  });
  function stopDrawing() { isDrawing = false; lastPoint = null; }
  resultCanvas.addEventListener("pointerup", stopDrawing);
  resultCanvas.addEventListener("pointercancel", stopDrawing);
  window.addEventListener("pointerup", stopDrawing);

  function setStatus(kind, html) {
    statusBar.className = "status-bar show " + kind;
    statusBar.innerHTML = html;
  }
  function clearStatus() {
    statusBar.className = "status-bar";
    statusBar.innerHTML = "";
  }

  function reset() {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    currentFile = null;
    currentObjectUrl = null;
    resultUrl = null;
    resultFilename = null;
    fileInfoRow.classList.remove("show");
    compareWrap.classList.remove("show");
    clearStatus();

    resultCanvas.width = 0;
    resultCanvas.height = 0;
    aiResultSnapshot = null;
    undoStack = [];
    undoBtn.disabled = true;
    setMode("restore");
  }

  function handleFile(file) {
    if (ACCEPTED.indexOf(file.type) === -1) {
      setStatus("error", "“" + file.name + "” isn't a supported image. Use JPG, PNG or WebP.");
      return;
    }
    reset();
    currentFile = file;
    currentObjectUrl = URL.createObjectURL(file);
    origImg.src = currentObjectUrl;
    fileName.textContent = file.name;
    fileInfoRow.classList.add("show");
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

  /* ---- the actual removal ---- */

  async function run() {
    if (!currentFile) return;

    removeBtn.disabled = true;
    setStatus("working", '<span class="spinner"></span><span>Loading the AI model and processing your photo — the first run can take a little while…</span>');

    try {
      var removeBackground = await loadEngine();
      var resultBlob = await removeBackground(currentFile, {
        model: "isnet_quint8", // smaller, faster download than the default; quality is still solid
        output: { format: "image/png" }
      });

      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(resultBlob);
      resultFilename = currentFile.name.replace(/\.[^.]+$/, "") + "-no-bg.png";

      var resultImgEl = await loadImage(resultUrl);
      resultCanvas.width = resultImgEl.naturalWidth;
      resultCanvas.height = resultImgEl.naturalHeight;
      resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
      resultCtx.drawImage(resultImgEl, 0, 0);
      aiResultSnapshot = resultCtx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
      undoStack = [];
      undoBtn.disabled = true;
      setMode("restore");

      var origImgEl = await loadImage(currentObjectUrl);
      originalCanvas.width = origImgEl.naturalWidth;
      originalCanvas.height = origImgEl.naturalHeight;
      originalCtx.drawImage(origImgEl, 0, 0);

      compareWrap.classList.add("show");
      setStatus("success", "✓ Background removed. Drag on the result to touch up edges, then download.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong removing the background: " + (err && err.message ? err.message : "unknown error") + ". This can happen on a slow or interrupted connection during the model download — try again.");
    } finally {
      removeBtn.disabled = false;
    }
  }

  function downloadResult() {
    if (!resultCanvas.width) return;
    resultCanvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = resultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }, "image/png");
  }

  removeBtn.addEventListener("click", run);
  downloadBtn.addEventListener("click", downloadResult);
})();
