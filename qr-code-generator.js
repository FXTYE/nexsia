/* ============================================================
   QR Code Generator — runs entirely client-side.
   Uses the vendored QRLib encoder (qr-lib.js, no external
   dependencies or network calls) to build the QR module matrix,
   then renders it to a <canvas> and offers PNG/SVG download.
   Text is never sent anywhere.
   ============================================================ */

(function () {
  "use strict";

  var qrText = document.getElementById("qrText");
  var charCount = document.getElementById("charCount");
  var ecLevel = document.getElementById("ecLevel");
  var qrSize = document.getElementById("qrSize");
  var fgColor = document.getElementById("fgColor");
  var bgColor = document.getElementById("bgColor");
  var canvasWrap = document.getElementById("canvasWrap");
  var qrEmpty = document.getElementById("qrEmpty");
  var qrCanvas = document.getElementById("qrCanvas");
  var downloadPngBtn = document.getElementById("downloadPngBtn");
  var downloadSvgBtn = document.getElementById("downloadSvgBtn");
  var statusBar = document.getElementById("statusBar");

  if (!qrText) return; // this script only runs on the tool page

  var QUIET_ZONE = 4;
  var currentResult = null;
  var debounceTimer = null;

  function setStatus(kind, html) {
    statusBar.className = "status-bar show " + kind;
    statusBar.innerHTML = html;
  }
  function clearStatus() {
    statusBar.className = "status-bar";
    statusBar.innerHTML = "";
  }

  function showEmpty() {
    qrEmpty.hidden = false;
    qrCanvas.hidden = true;
    downloadPngBtn.disabled = true;
    downloadSvgBtn.disabled = true;
    currentResult = null;
  }

  function drawToCanvas(result, fg, bg, targetPx) {
    var n = result.size;
    var total = n + QUIET_ZONE * 2;
    var scale = Math.max(1, Math.floor(targetPx / total));
    var px = scale * total;
    qrCanvas.width = px;
    qrCanvas.height = px;
    var ctx = qrCanvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = fg;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (result.modules[r][c]) {
          ctx.fillRect((c + QUIET_ZONE) * scale, (r + QUIET_ZONE) * scale, scale, scale);
        }
      }
    }
  }

  function render() {
    var text = qrText.value;
    charCount.textContent = text.length.toLocaleString();

    if (!text) {
      clearStatus();
      showEmpty();
      return;
    }

    var result;
    try {
      result = QRLib.generate(text, ecLevel.value);
    } catch (err) {
      result = null;
    }

    if (!result) {
      setStatus("error", "That text is too long to fit in a QR code at this error-correction level. Try a lower level or shorter text.");
      showEmpty();
      return;
    }

    clearStatus();
    currentResult = result;
    drawToCanvas(result, fgColor.value, bgColor.value, Number(qrSize.value));
    qrEmpty.hidden = true;
    qrCanvas.hidden = false;
    downloadPngBtn.disabled = false;
    downloadSvgBtn.disabled = false;
  }

  function scheduleRender() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 200);
  }

  qrText.addEventListener("input", scheduleRender);
  ecLevel.addEventListener("change", render);
  qrSize.addEventListener("change", render);
  fgColor.addEventListener("input", render);
  bgColor.addEventListener("input", render);

  function downloadPng() {
    if (!currentResult) return;
    qrCanvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "qr-code.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }, "image/png");
  }

  function buildSvg(result, fg, bg) {
    var n = result.size;
    var total = n + QUIET_ZONE * 2;
    var rects = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (result.modules[r][c]) {
          rects.push('<rect x="' + (c + QUIET_ZONE) + '" y="' + (r + QUIET_ZONE) + '" width="1" height="1"/>');
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + bg + '"/>' +
      '<g fill="' + fg + '">' + rects.join("") + '</g>' +
      '</svg>';
  }

  function downloadSvg() {
    if (!currentResult) return;
    var svg = buildSvg(currentResult, fgColor.value, bgColor.value);
    var blob = new Blob([svg], { type: "image/svg+xml" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "qr-code.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  downloadPngBtn.addEventListener("click", downloadPng);
  downloadSvgBtn.addEventListener("click", downloadSvg);

  showEmpty();
})();
