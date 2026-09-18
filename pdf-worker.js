/* ══════════════════════════════════════════════════════════
   PixelPress v40 — Modern PDF Worker
   ══════════════════════════════════════════════════════════ */
'use strict';

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
  a3: [841.89, 1190.55],
  a5: [419.53, 595.28]
};
const MARGIN_PT = { none: 0, small: 18, medium: 36, large: 54 };

const QUALITY_PRESETS = {
  low:    { maxDim: 1400, jpegQ: 0.68 },
  medium: { maxDim: 2400, jpegQ: 0.84 },
  high:   { maxDim: 3500, jpegQ: 0.92 },
  ultra:  { maxDim: 4500, jpegQ: 0.96 }
};

const COMPRESSION_PRESETS = {
  low:    { scaleFactor: 0.55, minQ: 0.55, maxQ: 0.70 },
  medium: { scaleFactor: 0.78, minQ: 0.72, maxQ: 0.85 },
  high:   { scaleFactor: 1.00, minQ: 0.85, maxQ: 0.98 }
};

function fmtNum(n) { return String(Math.round(n * 1000) / 1000); }
function escapePdfString(s) { return String(s).replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1'); }
function pdfDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return 'D:' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
         p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + 'Z';
}

async function readExifOrientation(blob) {
  try {
    const buf = await blob.slice(0, 128 * 1024).arrayBuffer();
    const view = new DataView(buf);
    if (view.getUint16(0, false) !== 0xFFD8) return 1;
    let offset = 2;
    const length = view.byteLength;
    while (offset < length) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xFFE1) {
        const exifLen = view.getUint16(offset, false);
        offset += 2;
        if (view.getUint32(offset, false) !== 0x45786966) return 1;
        offset += 6;
        const little = view.getUint16(offset, false) === 0x4949;
        offset += 8;
        const tagCount = view.getUint16(offset, little);
        offset += 2;
        for (let i = 0; i < tagCount; i++) {
          const tag = view.getUint16(offset, little);
          if (tag === 0x0112) return view.getUint16(offset + 8, little);
          offset += 12;
        }
        return 1;
      }
      if ((marker & 0xFF00) !== 0xFF00) break;
      offset += view.getUint16(offset, false);
    }
    return 1;
  } catch (e) { return 1; }
}

function autoPageOrientation(w, h) { return w > h ? 'landscape' : 'portrait'; }

function enhancePixels(data, level) {
  const PRESETS = {
    soft:     { b: 4, c: 6, s: 5 },
    standard: { b: 8, c: 14, s: 10 },
    strong:   { b: 12, c: 22, s: 16 }
  };
  const P = PRESETS[level];
  if (!P) return;
  const bright = P.b * 2.55;
  const cF = (259 * (P.c + 255)) / (255 * (259 - P.c));
  const sF = 1 + P.s / 100;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    r = cF * (r - 128) + 128 + bright;
    g = cF * (g - 128) + 128 + bright;
    b = cF * (b - 128) + 128 + bright;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * sF;
    g = gray + (g - gray) * sF;
    b = gray + (b - gray) * sF;
    data[i]     = r < 0 ? 0 : r > 255 ? 255 : r;
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}

function applyExifTransform(ctx, cw, ch, orientation) {
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, cw, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, cw, ch); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, ch); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, ch, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, ch, cw); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, cw); break;
    default: break;
  }
}
function exifNeedsSwap(orientation) { return orientation >= 5 && orientation <= 8; }

async function prepareImage(entry, settings) {
  const rot = entry.rotation || 0;
  let bitmap = entry.bitmap;
  let exifOrientation = 1;

  if (!bitmap && entry.file) {
    exifOrientation = await readExifOrientation(entry.file);
    const qPreset = QUALITY_PRESETS[settings.quality] || QUALITY_PRESETS.high;
    const cPreset = COMPRESSION_PRESETS[settings.compression] || COMPRESSION_PRESETS.high;
    const maxDim = Math.min(qPreset.maxDim, Math.round(qPreset.maxDim * cPreset.scaleFactor));

    try {
      const probe = await createImageBitmap(entry.file, { imageOrientation: 'from-image' });
      const srcW = probe.width, srcH = probe.height;
      const longEdge = Math.max(srcW, srcH);

      if (longEdge > maxDim) {
        const scale = maxDim / longEdge;
        const rw = Math.max(1, Math.round(srcW * scale));
        const rh = Math.max(1, Math.round(srcH * scale));
        probe.close && probe.close();
        try {
          bitmap = await createImageBitmap(entry.file, {
            imageOrientation: 'from-image',
            resizeWidth: rw,
            resizeHeight: rh,
            resizeQuality: 'high'
          });
        } catch (e) {
          bitmap = await createImageBitmap(entry.file, { imageOrientation: 'from-image' });
        }
      } else {
        bitmap = probe;
      }
    } catch (e) {
      bitmap = await createImageBitmap(entry.file, { imageOrientation: 'from-image' });
    }
  }

  const srcW = bitmap.width, srcH = bitmap.height;
  const qPreset = QUALITY_PRESETS[settings.quality] || QUALITY_PRESETS.high;
  const cPreset = COMPRESSION_PRESETS[settings.compression] || COMPRESSION_PRESETS.high;

  const exifSwap = exifNeedsSwap(exifOrientation);
  const baseW = exifSwap ? srcH : srcW;
  const baseH = exifSwap ? srcW : srcH;
  const userSwap = rot % 180 !== 0;
  const cw = userSwap ? baseH : baseW;
  const ch = userSwap ? baseW : baseH;

  const canvas = new OffscreenCanvas(cw, ch);
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(rot * Math.PI / 180);

  if (exifOrientation !== 1) {
    const tempW = userSwap ? srcH : srcW;
    const tempH = userSwap ? srcW : srcH;
    applyExifTransform(ctx, tempW, tempH, exifOrientation);
    if (exifSwap) {
      ctx.drawImage(bitmap, -srcH / 2, -srcW / 2, srcW, srcH);
    } else {
      ctx.drawImage(bitmap, -srcW / 2, -srcH / 2, srcW, srcH);
    }
  } else {
    ctx.drawImage(bitmap, -srcW / 2, -srcH / 2, srcW, srcH);
  }

  if (settings.enhance && settings.enhance !== 'none') {
    try {
      const img = ctx.getImageData(0, 0, cw, ch);
      enhancePixels(img.data, settings.enhance);
      ctx.putImageData(img, 0, 0);
    } catch (e) {}
  }

  const jpegQ = Math.max(cPreset.minQ, Math.min(cPreset.maxQ, qPreset.jpegQ));
  const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: jpegQ });
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

  if (bitmap && bitmap.close) bitmap.close();
  canvas.width = canvas.height = 0;

  return { jpegBytes, imgW: cw, imgH: ch, autoOrientation: autoPageOrientation(cw, ch) };
}

function buildPdfBlob(prepared, settings) {
  const parts = [];
  let offset = 0;
  const offsets = {};
  const txt = (s) => { const b = new TextEncoder().encode(s); parts.push(b); offset += b.length; };
  const bin = (b) => { parts.push(b); offset += b.length; };

  txt('%PDF-1.4\n');
  bin(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));

  const N = prepared.length;
  const pageNums = [], contNums = [], imgNums = [];
  let n = 3;
  for (let i = 0; i < N; i++) { pageNums.push(n++); contNums.push(n++); imgNums.push(n++); }
  const infoObj = n++;
  const totalObjs = n;
  const margin = MARGIN_PT[settings.margin] != null ? MARGIN_PT[settings.margin] : 0;

  const pages = prepared.map((p) => {
    let pw, ph;
    if (settings.pageSize === 'original') {
      pw = p.imgW; ph = p.imgH;
    } else {
      const size = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.a4;
      let orientation = settings.orientation;
      if (settings.orientation === 'auto') orientation = p.autoOrientation;
      if (orientation === 'landscape') { pw = size[1]; ph = size[0]; }
      else { pw = size[0]; ph = size[1]; }
    }
    let dw, dh, dx, dy, clip = false;
    if (settings.pageSize === 'original') { dw = p.imgW; dh = p.imgH; dx = 0; dy = 0; }
    else if (settings.fitMode === 'stretch') { dw = Math.max(1, pw - margin * 2); dh = Math.max(1, ph - margin * 2); dx = margin; dy = margin; }
    else if (settings.fitMode === 'fill') {
      const s = Math.max((pw - margin * 2) / p.imgW, (ph - margin * 2) / p.imgH);
      dw = p.imgW * s; dh = p.imgH * s;
      dx = (pw - dw) / 2; dy = (ph - dh) / 2;
      clip = true;
    } else {
      const availW = Math.max(1, pw - margin * 2);
      const availH = Math.max(1, ph - margin * 2);
      const s = Math.min(availW / p.imgW, availH / p.imgH);
      dw = p.imgW * s; dh = p.imgH * s;
      dx = (pw - dw) / 2; dy = (ph - dh) / 2;
    }
    return { pw, ph, dw, dh, dx, dy, clip };
  });

  offsets[1] = offset;
  txt('1 0 obj\n<< /Type /Catalog /Pages 2 0 R /PageLayout /SinglePage >>\nendobj\n');
  offsets[2] = offset;
  const kids = pageNums.map((p) => p + ' 0 R').join(' ');
  txt('2 0 obj\n<< /Type /Pages /Kids [' + kids + '] /Count ' + N + ' >>\nendobj\n');

  const wmText = (settings.watermark && settings.watermarkText) ? escapePdfString(settings.watermarkText) : '';
  const wmGray = String(Math.max(0, Math.min(1, 1 - settings.watermarkOpacity)).toFixed(3));

  for (let i = 0; i < N; i++) {
    const g = pages[i], p = prepared[i];
    const pn = pageNums[i], cn = contNums[i], im = imgNums[i];

    offsets[pn] = offset;
    txt(pn + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
        fmtNum(g.pw) + ' ' + fmtNum(g.ph) +
        '] /Resources << /XObject << /Im0 ' + im +
        ' 0 R >> /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> >>' +
        ' /ProcSet [/PDF /Text /ImageC] >> /Contents ' + cn + ' 0 R >>\nendobj\n');

    let content = '';
    if (g.clip) {
      content += 'q\n' + fmtNum(g.pw) + ' 0 0 ' + fmtNum(g.ph) + ' 0 0 cm\n';
      content += '0 0 ' + fmtNum(g.pw) + ' ' + fmtNum(g.ph) + ' re W n\n';
      content += fmtNum(g.dw) + ' 0 0 ' + fmtNum(g.dh) + ' ' + fmtNum(g.dx) + ' ' + fmtNum(g.dy) + ' cm\n/Im0 Do\nQ\n';
    } else {
      content += 'q\n' + fmtNum(g.dw) + ' 0 0 ' + fmtNum(g.dh) + ' ' + fmtNum(g.dx) + ' ' + fmtNum(g.dy) + ' cm\n/Im0 Do\nQ\n';
    }
    if (wmText) {
      const size = Math.max(24, Math.min(g.pw, g.ph) * 0.11);
      const cx = g.pw / 2, cy = g.ph / 2;
      const tw = wmText.length * size * 0.5;
      content += 'q\n0.7071 0.7071 -0.7071 0.7071 ' + fmtNum(cx) + ' ' + fmtNum(cy) +
        ' cm\nBT\n/F1 ' + fmtNum(size) + ' Tf\n' + wmGray + ' ' + wmGray + ' ' + wmGray +
        ' rg\n' + fmtNum(-tw / 2) + ' ' + fmtNum(-size / 3) + ' Td\n(' + wmText + ') Tj\nET\nQ\n';
    }
    if (settings.pageNumber) {
      let label = settings.pageNumberFormat === 'n-of-total' ? (i + 1) + ' / ' + N : String(i + 1);
      label = escapePdfString(label);
      const fsize = 10, tw = label.length * fsize * 0.52;
      const pos = settings.pageNumberPos || 'bottom-center', pad = 20;
      let px, py;
      if (pos.indexOf('top') === 0) py = g.ph - pad - fsize; else py = pad;
      if (pos.indexOf('center') !== -1) px = (g.pw - tw) / 2;
      else if (pos.indexOf('right') !== -1) px = g.pw - tw - pad;
      else px = pad;
      content += 'BT\n/F1 ' + fsize + ' Tf\n0.35 0.35 0.35 rg\n' + fmtNum(px) + ' ' + fmtNum(py) + ' Td\n(' + label + ') Tj\nET\n';
    }

    offsets[cn] = offset;
    txt(cn + ' 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\nendobj\n');
    offsets[im] = offset;
    txt(im + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + p.imgW +
        ' /Height ' + p.imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
        p.jpegBytes.length + ' >>\nstream\n');
    bin(p.jpegBytes);
    txt('\nendstream\nendobj\n');
  }

  const now = new Date();
  const metaTitle = (settings.metaEnabled && settings.metaTitle) ? settings.metaTitle : (settings.filename || 'Document');
  const metaAuthor = (settings.metaEnabled && settings.metaAuthor) ? settings.metaAuthor : 'PixelPress';
  offsets[infoObj] = offset;
  const infoExtra = settings.pdfA ? '/GTS_PDFA1Version (PDF/A-1b) ' : '';
  txt(infoObj + ' 0 obj\n<< /Title (' + escapePdfString(metaTitle) + ') /Author (' +
      escapePdfString(metaAuthor) + ') /Producer (PixelPress Image to PDF Converter) /Creator (PixelPress) ' +
      infoExtra + '/CreationDate (' + pdfDate(now) + ') /ModDate (' + pdfDate(now) + ') >>\nendobj\n');

  const xrefStart = offset;
  let xref = 'xref\n0 ' + totalObjs + '\n0000000000 65535 f \n';
  for (let i = 1; i < totalObjs; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  xref += 'trailer\n<< /Size ' + totalObjs + ' /Root 1 0 R /Info ' + infoObj + ' 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF\n';
  txt(xref);

  prepared.forEach(function (p) { if (p && p.jpegBytes) p.jpegBytes = null; });

  return new Blob(parts, { type: 'application/pdf' });
}

self.addEventListener('message', async function (ev) {
  const data = ev.data || {};
  const reqId = data.reqId;
  const items = data.items || [];
  const settings = data.settings || {};
  const N = items.length;

  try {
    self.postMessage({
      reqId: reqId, type: 'progress', stage: 1, pct: 5,
      title: 'Reading images…', desc: 'Decoding ' + N + ' file' + (N > 1 ? 's' : '')
    });

    const prepared = [];
    for (let i = 0; i < N; i++) {
      const p = await prepareImage(items[i], settings);
      prepared.push(p);
      const pct = 15 + ((i + 1) / N) * 55;
      self.postMessage({
        reqId: reqId, type: 'progress', stage: 3, pct: pct,
        title: 'Composing pages…', desc: 'Page ' + (i + 1) + ' of ' + N
      });
    }

    self.postMessage({
      reqId: reqId, type: 'progress', stage: 4, pct: 80,
      title: 'Finalising document…', desc: 'Writing PDF structure'
    });

    const blob = buildPdfBlob(prepared, settings);
    const buffer = await blob.arrayBuffer();

    self.postMessage({
      reqId: reqId, type: 'progress', stage: 4, pct: 95,
      title: 'Finalising document…', desc: 'Almost done'
    });

    self.postMessage(
      { reqId: reqId, type: 'done', buffer: buffer, pages: N, bytes: buffer.byteLength },
      [buffer]
    );
  } catch (err) {
    self.postMessage({ reqId: reqId, type: 'error', error: (err && err.message) || 'Unknown worker error' });
  }
});