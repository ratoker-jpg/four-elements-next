import { expect, test } from '@playwright/test';

test.describe('CIVIL-ANIM-03 sprite viewer publish path', () => {
  test('published viewer route loads and exposes the repository manifest sample', async ({ page }) => {
    const errors: string[] = [];
    const expectedRepositorySheets = [
      'Builder POC 2048x256',
      'Builder Cyan 8x8 256',
      'Builder Green 8x8 256',
      'Builder Yellow 8x8 256',
      'Builder Purple 8x8 256'
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

    expect(errors).toEqual([]);
  });
});
