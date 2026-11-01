// Weekly accessibility check for every live tool.
// Opens each page in Chromium, waits for it to settle, and runs axe-core
// against WCAG 2.1 A and AA rules. Exits with an error if any page has violations.

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const urls = JSON.parse(readFileSync(new URL('./a11y-urls.json', import.meta.url), 'utf8'));
const browser = await chromium.launch();
let total = 0;

for (const url of urls) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1024 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const count = results.violations.reduce((n, v) => n + v.nodes.length, 0);
    total += count;
    console.log(`\n${count === 0 ? 'PASS' : 'FAIL'}  ${url}  (${count} issue${count === 1 ? '' : 's'})`);
    for (const v of results.violations) {
      console.log(`  - ${v.help} [${v.id}, ${v.impact}] x${v.nodes.length}`);
      for (const node of v.nodes.slice(0, 5)) {
        const data = node.any?.[0]?.data;
        const colors = data && data.fgColor ? `  (text ${data.fgColor} on ${data.bgColor}, ratio ${data.contrastRatio})` : '';
        console.log(`      ${node.target.join(' ')}${colors}`);
      }
    }
  } catch (err) {
    total += 1;
    console.log(`\nERROR ${url}: ${err.message}`);
  }
  await context.close();
}

await browser.close();
console.log(`\n${total === 0 ? 'All pages passed.' : `${total} issue(s) found.`}`);
process.exit(total === 0 ? 0 : 1);
