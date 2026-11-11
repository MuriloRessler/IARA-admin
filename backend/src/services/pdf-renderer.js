import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, Path2D } from '@napi-rs/canvas';

globalThis.Path2D ||= Path2D;

const toTextItem = (item, viewport) => ({
  text: item.str || '',
  x: item.transform?.[4] || 0,
  y: viewport.height - (item.transform?.[5] || 0),
  width: item.width || 0,
  height: Math.abs(item.height || item.transform?.[3] || 0),
});

export const loadPdfDocument = async (buffer) => getDocument({
  data: new Uint8Array(buffer),
  disableWorker: true,
  useSystemFonts: true,
  isEvalSupported: false,
}).promise;

export const inspectPdf = async (buffer, { maxPages = 30, renderScale = 1.5 } = {}) => {
  const document = await loadPdfDocument(buffer);
  const pageCount = document.numPages;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, maxPages); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise;
      pages.push({
        pageNumber,
        width: baseViewport.width,
        height: baseViewport.height,
        renderWidth: canvas.width,
        renderHeight: canvas.height,
        textItems: textContent.items.map((item) => toTextItem(item, baseViewport)).filter((item) => item.text.trim()),
        imageBuffer: canvas.toBuffer('image/png'),
      });
      page.cleanup();
    }
  } finally {
    if (typeof document.cleanup === 'function') document.cleanup();
  }
  return { pageCount, pages };
};
