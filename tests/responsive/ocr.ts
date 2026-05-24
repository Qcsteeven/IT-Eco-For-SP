import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

type OcrBox = {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
};

const require = createRequire(__filename);
const tessdataPath = join(process.cwd(), 'test-results', 'tessdata');

export type OcrReport = {
  textLength: number;
  language: string;
  warnings: string[];
  errors: string[];
  boxes: OcrBox[];
};

type TesseractApi = {
  recognize: (
    image: Buffer,
    language: string,
    options?: Record<string, unknown>,
  ) => Promise<{
    data?: { text?: string; lines?: unknown[]; words?: unknown[] };
  }>;
};

async function loadTesseract(): Promise<TesseractApi> {
  const tesseractModule = (await import('tesseract.js')) as unknown as {
    recognize?: TesseractApi['recognize'];
    default?: TesseractApi;
  };

  if (tesseractModule.recognize) {
    return { recognize: tesseractModule.recognize };
  }

  if (tesseractModule.default?.recognize) {
    return tesseractModule.default;
  }

  throw new Error('tesseract.js recognize API is unavailable');
}

function ensureTessdata() {
  mkdirSync(tessdataPath, { recursive: true });

  const sources = [
    require.resolve('@tesseract.js-data/eng/4.0.0/eng.traineddata.gz'),
    require.resolve('@tesseract.js-data/rus/4.0.0/rus.traineddata.gz'),
  ];

  for (const source of sources) {
    const target = join(
      tessdataPath,
      source.endsWith('rus.traineddata.gz')
        ? 'rus.traineddata.gz'
        : 'eng.traineddata.gz',
    );
    if (!existsSync(target)) {
      copyFileSync(source, target);
    }
  }

  return tessdataPath;
}

function normalizeBox(raw: unknown): OcrBox | null {
  if (!raw || typeof raw !== 'object') return null;

  const item = raw as {
    text?: unknown;
    confidence?: unknown;
    bbox?: {
      x0?: unknown;
      y0?: unknown;
      x1?: unknown;
      y1?: unknown;
    };
  };

  const text = typeof item.text === 'string' ? item.text.trim() : '';
  const confidence =
    typeof item.confidence === 'number'
      ? item.confidence
      : Number(item.confidence);
  const bbox = item.bbox;

  if (
    !text ||
    !bbox ||
    !Number.isFinite(confidence) ||
    !Number.isFinite(Number(bbox.x0)) ||
    !Number.isFinite(Number(bbox.y0)) ||
    !Number.isFinite(Number(bbox.x1)) ||
    !Number.isFinite(Number(bbox.y1))
  ) {
    return null;
  }

  return {
    text,
    confidence,
    bbox: {
      x0: Number(bbox.x0),
      y0: Number(bbox.y0),
      x1: Number(bbox.x1),
      y1: Number(bbox.y1),
    },
  };
}

function area(box: OcrBox['bbox']) {
  return Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0);
}

function overlapRatio(a: OcrBox['bbox'], b: OcrBox['bbox']) {
  const x0 = Math.max(a.x0, b.x0);
  const y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);
  const intersection = area({ x0, y0, x1, y1 });
  const smaller = Math.min(area(a), area(b));
  return smaller > 0 ? intersection / smaller : 0;
}

export async function runOcrCheck(
  png: Buffer,
  viewport: { width: number; height: number },
): Promise<OcrReport> {
  const warnings: string[] = [];
  let language = 'rus+eng';
  const langPath = ensureTessdata();
  let result: {
    data?: { text?: string; lines?: unknown[]; words?: unknown[] };
  };

  try {
    const tesseract = await loadTesseract();
    result = await tesseract.recognize(png, language, {
      cachePath: langPath,
      gzip: true,
      langPath,
      logger: () => undefined,
    });
  } catch (error) {
    warnings.push(
      `rus+eng OCR failed, fallback to eng: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    language = 'eng';
    const tesseract = await loadTesseract();
    result = await tesseract.recognize(png, language, {
      cachePath: langPath,
      gzip: true,
      langPath,
      logger: () => undefined,
    });
  }

  const text = result.data?.text?.trim() ?? '';
  const lineBoxes = (result.data?.lines ?? [])
    .map(normalizeBox)
    .filter((box): box is OcrBox => Boolean(box));
  const wordBoxes = (result.data?.words ?? [])
    .map(normalizeBox)
    .filter((box): box is OcrBox => Boolean(box));
  const boxes = lineBoxes.length > 0 ? lineBoxes : wordBoxes;
  const errors: string[] = [];

  if (text.replace(/\s+/g, '').length < 8) {
    errors.push('OCR did not recognize enough readable text in the viewport');
  }

  for (const box of boxes.filter((item) => item.confidence >= 45)) {
    const { x0, y0, x1, y1 } = box.bbox;
    if (
      x0 < -2 ||
      y0 < -2 ||
      x1 > viewport.width + 2 ||
      y1 > viewport.height + 2
    ) {
      errors.push(
        `OCR text box is outside viewport: "${box.text}" ${JSON.stringify(box.bbox)}`,
      );
    }
  }

  const confidentLines = lineBoxes.filter(
    (item) => item.confidence >= 80 && item.text.length > 2,
  );
  for (let i = 0; i < confidentLines.length; i += 1) {
    for (let j = i + 1; j < confidentLines.length; j += 1) {
      if (overlapRatio(confidentLines[i].bbox, confidentLines[j].bbox) > 0.78) {
        errors.push(
          `OCR text lines overlap: "${confidentLines[i].text}" / "${confidentLines[j].text}"`,
        );
      }
    }
  }

  return {
    textLength: text.length,
    language,
    warnings,
    errors,
    boxes: boxes.slice(0, 80),
  };
}
