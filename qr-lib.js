/* ============================================================
   QR Code encoder — vendored, self-contained, no external
   dependencies or network calls. Byte-mode only (works for any
   text or URL). Implements ISO/IEC 18004 encoding: data/EC
   codeword generation via Reed-Solomon over GF(256), matrix
   construction (finder/timing/alignment patterns, format and
   version info), all 8 mask patterns with standard penalty
   scoring to pick the best one.

   QR_TABLES (loaded from qr-tables-data.js) supplies the
   standard spec constants: per-version/EC-level block/codeword
   structure, alignment pattern positions, precomputed format and
   version info bit strings, Reed-Solomon generator polynomials,
   and GF(256) log/antilog tables.
   ============================================================ */

var QRLib = (function () {
  "use strict";

  var EC_ORDER = { L: 1, M: 0, Q: 3, H: 2 }; // matches QR_TABLES.FORMAT_INFO block order (M,L,H,Q)

  function utf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.codePointAt(i);
      if (code > 0xFFFF) i++; // consumed a surrogate pair
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
      } else if (code < 0x10000) {
        bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
      } else {
        bytes.push(
          0xF0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3F),
          0x80 | ((code >> 6) & 0x3F),
          0x80 | (code & 0x3F)
        );
      }
    }
    return bytes;
  }

  function countIndicatorBits(version) {
    if (version <= 9) return 8;
    return 16; // versions 10-40 both use 16 bits for byte mode
  }

  function totalDataCodewords(version, level) {
    var groups = QR_TABLES.ECC[version][level];
    var total = 0;
    for (var i = 0; i < groups.length; i++) total += groups[i][0] * groups[i][2];
    return total;
  }

  function pickVersion(byteLen, level) {
    for (var v = 1; v <= 40; v++) {
      var headerBits = 4 + countIndicatorBits(v);
      var capacityBits = totalDataCodewords(v, level) * 8;
      if (headerBits + byteLen * 8 <= capacityBits) return v;
    }
    return null; // text too long for any QR version at this EC level
  }

  /* ---- bit buffer ---- */
  function BitBuffer() {
    this.bits = [];
  }
  BitBuffer.prototype.push = function (value, len) {
    for (var i = len - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  };
  BitBuffer.prototype.get = function (i) {
    return i < this.bits.length ? this.bits[i] : 0;
  };

  function buildDataCodewords(bytes, version, level) {
    var bb = new BitBuffer();
    bb.push(0x4, 4); // byte mode indicator
    bb.push(bytes.length, countIndicatorBits(version));
    for (var i = 0; i < bytes.length; i++) bb.push(bytes[i], 8);

    var capacityBits = totalDataCodewords(version, level) * 8;
    // terminator (up to 4 zero bits)
    var termLen = Math.min(4, capacityBits - bb.bits.length);
    if (termLen > 0) bb.push(0, termLen);
    // pad to the next byte boundary (ISO/IEC 18004 7.4.10)
    var padBits = 8 - (bb.bits.length % 8);
    if (padBits > 0) bb.push(0, padBits);
    // pad with alternating 0xEC/0x11 codewords until capacity is reached
    var padToggle = true;
    while (bb.bits.length < capacityBits) {
      bb.push(padToggle ? 0xEC : 0x11, 8);
      padToggle = !padToggle;
    }
    // convert to codeword byte array
    var codewords = [];
    for (var b = 0; b < bb.bits.length; b += 8) {
      var byte = 0;
      for (var k = 0; k < 8; k++) byte = (byte << 1) | bb.get(b + k);
      codewords.push(byte);
    }
    return codewords;
  }

  /* ---- GF(256) Reed-Solomon ----
     GEN_POLY stores the generator polynomial coefficients pre-converted to
     log-space, so multiplying by a field element only needs one more log
     lookup (of that element) before adding and reducing through GALIOS_EXP
     (a doubled 512-entry table, so no modulo-255 is needed). This mirrors
     the "extended synthetic division" approach used by reference encoders. */
  function rsEncode(dataCodewords, ecLen) {
    var gen = QR_TABLES.GEN_POLY[String(ecLen)];
    var log = QR_TABLES.GALIOS_LOG, exp = QR_TABLES.GALIOS_EXP;
    var lenData = dataCodewords.length;
    var block = dataCodewords.concat(new Array(ecLen).fill(0));
    for (var k = 0; k < lenData; k++) {
      var coef = block[k];
      if (coef !== 0) {
        var lcoef = log[coef];
        for (var n = 0; n < ecLen; n++) {
          block[k + n + 1] ^= exp[lcoef + gen[n]];
        }
      }
    }
    return block.slice(lenData);
  }

  function buildBlocks(dataCodewords, version, level) {
    var groups = QR_TABLES.ECC[version][level];
    var totalCw = groups[0][1], dataCw = groups[0][2];
    var ecLen = totalCw - dataCw;
    var blocks = [];
    var pos = 0;
    for (var g = 0; g < groups.length; g++) {
      var numBlocks = groups[g][0], blockDataLen = groups[g][2];
      for (var b = 0; b < numBlocks; b++) {
        var data = dataCodewords.slice(pos, pos + blockDataLen);
        pos += blockDataLen;
        var ec = rsEncode(data, ecLen);
        blocks.push({ data: data, ec: ec });
      }
    }
    return blocks;
  }

  function interleave(blocks) {
    var out = [];
    var maxData = 0, maxEc = 0;
    blocks.forEach(function (b) {
      maxData = Math.max(maxData, b.data.length);
      maxEc = Math.max(maxEc, b.ec.length);
    });
    for (var i = 0; i < maxData; i++) {
      blocks.forEach(function (b) { if (i < b.data.length) out.push(b.data[i]); });
    }
    for (var j = 0; j < maxEc; j++) {
      blocks.forEach(function (b) { if (j < b.ec.length) out.push(b.ec[j]); });
    }
    return out;
  }

  /* ---- matrix construction ---- */
  function makeMatrix(size) {
    var m = [];
    var reserved = [];
    for (var r = 0; r < size; r++) {
      m.push(new Array(size).fill(false));
      reserved.push(new Array(size).fill(false));
    }
    return { size: size, dark: m, reserved: reserved };
  }

  function setModule(mat, r, c, dark, isFunction) {
    if (r < 0 || r >= mat.size || c < 0 || c >= mat.size) return;
    mat.dark[r][c] = dark;
    if (isFunction) mat.reserved[r][c] = true;
  }

  function placeFinder(mat, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || rr >= mat.size || cc < 0 || cc >= mat.size) continue;
        var dark;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          var onRing = (r === 0 || r === 6 || c === 0 || c === 6);
          var inCore = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          dark = onRing || inCore;
        } else {
          dark = false; // separator
        }
        setModule(mat, rr, cc, dark, true);
      }
    }
  }

  function placeTiming(mat) {
    for (var i = 8; i < mat.size - 8; i++) {
      var dark = i % 2 === 0;
      if (!mat.reserved[6][i]) setModule(mat, 6, i, dark, true);
      if (!mat.reserved[i][6]) setModule(mat, i, 6, dark, true);
    }
  }

  function placeAlignment(mat, version) {
    if (version === 1) return;
    var positions = QR_TABLES.ALIGNMENT_POS[version - 2];
    var first = positions[0], last = positions[positions.length - 1];
    for (var i = 0; i < positions.length; i++) {
      for (var j = 0; j < positions.length; j++) {
        var row = positions[i], col = positions[j];
        var isFinderCorner =
          (row === first && col === first) ||
          (row === first && col === last) ||
          (row === last && col === first);
        if (isFinderCorner) continue;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            setModule(mat, row + dr, col + dc, dark, true);
          }
        }
      }
    }
  }

  function reserveFormatAreas(mat) {
    var s = mat.size;
    for (var i = 0; i <= 8; i++) {
      mat.reserved[8][i] = true;
      mat.reserved[i][8] = true;
    }
    for (var i2 = 0; i2 < 8; i2++) {
      mat.reserved[8][s - 1 - i2] = true;
      mat.reserved[s - 1 - i2][8] = true;
    }
  }

  function placeFormatInfo(mat, level, mask) {
    var idx = EC_ORDER[level] * 8 + mask;
    var bits = QR_TABLES.FORMAT_INFO[idx];
    var s = mat.size;
    var voffset = 0, hoffset = 0;
    for (var i = 0; i <= 7; i++) {
      var vbit = (bits >> i) & 1;
      var hbit = (bits >> (14 - i)) & 1;
      if (i === 6) { voffset = 1; hoffset = 1; } // skip the timing pattern module
      setModule(mat, i + voffset, 8, vbit === 1, true);
      setModule(mat, 8, i + hoffset, hbit === 1, true);
      setModule(mat, 8, s - 1 - i, vbit === 1, true);
      setModule(mat, s - 1 - i, 8, hbit === 1, true);
    }
    setModule(mat, s - 8, 8, true, true); // dark module (always dark)
  }

  function reserveVersionAreas(mat, version) {
    if (version < 7) return;
    var s = mat.size;
    for (var i = 0; i < 18; i++) {
      var row = Math.floor(i / 3);
      var col = i % 3;
      mat.reserved[row][s - 11 + col] = true;
      mat.reserved[s - 11 + col][row] = true;
    }
  }

  function placeVersionInfo(mat, version) {
    if (version < 7) return;
    var bits = QR_TABLES.VERSION_INFO[version - 7];
    var s = mat.size;
    for (var i = 0; i < 18; i++) {
      var bit = ((bits >> i) & 1) === 1;
      var row = Math.floor(i / 3);
      var col = i % 3;
      setModule(mat, row, s - 11 + col, bit, true);
      setModule(mat, s - 11 + col, row, bit, true);
    }
  }

  function maskFn(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
    return false;
  }

  function placeData(mat, bits) {
    var s = mat.size;
    var bitIndex = 0;
    var up = true;
    for (var col = s - 1; col > 0; col -= 2) {
      if (col === 6) col--; // skip timing column
      for (var i = 0; i < s; i++) {
        var row = up ? s - 1 - i : i;
        for (var c = 0; c < 2; c++) {
          var cc = col - c;
          if (mat.reserved[row][cc]) continue;
          var bit = bitIndex < bits.length ? bits[bitIndex] : 0;
          bitIndex++;
          mat.dark[row][cc] = bit === 1;
        }
      }
      up = !up;
    }
  }

  function applyMask(mat, mask, dataMaskable) {
    // dataMaskable[r][c] true = this module carries data (not a function pattern)
    var s = mat.size;
    for (var r = 0; r < s; r++) {
      for (var c = 0; c < s; c++) {
        if (dataMaskable[r][c] && maskFn(mask, r, c)) {
          mat.dark[r][c] = !mat.dark[r][c];
        }
      }
    }
  }

  function penalty(mat) {
    var s = mat.size, dark = mat.dark, total = 0;
    // Rule 1: runs of 5+ same color, per row and column
    function runPenalty(getVal) {
      var p = 0, runLen = 1, prev = null;
      for (var i = 0; i < s; i++) {
        var v = getVal(i);
        if (v === prev) {
          runLen++;
        } else {
          if (runLen >= 5) p += 3 + (runLen - 5);
          runLen = 1;
          prev = v;
        }
      }
      if (runLen >= 5) p += 3 + (runLen - 5);
      return p;
    }
    for (var r = 0; r < s; r++) total += runPenalty((function (row) { return function (i) { return dark[row][i]; }; })(r));
    for (var c = 0; c < s; c++) total += runPenalty((function (col) { return function (i) { return dark[i][col]; }; })(c));

    // Rule 2: 2x2 blocks of same color
    for (var r2 = 0; r2 < s - 1; r2++) {
      for (var c2 = 0; c2 < s - 1; c2++) {
        var v0 = dark[r2][c2];
        if (v0 === dark[r2][c2 + 1] && v0 === dark[r2 + 1][c2] && v0 === dark[r2 + 1][c2 + 1]) {
          total += 3;
        }
      }
    }

    // Rule 3: 1:1:3:1:1 dark:light:dark:dark:dark:light:dark core pattern,
    // scored only when it sits at the symbol edge or has >=4 light modules
    // immediately before or after it (ISO/IEC 18004 7.8.3.1, Table 11).
    var n3Pattern = [1, 0, 1, 1, 1, 0, 1];
    function findPattern(seq, start) {
      for (var i = start; i <= s - 7; i++) {
        var match = true;
        for (var k = 0; k < 7; k++) { if (seq[i + k] !== n3Pattern[k]) { match = false; break; } }
        if (match) return i;
      }
      return -1;
    }
    function anyDark(seq, from, to) {
      for (var i = Math.max(from, 0); i < Math.min(to, s); i++) if (seq[i]) return true;
      return false;
    }
    function n3Occurrences(seq) {
      var count = 0;
      var idx = findPattern(seq, 0);
      while (idx !== -1) {
        var offset = idx + 7;
        if (idx === 0 || idx === s - 7 || !anyDark(seq, idx - 4, idx) || !anyDark(seq, offset, offset + 4)) {
          count += 40;
        } else {
          offset = idx + 4;
        }
        idx = findPattern(seq, offset);
      }
      return count;
    }
    for (var r3 = 0; r3 < s; r3++) {
      var rowSeq = [];
      for (var c3 = 0; c3 < s; c3++) rowSeq.push(dark[r3][c3] ? 1 : 0);
      total += n3Occurrences(rowSeq);
    }
    for (var c4 = 0; c4 < s; c4++) {
      var colSeq = [];
      for (var r4 = 0; r4 < s; r4++) colSeq.push(dark[r4][c4] ? 1 : 0);
      total += n3Occurrences(colSeq);
    }

    // Rule 4: dark module proportion deviation from 50%
    var darkCount = 0;
    for (var r5 = 0; r5 < s; r5++) for (var c5 = 0; c5 < s; c5++) if (dark[r5][c5]) darkCount++;
    var pct = (darkCount * 100) / (s * s);
    var deviation = Math.abs(pct - 50);
    total += Math.floor(deviation / 5) * 10;

    return total;
  }

  function generate(text, level) {
    level = level || "M";
    var bytes = utf8Bytes(text);
    var version = pickVersion(bytes.length, level);
    if (!version) return null;

    var dataCodewords = buildDataCodewords(bytes, version, level);
    var blocks = buildBlocks(dataCodewords, version, level);
    var finalCodewords = interleave(blocks);
    var bits = [];
    finalCodewords.forEach(function (byte) {
      for (var i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
    });

    var size = 17 + 4 * version;
    var mat = makeMatrix(size);
    placeFinder(mat, 0, 0);
    placeFinder(mat, 0, size - 7);
    placeFinder(mat, size - 7, 0);
    placeTiming(mat);
    placeAlignment(mat, version);
    reserveFormatAreas(mat);
    reserveVersionAreas(mat, version);

    // snapshot which modules are data-maskable (not function patterns) BEFORE placing data,
    // using the reserved grid at this point (format/version areas already reserved above).
    // The actual version-info bits are written only after the best mask is chosen below,
    // matching the spec: mask penalty scoring treats that area as a zero placeholder.
    var dataMaskable = [];
    for (var r = 0; r < size; r++) {
      dataMaskable.push(new Array(size));
      for (var c = 0; c < size; c++) dataMaskable[r][c] = !mat.reserved[r][c];
    }

    placeData(mat, bits);

    var bestMask = 0, bestPenalty = Infinity, bestDark = null;
    for (var m = 0; m < 8; m++) {
      // clone dark grid, apply mask, score, restore
      var clone = mat.dark.map(function (row) { return row.slice(); });
      var trial = { size: size, dark: clone, reserved: mat.reserved };
      applyMask(trial, m, dataMaskable);
      var p = penalty(trial);
      if (p < bestPenalty) {
        bestPenalty = p;
        bestMask = m;
        bestDark = clone;
      }
    }
    mat.dark = bestDark;
    placeFormatInfo(mat, level, bestMask);
    placeVersionInfo(mat, version);

    return { size: size, version: version, mask: bestMask, modules: mat.dark };
  }

  return { generate: generate, pickVersion: pickVersion };
})();

if (typeof module !== "undefined" && module.exports) module.exports = QRLib;
