<p align="center">
  <img src="./app_logo.png" alt="Splitify logo" width="140" style="border-radius: 28px;" />
</p>

<h1 align="center">Splitify</h1>

<p align="center">
  Shared expense tracking for trips, roommates and group outings — on the web and on Android.
</p>

<p align="center">
  <a href="https://k-692.github.io/Splitify/"><img src="https://img.shields.io/badge/Web_App-Open-16AA88?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Open the web app" /></a>
  <a href="https://github.com/K-692/Splitify/raw/main/Splitify-v1.4.2.apk"><img src="https://img.shields.io/badge/Android_APK-v1.4.2-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Download the Android APK" /></a>
</p>

---

## Download

| Platform | Link |
|---|---|
| Web | [k-692.github.io/Splitify](https://k-692.github.io/Splitify/) |
| Android (v1.4.2) | [Splitify-v1.4.2.apk](https://github.com/K-692/Splitify/raw/main/Splitify-v1.4.2.apk) — Android 8.0 or later |
| Release notes | [GitHub Releases](https://github.com/K-692/Splitify/releases/latest) |

**Installing the APK:** download it on your phone, open it, and allow installs from your browser or file manager if prompted. Existing installs update in place and keep your data — everything is stored in your Google account, not on the device.

## Features

**Events and expenses**
- Create an event, add expenses, and optionally group them into categories with sub-items.
- Split equally, or enter exact amounts — the unassigned remainder is distributed automatically.
- All amounts are stored in whole paise, so totals always balance exactly.

**People**
- Add people to an event by name before they have an account. Their share is tracked from day one.
- When someone opens the invite link, they must either **select their name** from the event's list or **add themselves as a new person**. A new name that matches someone already on the list is rejected, so expenses are never split across duplicates.
- Claiming a name moves all of that person's existing expenses to their account.
- The host can remove people who have not joined yet. Removal is blocked while that person is still part of any expense, and the affected expenses are listed.

**Balances and settlements**
- **Settlements** tab: each person's total paid, fair share and net balance, with reminders for anyone who owes money.
- **Marking a payment as paid**
  - *By the person receiving the money:* recorded in the ledger immediately.
  - *By the person paying:* sent to the receiver to approve or reject before it is recorded.
- **Individual Expenses** tab: each person's share of every item, grouped by **Names** or by **Items**.
  - Each item shows only the person's share, as a red *Debited* amount; the item card shows who paid for it.
  - Each person's summary shows *Credited* (the total they paid), *Debited* (their total share, plus settlements received) and *Net*. Net equals the person's balance.

**General**
- Google Sign-In, real-time sync across web and Android, in-app notifications.
- Light and dark themes; layouts tested down to 320 px wide.
- Plain-text expense report for sharing.

## Tech stack

| Area | Technology |
|---|---|
| App | React 19, TypeScript, Vite 6, Tailwind CSS 3 |
| Android | Capacitor 6 (min SDK 26, target SDK 34) |
| Backend | Firebase Authentication, Cloud Firestore (security rules in `firestore.rules`) |
| Tests | Vitest, React Testing Library |
| CI/CD | GitHub Actions — GitHub Pages deploy and Android build on every push to `main` |

## Project structure

```text
src/
  pages/          Home, EventDetails, Join, Notifications, Profile, Login
  components/     Shared UI, modals, and the Individual Expenses tab
  domain/         Pure balance, split and per-person ledger calculations
  services/       Firestore data access (with a local demo mode) and auth
  utils/          Currency, dates, name resolution, report export
tests/            Unit and component tests
android/          Capacitor Android project
```

## Local development

Requirements: Node.js 18+ and npm.

```bash
git clone https://github.com/K-692/Splitify.git
cd Splitify
npm install
cp .env.example .env   # add your Firebase web app config
npm run dev            # http://localhost:5173/Splitify/
```

Without Firebase credentials the app runs in a local **demo mode** backed by browser storage, which is useful for UI work.

| Command | Purpose |
|---|---|
| `npm test` | Run the test suite |
| `npm run build` | Production web build into `dist/` |
| `npm run android:sync` | Build web assets and sync them into the Android project |
| `npm run android:build` | Build a release APK |

### Android build notes

- Use **JDK 17** (the Gradle version in this project does not run on newer JDKs).
- Place your own `android/app/google-services.json` (not committed; see `google-services.json.example`).
- Release signing is read from `SPLITIFY_KEYSTORE_PATH`, `SPLITIFY_KEYSTORE_PASSWORD`, `SPLITIFY_KEY_ALIAS` and `SPLITIFY_KEY_PASSWORD`, or from `android/signing.properties` (template provided).
- Google Sign-In requires the release key's SHA-1 and SHA-256 fingerprints to be registered for `com.splitify.app` in the Firebase console.

## Deployment

Pushing to `main` runs the GitHub Actions workflows, which test and publish the web app to GitHub Pages and build the Android APK. Release APKs are committed to the repository root and linked above.
