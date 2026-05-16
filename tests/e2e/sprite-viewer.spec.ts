import { expect, test } from '@playwright/test';

test.describe('CIVIL-ANIM-03 sprite viewer publish path', () => {
  test('published viewer route loads with an empty manifest fallback', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/tools/sprite-viewer/');

    await expect(page.getByRole('heading', { level: 1, name: 'Four Elements Sprite Viewer' })).toBeVisible();
    await expect(page.locator('#repositorySheetHelp')).toHaveText('No repository sheets available.');

    expect(errors).toEqual([]);
  });
});
