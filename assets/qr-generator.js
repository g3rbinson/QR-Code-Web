// Minimal QR Code generator - Based on Project Nayuki's QR Code generator
// Simplified for web use, public domain / MIT style license

const QRGenerator = (function() {
  'use strict';

  // QR Code implementation
  function QrCode(version, errorCorrectionLevel, dataCodewords, mask) {
    this.version = version;
    this.errorCorrectionLevel = errorCorrectionLevel;
    this.modules = [];
    this.isFunction = [];
    
    const size = version * 4 + 17;
    for (let i = 0; i < size; i++) {
      this.modules[i] = [];
      this.isFunction[i] = [];
      for (let j = 0; j < size; j++) {
        this.modules[i][j] = false;
        this.isFunction[i][j] = false;
      }
    }
    
    this.drawFunctionPatterns();
    const allCodewords = this.addEccAndInterleave(dataCodewords);
    this.drawCodewords(allCodewords);
    
    if (mask === -1) {
      let minPenalty = Infinity;
      for (let i = 0; i < 8; i++) {
        this.applyMask(i);
        this.drawFormatBits(i);
        const penalty = this.getPenaltyScore();
        if (penalty < minPenalty) {
          mask = i;
          minPenalty = penalty;
        }
        this.applyMask(i);
      }
    }
    
    this.mask = mask;
    this.applyMask(mask);
    this.drawFormatBits(mask);
    this.isFunction = [];
  }
  
  QrCode.encodeText = function(text, ecl) {
    const segs = QrCode.makeSegments(text);
    return QrCode.encodeSegments(segs, ecl);
  };
  
  QrCode.makeSegments = function(text) {
    if (text === "") return [];
    else return [QrCode.makeBytes(QrCode.toUtf8ByteArray(text))];
  };
  
  QrCode.makeBytes = function(data) {
    return { mode: Mode.BYTE, numChars: data.length, bitData: data };
  };
  
  QrCode.toUtf8ByteArray = function(str) {
    const result = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 0x80) {
        result.push(code);
      } else if (code < 0x800) {
        result.push(0xC0 | (code >> 6));
        result.push(0x80 | (code & 0x3F));
      } else if (code < 0x10000) {
        result.push(0xE0 | (code >> 12));
        result.push(0x80 | ((code >> 6) & 0x3F));
        result.push(0x80 | (code & 0x3F));
      } else {
        result.push(0xF0 | (code >> 18));
        result.push(0x80 | ((code >> 12) & 0x3F));
        result.push(0x80 | ((code >> 6) & 0x3F));
        result.push(0x80 | (code & 0x3F));
      }
    }
    return result;
  };
  
  QrCode.encodeSegments = function(segs, ecl, minVersion, maxVersion, mask, boostEcl) {
    minVersion = minVersion || 1;
    maxVersion = maxVersion || 40;
    mask = mask !== undefined ? mask : -1;
    boostEcl = boostEcl !== undefined ? boostEcl : true;
    
    for (let version = minVersion; ; version++) {
      const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
      const dataUsedBits = QrCode.getTotalBits(segs, version);
      if (dataUsedBits <= dataCapacityBits) {
        if (boostEcl) {
          for (const newEcl of [Ecc.MEDIUM, Ecc.QUARTILE, Ecc.HIGH]) {
            if (dataUsedBits <= QrCode.getNumDataCodewords(version, newEcl) * 8)
              ecl = newEcl;
          }
        }
        const bb = [];
        for (const seg of segs) {
          appendBits(seg.mode.modeBits, 4, bb);
          appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
          for (const b of seg.bitData)
            bb.push(b);
        }
        const dataCapacityBits2 = QrCode.getNumDataCodewords(version, ecl) * 8;
        appendBits(0, Math.min(4, dataCapacityBits2 - bb.length), bb);
        appendBits(0, (8 - bb.length % 8) % 8, bb);
        for (let padByte = 0xEC; bb.length < dataCapacityBits2; padByte ^= 0xEC ^ 0x11)
          appendBits(padByte, 8, bb);
        
        const dataCodewords = [];
        while (dataCodewords.length * 8 < bb.length)
          dataCodewords.push(0);
        bb.forEach((b, i) => dataCodewords[i >>> 3] |= b << (7 - (i & 7)));
        
        return new QrCode(version, ecl, dataCodewords, mask);
      }
      if (version >= maxVersion)
        throw new RangeError("Data too long");
    }
  };
  
  QrCode.prototype.getModule = function(x, y) {
    return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
  };
  
  Object.defineProperty(QrCode.prototype, "size", {
    get: function() { return this.version * 4 + 17; }
  });
  
  QrCode.prototype.drawFunctionPatterns = function() {
    for (let i = 0; i < this.size; i++) {
      this.setFunctionModule(6, i, i % 2 === 0);
      this.setFunctionModule(i, 6, i % 2 === 0);
    }
    
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);
    
    const alignPatPos = this.getAlignmentPatternPositions();
    const numAlign = alignPatPos.length;
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        if (!(i === 0 && j === 0 || i === 0 && j === numAlign - 1 || i === numAlign - 1 && j === 0))
          this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
      }
    }
    
    this.drawFormatBits(0);
    this.drawVersion();
  };
  
  QrCode.prototype.drawFormatBits = function(mask) {
    const data = this.errorCorrectionLevel.formatBits << 3 | mask;
    let rem = data;
    for (let i = 0; i < 10; i++)
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = (data << 10 | rem) ^ 0x5412;
    
    for (let i = 0; i <= 5; i++)
      this.setFunctionModule(8, i, getBit(bits, i));
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++)
      this.setFunctionModule(14 - i, 8, getBit(bits, i));
    
    for (let i = 0; i < 8; i++)
      this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++)
      this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
    this.setFunctionModule(8, this.size - 8, true);
  };
  
  QrCode.prototype.drawVersion = function() {
    if (this.version < 7) return;
    
    let rem = this.version;
    for (let i = 0; i < 12; i++)
      rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = this.version << 12 | rem;
    
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = this.size - 11 + i % 3;
      const b = Math.floor(i / 3);
      this.setFunctionModule(a, b, bit);
      this.setFunctionModule(b, a, bit);
    }
  };
  
  QrCode.prototype.drawFinderPattern = function(x, y) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size)
          this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  };
  
  QrCode.prototype.drawAlignmentPattern = function(x, y) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++)
        this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  };
  
  QrCode.prototype.setFunctionModule = function(x, y, isBlack) {
    this.modules[y][x] = isBlack;
    this.isFunction[y][x] = true;
  };
  
  QrCode.prototype.addEccAndInterleave = function(data) {
    const ver = this.version;
    const ecl = this.errorCorrectionLevel;
    if (data.length !== QrCode.getNumDataCodewords(ver, ecl))
      throw new RangeError("Invalid data length");
    
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
    const rawCodewords = Math.floor(QrCode.getNumRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - rawCodewords % numBlocks;
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    
    const blocks = [];
    const rsDiv = QrCode.reedSolomonComputeDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = QrCode.reedSolomonComputeRemainder(dat, rsDiv);
      if (i < numShortBlocks)
        dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    
    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks)
          result.push(block[i]);
      });
    }
    return result;
  };
  
  QrCode.prototype.drawCodewords = function(data) {
    if (data.length !== Math.floor(QrCode.getNumRawDataModules(this.version) / 8))
      throw new RangeError("Invalid data length");
    
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  };
  
  QrCode.prototype.applyMask = function(mask) {
    if (mask < 0 || mask > 7) throw new RangeError("Mask value out of range");
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = x * y % 2 + x * y % 3 === 0; break;
          case 6: invert = (x * y % 2 + x * y % 3) % 2 === 0; break;
          case 7: invert = ((x + y) % 2 + x * y % 3) % 2 === 0; break;
          default: throw new Error("Unreachable");
        }
        if (!this.isFunction[y][x] && invert)
          this.modules[y][x] = !this.modules[y][x];
      }
    }
  };
  
  QrCode.prototype.getPenaltyScore = function() {
    let result = 0;
    
    for (let y = 0; y < this.size; y++) {
      let runColor = false;
      let runX = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < this.size; x++) {
        if (this.modules[y][x] === runColor) {
          runX++;
          if (runX === 5)
            result += QrCode.PENALTY_N1;
          else if (runX > 5)
            result++;
        } else {
          this.finderPenaltyAddHistory(runX, runHistory);
          if (!runColor)
            result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
          runColor = this.modules[y][x];
          runX = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * QrCode.PENALTY_N3;
    }
    
    for (let x = 0; x < this.size; x++) {
      let runColor = false;
      let runY = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < this.size; y++) {
        if (this.modules[y][x] === runColor) {
          runY++;
          if (runY === 5)
            result += QrCode.PENALTY_N1;
          else if (runY > 5)
            result++;
        } else {
          this.finderPenaltyAddHistory(runY, runHistory);
          if (!runColor)
            result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
          runColor = this.modules[y][x];
          runY = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * QrCode.PENALTY_N3;
    }
    
    for (let y = 0; y < this.size - 1; y++) {
      for (let x = 0; x < this.size - 1; x++) {
        const color = this.modules[y][x];
        if (color === this.modules[y][x + 1] &&
            color === this.modules[y + 1][x] &&
            color === this.modules[y + 1][x + 1])
          result += QrCode.PENALTY_N2;
      }
    }
    
    let black = 0;
    for (const row of this.modules)
      black += row.reduce((sum, color) => sum + (color ? 1 : 0), 0);
    const total = this.size * this.size;
    const k = Math.ceil(Math.abs(black * 20 - total * 10) / total) - 1;
    result += k * QrCode.PENALTY_N4;
    return result;
  };
  
  QrCode.prototype.getAlignmentPatternPositions = function() {
    if (this.version === 1)
      return [];
    else {
      const numAlign = Math.floor(this.version / 7) + 2;
      const step = (this.version === 32) ? 26 :
        Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
      const result = [6];
      for (let pos = this.size - 7; result.length < numAlign; pos -= step)
        result.splice(1, 0, pos);
      return result;
    }
  };
  
  QrCode.getNumRawDataModules = function(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7)
        result -= 36;
    }
    return result;
  };
  
  QrCode.getNumDataCodewords = function(ver, ecl) {
    return Math.floor(QrCode.getNumRawDataModules(ver) / 8) -
      ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] *
      NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
  };
  
  QrCode.reedSolomonComputeDivisor = function(degree) {
    const result = [];
    for (let i = 0; i < degree - 1; i++)
      result.push(0);
    result.push(1);
    
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = QrCode.reedSolomonMultiply(result[j], root);
        if (j + 1 < result.length)
          result[j] ^= result[j + 1];
      }
      root = QrCode.reedSolomonMultiply(root, 0x02);
    }
    return result;
  };
  
  QrCode.reedSolomonComputeRemainder = function(data, divisor) {
    const result = divisor.map(_ => 0);
    for (const b of data) {
      const factor = b ^ result.shift();
      result.push(0);
      divisor.forEach((coef, i) => result[i] ^= QrCode.reedSolomonMultiply(coef, factor));
    }
    return result;
  };
  
  QrCode.reedSolomonMultiply = function(x, y) {
    if (x >>> 8 !== 0 || y >>> 8 !== 0)
      throw new RangeError("Byte out of range");
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  };
  
  QrCode.prototype.finderPenaltyCountPatterns = function(runHistory) {
    const n = runHistory[1];
    const core = n > 0 && runHistory[2] === n && runHistory[3] === n * 3 && runHistory[4] === n && runHistory[5] === n;
    return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0)
         + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
  };
  
  QrCode.prototype.finderPenaltyTerminateAndCount = function(currentRunColor, currentRunLength, runHistory) {
    if (currentRunColor) {
      this.finderPenaltyAddHistory(currentRunLength, runHistory);
      currentRunLength = 0;
    }
    currentRunLength += this.size;
    this.finderPenaltyAddHistory(currentRunLength, runHistory);
    return this.finderPenaltyCountPatterns(runHistory);
  };
  
  QrCode.prototype.finderPenaltyAddHistory = function(currentRunLength, runHistory) {
    if (runHistory[0] === 0)
      currentRunLength += this.size;
    runHistory.pop();
    runHistory.unshift(currentRunLength);
  };
  
  QrCode.getTotalBits = function(segs, version) {
    let result = 0;
    for (const seg of segs) {
      const ccbits = seg.mode.numCharCountBits(version);
      if (seg.numChars >= (1 << ccbits))
        return Infinity;
      result += 4 + ccbits + seg.bitData.length;
    }
    return result;
  };
  
  QrCode.PENALTY_N1 = 3;
  QrCode.PENALTY_N2 = 3;
  QrCode.PENALTY_N3 = 40;
  QrCode.PENALTY_N4 = 10;
  
  const ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  ];
  
  const NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4,  4,  4,  4,  4,  6,  6,  6,  6,  7,  8,  8,  9,  9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5,  5,  8,  9,  9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8,  8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  ];
  
  function appendBits(val, len, bb) {
    if (len < 0 || len > 31 || val >>> len !== 0)
      throw new RangeError("Value out of range");
    for (let i = len - 1; i >= 0; i--)
      bb.push((val >>> i) & 1);
  }
  
  function getBit(x, i) {
    return ((x >>> i) & 1) !== 0;
  }
  
  // Error correction level
  function Ecc(ordinal, formatBits) {
    this.ordinal = ordinal;
    this.formatBits = formatBits;
  }
  
  Ecc.LOW      = new Ecc(0, 1);
  Ecc.MEDIUM   = new Ecc(1, 0);
  Ecc.QUARTILE = new Ecc(2, 3);
  Ecc.HIGH     = new Ecc(3, 2);
  
  // Mode
  function Mode(modeBits, numBitsCharCount) {
    this.modeBits = modeBits;
    this.numBitsCharCount = numBitsCharCount;
  }
  
  Mode.prototype.numCharCountBits = function(ver) {
    return this.numBitsCharCount[Math.floor((ver + 7) / 17)];
  };
  
  Mode.NUMERIC      = new Mode(0x1, [10, 12, 14]);
  Mode.ALPHANUMERIC = new Mode(0x2, [ 9, 11, 13]);
  Mode.BYTE         = new Mode(0x4, [ 8, 16, 16]);
  Mode.KANJI        = new Mode(0x8, [ 8, 10, 12]);
  Mode.ECI          = new Mode(0x7, [ 0,  0,  0]);
  
  // Public API
  return {
    toCanvas: function(canvas, text, options) {
      options = options || {};
      const ecl = Ecc.MEDIUM;
      const qr = QrCode.encodeText(text, ecl);
      
      const size = options.size || 256;
      const margin = options.margin !== undefined ? options.margin : 4;
      const scale = Math.floor((size - margin * 2) / qr.size);
      const actualSize = qr.size * scale + margin * 2;
      
      canvas.width = actualSize;
      canvas.height = actualSize;
      
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = options.light || '#ffffff';
      ctx.fillRect(0, 0, actualSize, actualSize);
      
      ctx.fillStyle = options.dark || '#000000';
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (qr.getModule(x, y)) {
            ctx.fillRect(margin + x * scale, margin + y * scale, scale, scale);
          }
        }
      }
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QRGenerator;
}
