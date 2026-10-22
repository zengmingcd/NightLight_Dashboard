import { expect, test, type Page } from '@playwright/test';

type Control = {
  calls: number;
  aborts: number;
  timerActive: boolean;
  throwNext: boolean;
  resolveHeaders: () => void;
  resolveBody: () => void;
  expire: () => void;
  resolve: (body: string, status?: number) => void;
  reject: () => void;
};
declare global { interface Window { statusTest: Control } }

async function setup(page: Page, cancellation: 'native' | 'missing' | 'ineffective' = 'native') {
  await page.addInitScript(mode => {
    if (mode === 'missing') Object.defineProperty(window, 'AbortController', { value: undefined });
    const nativeFetch = window.fetch.bind(window);
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    let deadline: (() => void) | undefined;
    const timerId = 987654;
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 10000) {
        deadline = handler as () => void;
        window.statusTest.timerActive = true;
        return timerId;
      }
      return nativeSetTimeout(handler, delay, ...args);
    }) as typeof window.setTimeout;
    window.clearTimeout = (id?: number) => {
      if (id === timerId) { deadline = undefined; window.statusTest.timerActive = false; }
      else nativeClearTimeout(id);
    };
    window.statusTest = {
      calls: 0, aborts: 0, timerActive: false, throwNext: false,
      resolveHeaders: () => {}, resolveBody: () => {},
      expire: () => {
        const callback = deadline;
        deadline = undefined;
        window.statusTest.timerActive = false;
        if (callback) callback();
      },
      resolve: () => {}, reject: () => {}
    };
    window.fetch = (input, options) => {
      if (input !== '/api/widgets/status') return nativeFetch(input, options);
      window.statusTest.calls++;
      if (window.statusTest.throwNext) {
        window.statusTest.throwNext = false;
        throw new TypeError('Synchronous network failure');
      }
      return new Promise<Response>((resolve, reject) => {
        window.statusTest.resolve = (body, status = 200) => resolve(new Response(body, { status }));
        window.statusTest.reject = () => reject(new TypeError('Network failure'));
        window.statusTest.resolveHeaders = () => {
          const response = new Response('{}');
          response.json = () => new Promise(bodyResolve => {
            window.statusTest.resolveBody = () => bodyResolve({ status: 'ok' });
          });
          resolve(response);
        };
        if (options?.signal) options.signal.addEventListener('abort', () => {
          window.statusTest.aborts++;
          if (mode === 'native') reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    };
  }, cancellation);
  await page.goto('/tests/status.html');
  await expect.poll(() => page.evaluate(() => window.statusTest.calls)).toBe(1);
}

test('loading and successful contract rendering', async ({ page }) => {
  await setup(page);
  await expect(page.getByRole('status')).toHaveText('Checking application status…');
  await page.evaluate(() => window.statusTest.resolve('{"status":"ok"}'));
  await expect(page.getByRole('status')).toHaveText('Application reachable — status: ok');
  expect(await page.evaluate(() => window.statusTest.timerActive)).toBe(false);
  expect(await page.evaluate(() => window.statusTest.calls)).toBe(1);
});

for (const failure of ['http', 'network', 'json', 'null', 'array', 'wrong status'] as const) {
  test(failure + ' failure and manual retry without overlap', async ({ page }) => {
    await setup(page);
    await page.evaluate(kind => {
      if (kind === 'network') window.statusTest.reject();
      else window.statusTest.resolve(kind === 'http' ? '{}' : kind === 'json' ? '{' :
        kind === 'null' ? 'null' : kind === 'array' ? '[]' : '{"status":"bad"}', kind === 'http' ? 503 : 200);
    }, failure);
    await expect(page.getByRole('status')).toContainText(failure === 'http' ? 'HTTP 503' :
      failure === 'network' ? 'Unable to reach' : 'invalid status response');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeEnabled();
    await page.getByRole('button', { name: 'Retry' }).evaluate(button => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await expect(page.getByRole('status')).toHaveText('Checking application status…');
    expect(await page.evaluate(() => window.statusTest.calls)).toBe(2);
    await page.evaluate(() => window.statusTest.resolve('{"status":"ok"}'));
    await expect(page.getByRole('status')).toContainText('Application reachable');
  });
}

test('timeout with native cancellation permits manual recovery', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.statusTest.expire());
  await expect(page.getByRole('status')).toContainText('timed out');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeEnabled();
  expect(await page.evaluate(() => window.statusTest.aborts)).toBe(1);
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.evaluate(() => window.statusTest.resolve('{"status":"ok"}'));
  await expect(page.getByRole('status')).toContainText('Application reachable');
});

test('unmount cancels a native request and a fresh mount succeeds', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(await page.evaluate(() => window.statusTest.timerActive)).toBe(false);
  expect(await page.evaluate(() => window.statusTest.aborts)).toBe(1);
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.statusTest.calls)).toBe(2);
  await page.evaluate(() => window.statusTest.resolve('{"status":"ok"}'));
  await expect(page.getByRole('status')).toContainText('Application reachable');
});

test('synchronous fetch rejection releases the guard for another retry', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.statusTest.reject());
  await expect(page.getByRole('button', { name: 'Retry' })).toBeEnabled();
  await page.evaluate(() => { window.statusTest.throwNext = true; });
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('status')).toContainText('Unable to reach');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeEnabled();
  await page.getByRole('button', { name: 'Retry' }).click();
  expect(await page.evaluate(() => window.statusTest.calls)).toBe(3);
  await page.evaluate(() => window.statusTest.resolve('{"status":"ok"}'));
  await expect(page.getByRole('status')).toContainText('Application reachable');
});

test('timeout also covers a pending JSON body and ignores its late success', async ({ page }) => {
  await setup(page, 'missing');
  await page.evaluate(() => window.statusTest.resolveHeaders());
  await page.evaluate(() => window.statusTest.expire());
  await expect(page.getByRole('status')).toContainText('timed out');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeDisabled();
  await page.evaluate(() => window.statusTest.resolveBody());
  await expect(page.getByRole('button', { name: 'Retry' })).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('timed out');
});

for (const cancellation of ['missing', 'ineffective'] as const) {
  test('timeout holds request guard with ' + cancellation + ' cancellation', async ({ page }) => {
    await setup(page, cancellation);
    await page.evaluate(() => window.statusTest.expire());
    await expect(page.getByRole('status')).toContainText('timed out');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeDisabled();
    await expect(page.getByText(/If it remains stuck/)).toBeVisible();
    await page.getByRole('button', { name: 'Retry' }).evaluate(button => (button as HTMLButtonElement).click());
    expect(await page.evaluate(() => window.statusTest.calls)).toBe(1);
    await page.evaluate(() => window.statusTest.resolve('{"status":"ok"}'));
    await expect(page.getByRole('button', { name: 'Retry' })).toBeEnabled();
    await expect(page.getByRole('status')).toContainText('timed out');
    await page.getByRole('button', { name: 'Retry' }).click();
    expect(await page.evaluate(() => window.statusTest.calls)).toBe(2);
  });

  test('unmount clears deadline and replacement ignores old response with ' + cancellation + ' cancellation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await setup(page, cancellation);
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(await page.evaluate(() => window.statusTest.timerActive)).toBe(false);
    expect(await page.evaluate(() => window.statusTest.aborts)).toBe(cancellation === 'missing' ? 0 : 1);
    await page.getByRole('button', { name: 'Mount', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('previous status request');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeDisabled();
    expect(await page.evaluate(() => window.statusTest.calls)).toBe(1);
    await page.evaluate(() => window.statusTest.resolve('{"status":"ok"}'));
    await expect(page.getByRole('button', { name: 'Retry' })).toBeEnabled();
    await expect(page.getByRole('status')).toContainText('previous status request');
    await page.getByRole('button', { name: 'Retry' }).click();
    await page.evaluate(() => window.statusTest.resolve('{"status":"ok"}'));
    await expect(page.getByRole('status')).toContainText('Application reachable');
    expect(errors).toEqual([]);
  });
}
