import type { Page } from '@playwright/test';

export type LayoutReport = {
  url: string;
  viewport: { width: number; height: number };
  documentWidth: number;
  keyTextFound: boolean;
  errors: string[];
  warnings: string[];
};

const SCROLL_WHITELIST = [
  '.calendar-page__table',
  '.users-table-wrapper',
  '.karma-logs-table',
  '.coach-table-wrap',
  '.guide-code',
  '.guide-code-block',
  '.knowledge-guide__table',
  '.profile-history-table-wrapper',
  '[data-responsive-scroll]',
].join(',');

export async function collectLayoutReport(
  page: Page,
  keyText: string,
): Promise<LayoutReport> {
  return page.evaluate(
    ({ keyTextValue, scrollWhitelist }) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const documentWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      );

      if (documentWidth > viewport.width + 1) {
        errors.push(
          `Global horizontal overflow: document ${documentWidth}px > viewport ${viewport.width}px`,
        );
      }

      const normalize = (value: string) =>
        value.toLowerCase().replace(/\s+/g, ' ').replace(/[ё]/g, 'е').trim();
      const keyTextFound = normalize(document.body.innerText || '').includes(
        normalize(keyTextValue),
      );

      if (!keyTextFound) {
        warnings.push(`Key text is not visible in DOM: ${keyTextValue}`);
      }

      const isVisible = (element: Element, rect: DOMRect) => {
        const style = window.getComputedStyle(element);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      const hasAllowedOverflowParent = (element: Element) =>
        Boolean(element.closest(scrollWhitelist));

      const elements = Array.from(document.body.querySelectorAll('*'));
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (!isVisible(element, rect)) continue;

        if (
          !hasAllowedOverflowParent(element) &&
          (rect.left < -2 || rect.right > viewport.width + 2)
        ) {
          const className =
            typeof (element as HTMLElement).className === 'string'
              ? (element as HTMLElement).className
              : '';
          errors.push(
            `Element outside viewport: <${element.tagName.toLowerCase()}>.${className} left=${Math.round(
              rect.left,
            )} right=${Math.round(rect.right)}`,
          );
        }
      }

      const controlSelector = [
        'button',
        'input',
        'select',
        'textarea',
        '[role="button"]',
        'a[class*="btn"]',
        'a[class*="button"]',
        'a[class*="action"]',
        'a[class*="toggle"]',
        'a[class*="profile"]',
        'a[class*="back"]',
      ].join(',');

      const controls = Array.from(document.querySelectorAll(controlSelector));
      for (const control of controls) {
        const rect = control.getBoundingClientRect();
        if (!isVisible(control, rect)) continue;

        const tag = control.tagName.toLowerCase();
        const className =
          typeof (control as HTMLElement).className === 'string'
            ? (control as HTMLElement).className
            : '';

        if (rect.width < 40 || rect.height < 40) {
          warnings.push(
            `Touch target below preferred size: <${tag}>.${className} ${Math.round(
              rect.width,
            )}x${Math.round(rect.height)}`,
          );
        }
      }

      return {
        url: window.location.href,
        viewport,
        documentWidth,
        keyTextFound,
        errors,
        warnings,
      };
    },
    { keyTextValue: keyText, scrollWhitelist: SCROLL_WHITELIST },
  );
}
