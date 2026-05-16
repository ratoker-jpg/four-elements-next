import { expect, test } from '@playwright/test';

test.describe('CIVIL-ANIM-03 sprite viewer publish path', () => {
  test('published viewer route loads and exposes the repository manifest sample', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/tools/sprite-viewer/');

    await expect(page.getByRole('heading', { level: 1, name: 'Four Elements Sprite Viewer' })).toBeVisible();
    await expect(page.locator('#repositorySheetHelp')).toHaveText('1 repository sheet(s) available.');
    await expect(page.locator('#repositorySheetSelect')).toContainText('Builder POC 2048x256');
    await expect(page.getByRole('button', { name: 'Load primary' })).toBeEnabled();

    expect(errors).toEqual([]);
  });
});
