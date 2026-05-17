import { expect, test } from '@playwright/test';

test.describe('CIVIL-ANIM-03 sprite viewer publish path', () => {
  test('published viewer route loads and exposes the repository manifest sample', async ({ page }) => {
    const errors: string[] = [];
    const expectedRepositorySheets = [
      'Builder POC 2048x256',
      'Builder Tracked Cyan 8x8 256 v01',
      'Builder Tracked Green 8x8 256 v01',
      'Builder Tracked Yellow 8x8 256 v01',
      'Builder Tracked Purple 8x8 256 v01'
    ];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/tools/sprite-viewer/');

    await expect(page.getByRole('heading', { level: 1, name: 'Four Elements Sprite Viewer' })).toBeVisible();
    await expect(page.locator('#repositorySheetHelp')).toHaveText(/\d+ repository sheet\(s\) available\./);

    const repositorySheetHelpText = await page.locator('#repositorySheetHelp').textContent();
    const repositorySheetCount = Number(repositorySheetHelpText?.match(/(\d+)/)?.[1] ?? 0);
    expect(repositorySheetCount).toBeGreaterThanOrEqual(1);

    const repositorySheetOptions = page.locator('#repositorySheetSelect option');
    const repositorySheetLabels = await repositorySheetOptions.allTextContents();
    expect(repositorySheetLabels.length).toBeGreaterThanOrEqual(expectedRepositorySheets.length);

    for (const label of expectedRepositorySheets) {
      expect(repositorySheetLabels).toContain(label);
    }

    await expect(page.getByRole('button', { name: 'Load primary' })).toBeEnabled();

    await page.locator('#repositorySheetSelect').selectOption({ label: 'Builder Tracked Green 8x8 256 v01' });
    await page.getByRole('button', { name: 'Load primary' }).click();
    await expect(page.locator('#primaryLabel')).toHaveText('Builder Tracked Green 8x8 256 v01 loaded');
    await expect(page.locator('#primarySize')).toHaveText('2048 x 2048px');

    expect(errors).toEqual([]);
  });
});
