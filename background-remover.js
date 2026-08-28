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
      removeBackgroundFn = mod.default;
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
  var resultImg = document.getElementById("resultImg");
  var downloadBtn = document.getElementById("downloadBtn");

  if (!dropZone) return; // this script only runs on the tool page

  var ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
  var currentFile = null;
  var currentObjectUrl = null;
  var resultUrl = null;
  var resultFilename = null;

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
      resultImg.src = resultUrl;
      resultFilename = currentFile.name.replace(/\.[^.]+$/, "") + "-no-bg.png";

      compareWrap.classList.add("show");
      setStatus("success", "✓ Background removed. Download the transparent PNG below.");
    } catch (err) {
      console.error(err);
      setStatus("error", "Something went wrong removing the background: " + (err && err.message ? err.message : "unknown error") + ". This can happen on a slow or interrupted connection during the model download — try again.");
    } finally {
      removeBtn.disabled = false;
    }
  }

  function downloadResult() {
    if (!resultUrl) return;
    var a = document.createElement("a");
    a.href = resultUrl;
    a.download = resultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  removeBtn.addEventListener("click", run);
  downloadBtn.addEventListener("click", downloadResult);
})();
