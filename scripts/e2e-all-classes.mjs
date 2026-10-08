export default async function run(page, ui) {
  const result = { classes: {}, failures: [] }

  // Locators anchored to the boundary card ROOT (never matches the activity
  // log, which also contains phrases like "RUNTIME ERROR DETECTED").
  const card = page.locator('.error-recovery-ui')
  const badge = card.locator('p.font-mono')

  const CLASSES = [
    { scenario: 'Render Crash', badge: 'RENDER CRASH', diagnose: true },
    { scenario: 'Event Handler Throw', badge: 'EVENT HANDLER', diagnose: false },
    { scenario: 'Async Timeout', badge: 'ASYNC TIMEOUT', diagnose: false },
    { scenario: 'Unhandled Promise', badge: 'UNHANDLED REJECTION', diagnose: false },
    { scenario: 'Network Failure', badge: 'NETWORK', diagnose: false },
    { scenario: 'State Inconsistency', badge: 'STATE INVARIANT', diagnose: false }
  ]

  // seed user data and wait for a valid checkpoint (2s interval)
  await page.getByLabel(/Full name/).fill('Recovery Test User')
  await page.getByLabel(/Email address/).fill('persist@example.com')
  await page.getByLabel(/Order notes/).fill('must survive every recovery')
  await page.waitForTimeout(2600)

  for (const [i, cls] of CLASSES.entries()) {
    const entry = {}

    await page.getByRole('button', { name: cls.scenario }).click()

    // card must actually open
    await card.waitFor({ state: 'visible', timeout: 10000 })
    entry.cardShown = true

    // badge must name this class (wait: card opens ~100ms after report)
    await badge.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    const badgeText = await badge.first().textContent().catch(() => '')
    entry.badge = badgeText.includes(cls.badge)
    entry.badgeText = badgeText.slice(0, 70)

    if (cls.diagnose) {
      await card.getByText('AI Diagnosis Complete').waitFor({ timeout: 15000 }).catch(() => {})
      entry.diagnosis = await card.getByText('AI Diagnosis Complete').isVisible().catch(() => false)
      if (i === 0) await page.screenshot({ path: 'C:/Users/lokes/AppData/Local/Temp/opencode/e2e-card.png' })
    }

    await card.getByRole('button', { name: /Restore from Checkpoint/ }).click()
    await card.waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(400)

    entry.cardGone = (await card.count()) === 0
    entry.nameIntact = (await page.getByLabel(/Full name/).inputValue().catch(() => 'MISSING')) === 'Recovery Test User'
    entry.notesIntact = (await page.getByLabel(/Order notes/).inputValue().catch(() => 'MISSING')) === 'must survive every recovery'
    if (cls.badge === 'STATE INVARIANT') {
      entry.emailRestored = (await page.getByLabel(/Email address/).inputValue().catch(() => 'MISSING')) === 'persist@example.com'
    }

    const ok = entry.cardShown && entry.badge && entry.cardGone && entry.nameIntact && entry.notesIntact
    result.classes[cls.badge] = { ok, ...entry }
    if (!ok) result.failures.push(cls.badge)
    if (!entry.cardGone) break
  }

  // certificate panel: 6 issued, all verified
  await page.waitForTimeout(400)
  result.issued6 = await page.getByText(/6 issued/).count().then((c) => c > 0).catch(() => false)

  await page.getByRole('button', { name: /Verify all certificates/ }).click()
  await page.waitForTimeout(500)
  result.allVerified = await page.getByText(/All 6 certificates independently verified/).count().then((c) => c > 0).catch(() => false)

  result.verifiedChips = await page.locator('.certificate-verified').count()
  result.invariantChips = await page.locator('.invariant-pass').count()

  await page.locator('#certificates-heading').scrollIntoViewIfNeeded().catch(() => {})
  await page.screenshot({ path: 'C:/Users/lokes/AppData/Local/Temp/opencode/e2e-certificates.png' })

  result.success = result.failures.length === 0 && result.allVerified && result.issued6
  return result
}
