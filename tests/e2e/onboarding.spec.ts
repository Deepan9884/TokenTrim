/**
 * OB1–OB4: first-run onboarding (clean storage, no popupPage preset).
 */
import { test, expect, popupUrl } from './utils/extension';

async function freshPopup(extContext, extensionId) {
  const page = await extContext.newPage();
  await page.goto(popupUrl(extensionId));
  await page.evaluate(async () => {
    await chrome.storage.local.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('tokentrim');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
  await page.goto(popupUrl(extensionId));
  return page;
}

test('OB1: fresh profile shows onboarding, not empty view', async ({ extContext, extensionId }) => {
  const page = await freshPopup(extContext, extensionId);
  try {
    await expect(page.locator('#view-onboarding:not(.hidden)')).toBeVisible();
    await expect(page.locator('#view-empty.hidden')).toHaveCount(1);
  } finally {
    await page.close();
  }
});

test('OB2: no skipping and no guest mode options exist', async ({ extContext, extensionId }) => {
  const page = await freshPopup(extContext, extensionId);
  try {
    // Assert no skip button and no guest button exist
    await expect(page.locator('#onboardingSkip')).toHaveCount(0);
    await expect(page.locator('#onboardingNext')).toHaveCount(0);
  } finally {
    await page.close();
  }
});

test('OB3: displays tabs for sign in and sign up with email, password, and pin without name', async ({ extContext, extensionId }) => {
  const page = await freshPopup(extContext, extensionId);
  try {
    // Default: Sign In tab active
    await expect(page.locator('#tabSignIn')).toHaveClass(/active/);
    await expect(page.locator('#onboardSignInPane:not(.hidden)')).toBeVisible();
    await expect(page.locator('#onboardingEmail')).toBeVisible();
    await expect(page.locator('#onboardingPassword')).toBeVisible();
    await expect(page.locator('#onboardSignInPane input[type="text"]')).toHaveCount(0); // Only email and password

    // Switch to Sign Up tab
    await page.locator('#tabSignUp').click();
    await expect(page.locator('#tabSignUp')).toHaveClass(/active/);
    await expect(page.locator('#onboardSignUpPane:not(.hidden)')).toBeVisible();
    await expect(page.locator('#onboardingSuEmail')).toBeVisible();
    await expect(page.locator('#onboardingSuPassword')).toBeVisible();
    await expect(page.locator('#onboardingSuPin')).toBeVisible();
    // Only email, password, pin (no name field)
    await expect(page.locator('#onboardSignUpPane #onboardingSuName')).toHaveCount(0);
  } finally {
    await page.close();
  }
});

test('OB4: sign up validates 4-digit security PIN', async ({ extContext, extensionId }) => {
  const page = await freshPopup(extContext, extensionId);
  try {
    await page.locator('#tabSignUp').click();
    await page.locator('#onboardingSuEmail').fill('testuser@example.com');
    await page.locator('#onboardingSuPassword').fill('password123');
    await page.locator('#onboardingSuPin').fill('12'); // invalid PIN (less than 4 digits)
    await page.locator('#onboardingBtnSignUp').click();

    await expect(page.locator('#onboardingAuthError:not(.hidden)')).toBeVisible();
    await expect(page.locator('#onboardingAuthError')).toContainText('Security PIN must be exactly 4 digits');
  } finally {
    await page.close();
  }
});

test('OB5: sign in shows first letter of email in top section and removes 3rd picture from settings', async ({ extContext, extensionId }) => {
  const page = await freshPopup(extContext, extensionId);
  try {
    await page.locator('#onboardingEmail').fill('deepan9210@gmail.com');
    await page.locator('#onboardingPassword').fill('deepan@2007');
    await page.locator('#onboardingBtnSignIn').click();

    await expect(page.locator('#view-empty:not(.hidden)')).toBeVisible({ timeout: 25000 });

    // Top section: first letter of email ('D') displayed in avatar button
    await expect(page.locator('#userAvatarBtn:not(.hidden)')).toBeVisible();
    await expect(page.locator('#userAvatarLetter')).toHaveText('D');

    // Click avatar or settings to inspect Settings modal
    await page.locator('#userAvatarBtn').click();
    await expect(page.locator('#settingsModal:not(.hidden)')).toBeVisible();

    // 3rd picture elements MUST NOT exist:
    await expect(page.locator('#adminUrlInput')).toHaveCount(0);
    await expect(page.locator('#adminUrlSave')).toHaveCount(0);
    await expect(page.locator('#authEmail')).toHaveCount(0);
    await expect(page.locator('#btnSignIn')).toHaveCount(0);
    await expect(page.locator('#linkForgot')).toHaveCount(0);

    // Instead, clean account profile is shown:
    await expect(page.locator('#authUserEmail')).toContainText('deepan9210@gmail.com');
    await expect(page.locator('#accountProfileLetter')).toHaveText('D');
    await expect(page.locator('#btnSignOut')).toBeVisible();
  } finally {
    await page.close();
  }
});

test('OB6: forgot password link switches to reset pane and validates inputs', async ({ extContext, extensionId }) => {
  const page = await freshPopup(extContext, extensionId);
  try {
    await expect(page.locator('#onboardingLinkForgot')).toBeVisible();
    await page.locator('#onboardingEmail').fill('reset@example.com');
    await page.locator('#onboardingLinkForgot').click();

    // Reset pane should be visible, tabs and sign in hidden
    await expect(page.locator('#onboardForgotPane:not(.hidden)')).toBeVisible();
    await expect(page.locator('#authTabBar')).toHaveClass(/hidden/);
    await expect(page.locator('#onboardSignInPane')).toHaveClass(/hidden/);

    // Email should be carried over
    await expect(page.locator('#onboardFpEmail')).toHaveValue('reset@example.com');

    // Validation: empty PIN
    await page.locator('#onboardBtnResetPassword').click();
    await expect(page.locator('#onboardingAuthError:not(.hidden)')).toContainText('Email, 4-digit PIN, and new password are required');

    // Validation: non-4 digit PIN
    await page.locator('#onboardFpPin').fill('12');
    await page.locator('#onboardFpNewPassword').fill('NewPassword123');
    await page.locator('#onboardBtnResetPassword').click();
    await expect(page.locator('#onboardingAuthError:not(.hidden)')).toContainText('Security PIN must be exactly 4 digits');

    // Back to Sign In button works
    await page.locator('#onboardBtnBackToSignIn').click();
    await expect(page.locator('#onboardForgotPane')).toHaveClass(/hidden/);
    await expect(page.locator('#authTabBar:not(.hidden)')).toBeVisible();
    await expect(page.locator('#onboardSignInPane:not(.hidden)')).toBeVisible();
  } finally {
    await page.close();
  }
});

test('OB7: Continue as Guest enters guest mode, and signing in exits guest mode to show email and removes is-guest', async ({ extContext, extensionId }) => {
  const page = await freshPopup(extContext, extensionId);
  try {
    // 1. Enter Guest Mode from onboarding
    await expect(page.locator('#onboardingBtnGuest')).toBeVisible();
    await page.locator('#onboardingBtnGuest').click();
    await expect(page.locator('#view-empty:not(.hidden)')).toBeVisible({ timeout: 10000 });

    // 2. Avatar shows guest state
    await expect(page.locator('#userAvatarBtn:not(.hidden)')).toBeVisible();
    await expect(page.locator('#userAvatarBtn')).toHaveClass(/is-guest/);

    // 3. Settings modal shows Guest Mode card, signed-in card is hidden
    await page.locator('#userAvatarBtn').click();
    await expect(page.locator('#settingsModal:not(.hidden)')).toBeVisible();
    await expect(page.locator('#authSignedOut:not(.hidden)')).toBeVisible();
    await expect(page.locator('#authSignedIn')).toHaveClass(/hidden/);

    // 4. Click Sign In / Create Account button inside settings to return to onboarding
    await page.locator('#btnGoToSignIn').click();
    await expect(page.locator('#settingsModal')).toHaveClass(/hidden/);
    await expect(page.locator('#view-onboarding:not(.hidden)')).toBeVisible();

    // 5. Sign in with email
    await page.locator('#onboardingEmail').fill('deepan9210@gmail.com');
    await page.locator('#onboardingPassword').fill('deepan@2007');
    await page.locator('#onboardingBtnSignIn').click();
    await expect(page.locator('#view-empty:not(.hidden)')).toBeVisible({ timeout: 10000 });

    // 6. Avatar is no longer in guest mode, shows initial 'D'
    await expect(page.locator('#userAvatarBtn')).not.toHaveClass(/is-guest/);
    await expect(page.locator('#userAvatarLetter')).toHaveText('D');

    // 7. Settings modal now shows signed-in email card and hides guest mode card
    await page.locator('#userAvatarBtn').click();
    await expect(page.locator('#settingsModal:not(.hidden)')).toBeVisible();
    await expect(page.locator('#authSignedIn:not(.hidden)')).toBeVisible();
    await expect(page.locator('#authUserEmail')).toContainText('deepan9210@gmail.com');
    await expect(page.locator('#authSignedOut')).toHaveClass(/hidden/);

    // 8. Reload page: persists signed-in state with email, not guest mode
    await page.reload();
    await expect(page.locator('#view-empty:not(.hidden)')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#userAvatarBtn')).not.toHaveClass(/is-guest/);
    await expect(page.locator('#userAvatarLetter')).toHaveText('D');
    await page.locator('#userAvatarBtn').click();
    await expect(page.locator('#authSignedIn:not(.hidden)')).toBeVisible();
    await expect(page.locator('#authUserEmail')).toContainText('deepan9210@gmail.com');
    await expect(page.locator('#authSignedOut')).toHaveClass(/hidden/);
  } finally {
    await page.close();
  }
});




