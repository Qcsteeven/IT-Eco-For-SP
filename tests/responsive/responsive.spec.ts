import { expect, test } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { collectLayoutReport } from './layout';
import { installMockApi } from './mock-api';
import { runOcrCheck } from './ocr';
import { responsiveRoutes, responsiveViewports } from './routes';

const artifactRoot = 'responsive-artifacts';

const writeArtifact = async (
  section: string,
  routeName: string,
  viewportName: string,
  extension: string,
  content: Buffer | string,
) => {
  const directory = join(artifactRoot, section, routeName);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${viewportName}.${extension}`), content);
};

test.beforeAll(async () => {
  await rm(artifactRoot, { force: true, recursive: true });
});

for (const route of responsiveRoutes) {
  for (const viewport of responsiveViewports) {
    test(`${route.name} keeps responsive layout at ${viewport.name}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(180_000);

      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      await installMockApi(page, route.role);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.waitForTimeout(600);

      const layoutReport = await collectLayoutReport(page, route.keyText);
      await writeArtifact(
        'reports',
        route.name,
        viewport.name,
        'layout.json',
        JSON.stringify(layoutReport, null, 2),
      );
      await testInfo.attach('layout-report.json', {
        body: JSON.stringify(layoutReport, null, 2),
        contentType: 'application/json',
      });

      const screenshot = await page.screenshot({
        fullPage: false,
        animations: 'disabled',
      });
      await writeArtifact(
        'screenshots',
        route.name,
        viewport.name,
        'png',
        screenshot,
      );
      await testInfo.attach('viewport.png', {
        body: screenshot,
        contentType: 'image/png',
      });

      const html = await page.content();
      await writeArtifact('html', route.name, viewport.name, 'html', html);
      await testInfo.attach('page.html', {
        body: html,
        contentType: 'text/html',
      });

      const ocrReport = await runOcrCheck(screenshot, viewport);
      await writeArtifact(
        'reports',
        route.name,
        viewport.name,
        'ocr.json',
        JSON.stringify(ocrReport, null, 2),
      );
      await testInfo.attach('ocr-report.json', {
        body: JSON.stringify(ocrReport, null, 2),
        contentType: 'application/json',
      });

      expect(pageErrors).toEqual([]);
      expect(layoutReport.errors).toEqual([]);
      expect(ocrReport.errors).toEqual([]);
    });
  }
}
