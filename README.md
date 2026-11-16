# Splitify — Collaborative Expense Splitting Web Application

<p align="center">
  <img src="./public/assets/splitify-logo.png" alt="Splitify Logo" width="160" height="160" style="border-radius: 28px; box-shadow: 0 10px 25px rgba(32, 61, 98, 0.2);" />
</p>

<p align="center">
  <strong>Minimalistic, intuitive, and modern expense management for trips, roommates, outings, and friend groups.</strong>
</p>

<p align="center">
  🌐 <strong>Live Application URL:</strong> <a href="https://k-692.github.io/Splitify/"><strong>https://k-692.github.io/Splitify/</strong></a>
</p>

<p align="center">
  <a href="https://k-692.github.io/Splitify/"><img src="https://img.shields.io/badge/Live_App-k--692.github.io%2FSplitify-16AA88?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Live App" /></a>
  <img src="https://img.shields.io/badge/Release-v1.0.0-16AA88?style=for-the-badge" alt="Release" />
  <img src="https://img.shields.io/badge/React-19-203D62?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6.2-646CFF?style=for-the-badge&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Firebase-Auth_%26_Firestore-FFA611?style=for-the-badge&logo=firebase" alt="Firebase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38BDF8?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Deployed_on-GitHub_Pages-222?style=for-the-badge&logo=github" alt="GitHub Pages" />
</p>

---

## 📖 Overview

**Splitify** is a collaborative expense-management application designed for:
- 🏖️ **Friends travelling together** (Goa trips, weekend getaways, road trips)
- 🏠 **Roommates sharing household expenses** (rent, electricity, groceries, internet)
- 🍕 **Groups managing outings and celebrations** (birthdays, dinners, parties)

With Splitify, manual calculations are completely eliminated. The application automatically computes individual contributions, exact shares, net positions, debt simplification suggestions, and records settlements in real time.

---

## ✨ Key Features

### 1. 🔐 Google Authentication & User Profiles
- Seamless sign-in with **Google Sign-In** (popup with automatic redirect fallback).
- Unique Splitify username handles (e.g. `@krish`, `@rahul`, `@priya`) for private friend discovery.
- Profile customization, avatars, and persistent authentication sessions.

### 2. 🧾 Item-First Expense Architecture & Categories
Splitify adopts an **Item-First architecture** designed for speed, flexibility, and collaborative transparency:
- **Instant Direct Expenses:** When recording an expense (e.g. Airport Cab ₹1,200), it is created directly as a standalone item with its own cost, payer, split mode, and participants.
- **One-Click Category Conversion:** Any standalone item can be converted into a category whenever additional subitems need to be logged (e.g., converting "Food" into a category with "Breakfast" and "Dinner" subitems).
- **Zero Data Loss:** When converting, existing expense details are automatically preserved as the first subitem.
- **No Double-Counting:** Category items dynamically calculate their total from their active subitems, while standalone items report their direct cost.
- **Universal Modification & Deletion with Event-Wide Alerts:** Any member of an event can modify or delete any item, subitem, or category. When an item or subitem is modified or deleted, an alert notification is automatically dispatched to all members of that event, identifying the actor by their Splitify handle (`@handle`).
- **Master "Select All" Checkbox:** A convenient master checkbox in the event items header selects all standalone items and subitems with one click, allowing any user to bulk-delete all event items instantly.
- **Item Information Modal ("i" Button):** Every standalone item, category, and subitem includes an information button ("i") that opens a detailed modal showing emoji, item name, parent category, total cost, date, time, payer handle, split mode, and a complete participant breakdown with individual shares and quick "+ Add Friend" buttons for non-friends.

### 3. 🔗 Event Invitation Links (No Join Codes)
- **Unique Shareable URLs:** Every event generates clean invitation URLs (e.g. `https://k-692.github.io/Splitify/join/<token>`). No hashes (`#`) in URLs thanks to modern GitHub Pages SPA routing with `404.html`. Join Codes are completely removed.
- **Accurate Real-Time Member Count:** Join invitations reliably display the accurate live count of already joined members (`Members already joined: N`) both for authenticated members and prospective invitees before signing in.
- **Copy Link Invitation:** One-click copying of invitation links with full event access or selected-item scopes.
- **Flexible Scopes:**
  - **Full Event Access:** Invitees can view and participate in all event expenses.
  - **Selected Items Only:** Restrict invitees to specific items (e.g., someone only joining for the cab or hotel).
- **Smooth Invitation Onboarding:** Unauthenticated visitors preview event details, joined member counts, and inviter handle (`@handle`), and are guided to sign in to claim an expected person slot or join as a new person.

### 4. 👥 Individual Person Slots ("People")
- **Expected Participant Placeholders:** Hosts can specify expected people during event creation via inline chips or add them later in the **People** screen.
- **Slot Claiming & Creation:** When an invitee joins via an invitation link, they can claim their dedicated spot (e.g., "Claim spot for @rahul") or create a new slot to join.
- **Automatic Expense & Settlement Resolution:** Claimed slots are immediately resolved to the joined member's UID and Splitify handle (`@handle`) across all calculations, optimal settlements, and member totals.
- **Protection of Claimed Slots:** Claimed slots display the joined member's avatar and handle with a `✓ Joined` badge and cannot be deleted. Unclaimed placeholders can be removed by the host.

### 5. 🧾 Expense Creation Wizard & Subitem Categories
- **"Do you have subitems? ☑" Checkbox:**
  - **Unchecked (Standalone Expense):** Quick entry with description, amount, calendar date picker (`YYYY-MM-DD`), payer, split mode, and participants.
  - **Checked (Category with Subitems):** Step 1 prompts for Category Name -> Step 2 allows staging multiple subitems with dynamic total computation.
- **Universal Collaborative Control:** Any member can edit or delete items, with automatic event-wide notifications informing all participants.
- **Splitify Handle Identification:** Members are consistently identified by their Splitify handle (`@username`) across cards, optimal settlements, member totals, and notifications, rather than raw first names.
- **Direct "+ Add Friend" Action:** Non-friends in events and item breakdowns display an "+ Add Friend" button, allowing members to connect with a single click.

### 6. 📋 Copy Expenses — Plain-Text Export
- Prominent **"Copy Expenses"** button on event details.
- Formats complete event summary with the clean **Event Invitation Link placed FIRST at the very top**, followed by dates, timestamps, categorized and standalone items, subitems, payers, splits, settlements, and total expense.
- Integrated with Clipboard API.

### 7. 🚪 Event Deletion & Voluntary Leaving
- **Event Deletion (Host Only):** Soft-deletion confirmation modal with immediate removal.
- **Voluntary Leave (Members):** Members can leave an event voluntarily. Hosts cannot kick members. If an unsettled balance exists, a clear warning is displayed. On leaving, the member's claimed person slot is automatically released.

### 8. 🏷️ Splitify Handle Renaming & Smart Suggestions
- **Unlimited Renaming:** Users can update their `@handle` in Profile whenever they choose.
- **Smart Handle Suggestions:** When a requested handle is unavailable, Splitify dynamically generates candidate suggestions derived from the user's name and handle, verifying real-time availability in Firestore.
- **Atomic Firestore Transactions:** Ensures handle reservation, old handle release, and profile updates occur atomically and enforce case-insensitive uniqueness in `usernames/{handle.toLowerCase()}` without permission errors.

### 9. ⚖️ Flexible & Exact Splitting with Auto-Balance
- **Equal Split (Default):** Divides cost equally among selected participants or slots with deterministic integer minor-unit rounding (zero remainder loss).
- **Exact Amount Split with Auto-Distribution:** When entering custom amounts, Splitify automatically and deterministically distributes the remaining unassigned balance in minor currency units (paise) across unedited participants, preventing mathematical discrepancies. Manual edits are preserved with one-click "Reset to Auto" controls.

### 10. 🔍 Dedicated In-Event Expense Search
- **Real-Time Search Bar:** Positioned directly above the expense hierarchy inside every event.
- **Deep Multilevel Matching:** Matches standalone items, categories, subitem names, comments, and payer names case-insensitively with automatic category expansion.
- **Clean Empty State:** Clear "No matching expenses found" feedback with a one-click "Clear Search" button.

### 11. 💸 Two-Step Settlement Confirmation Flow
- **Authoritative Ledger Integrity:** Debtor payments do not alter financial balances until verified by the creditor.
- **Step 1 (Debtor Marks `[ Paid ]`):** Debtor submits payment details (amount, method: UPI/Cash/Bank Transfer/Other, reference number, notes, date, and time). A pending record is created in `events/{eventId}/paymentConfirmations` with status `awaiting_confirmation`. Outstanding debt remains strictly unchanged.
- **Step 2 (Creditor Verification):** Creditor receives actionable alerts in the event dashboard and notifications with a **`[ Settle Now ]`** button.
  - **`[ Confirm Receipt ]`:** Instantly records an immutable completed settlement in `events/{eventId}/settlements`, marks the confirmation `confirmed`, and adjusts balances in real time with celebratory visual feedback.
  - **`[ Not Received ]`:** Rejects the payment claim with an optional note, restores full outstanding debt, and notifies the debtor.
- **Partial Settlements:** Full support for partial repayments (`amount <= remainingDebt`), accurately reducing the outstanding balance.
- **No Direct Bypass:** All settlements must pass through the verified two-step confirmation workflow.

### 12. ⏱️ Chronological Sorting of All Event Entries
- **Date & Time Picker:** Standalone expenses and subitems record both date (`YYYY-MM-DD`) and time (`HH:mm`), establishing an exact `occurredAt` UTC timestamp.
- **Unified Chronological Hierarchy:** Standalone items, category subitems, categories (dynamically sorted by their latest active child occurrence), settlements, and pending confirmations are ordered chronologically (newest first).
- **Consistent Everywhere:** Chronological descending order is strictly maintained in the expense hierarchy, search results, and plain-text export reports.

### 13. 🤝 Friends, Event Invitations & Universal Friend Request Actions
- **Universal Friend Request Actions:** Reusable `Accept` and `Decline` controls available everywhere an incoming request is displayed: Friends tab (Received Requests), search results (if an incoming request exists), and the Notifications inbox.
- **Dedicated Event Invitations Section:** The Friends page features 3 dedicated tabs:
  1. *My Friends* (with direct event invitation modal).
  2. *Friend Requests* (Received and Sent requests with real-time badges).
  3. *Event Invitations* (real-time invitations from friends to join events with event emoji, name, inviter handle `@handle`, date/time, and one-click Accept/Decline actions).
- **Search Users by Handle:** Real-time lookup with atomic Firestore security rules and profile caching.
- **30-Day Auto-Purge:** Notifications and activities older than 30 days are automatically pruned in the background, keeping user inboxes responsive and clutter-free.
- **Streamlined UI Text:** All sections, titles, and tabs use the single most relevant name (e.g. *Settlements*, *Profile*, *People*, *Friends*, *Notifications*), keeping the interface clean and concise.

### 10. 🎨 Brand Identity, Mobile Responsiveness & Polished UI/UX
- Official palette derived from the Splitify logo:
  - Deep Navy: `#203D62`
  - Teal Green: `#16AA88`
  - Vibrant Orange: `#F36B2C`
  - Warm Yellow: `#F5A623`
  - Light Sky Blue: `#60BCE8`
- **Nunito** friendly, rounded typography.
- **Full Mobile Browser Compatibility:** Optimized for iPhone (Safari), Android (Chrome), iPad, tablets, and desktop viewports with responsive modals, safe-area padding, and touch-friendly controls.
- **Streamlined Navigation:** Header and bottom navigation focused cleanly on **Home** and **Friends**.
- **Simplified Home Screen:** Focused purely on **My Events** with total expenses, net balance badges, and quick share actions.
- Automatic keyword-based **Emoji Detection** (with fallback 📌).

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite 6 |
| **Routing** | React Router v7 (`HashRouter` for GitHub Pages SPA compatibility) |
| **Styling** | Tailwind CSS v3.4, Custom CSS Design Tokens, Lucide Icons |
| **State & Calculations** | Custom React Contexts, Pure Domain Financial Calculation Engine |
| **Backend & Database** | Firebase Authentication (Google Sign-In), Cloud Firestore Modular SDK v11 |
| **Security** | Cloud Firestore Security Rules (`firestore.rules`) |
| **Testing** | Vitest, React Testing Library, JSDOM |
| **CI/CD & Deployment** | GitHub Actions (`deploy-pages`), GitHub Pages |

---

## 🏗️ Project Architecture

Splitify follows a clean modular architecture separating UI presentation, domain logic, and persistence:

```text
Splitify/
├── public/
│   ├── assets/
│   │   └── splitify-logo.png      # Official branding logo
│   └── favicon.png
├── src/
│   ├── app/
│   │   ├── providers/             # AuthContext, ThemeContext, NotificationContext
│   │   └── router/                # HashRouter with protected routes
│   ├── components/
│   │   ├── common/                # Button, Avatar, Modal, Badge, FirebaseSetupBanner
│   │   ├── layout/                # Navbar, BottomNav, AppLayout
│   │   ├── expenses/              # ExpenseModal, BulkDeleteModal, InviteFriendModal
│   │   └── dashboard/             # SettlementModal
│   ├── pages/
│   │   ├── Login/                 # Google Sign-in & interactive demo persona login
│   │   ├── Home/                  # High-level overview, quick actions, event cards
│   │   ├── Events/                # Search, filter, create, and join events
│   │   ├── EventDetails/          # Core hierarchy, financial dashboard, settlements
│   │   ├── Friends/               # Username discovery, requests, friends list
│   │   ├── Notifications/         # Activity inbox, invitations, reminders
│   │   └── Profile/               # Preferences, themes, currency, sign-out
│   ├── domain/
│   │   └── calculations/          # Pure financial math, equal/amount splits, debt simplification
│   ├── services/
│   │   ├── firebase/              # Firebase modular configuration and auth service
│   │   └── dataService.ts         # Dual-mode data service (Cloud Firestore + reactive local state)
│   ├── utils/                     # Currency, date formatting, emoji detection, demo seed
│   ├── styles/                    # Tailwind CSS and brand token definitions
│   └── types/                     # Typed domain interfaces
├── tests/                         # Comprehensive Vitest unit & component test suites
├── .github/workflows/deploy.yml   # Automated GitHub Pages CI/CD workflow
├── firestore.rules                # Production Cloud Firestore Security Rules
├── firestore.indexes.json         # Firestore query composite indexes
├── firebase.json                  # Firebase project manifest
├── vite.config.ts                 # Base path /Splitify/, code-splitting, Vitest config
└── package.json
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18, v20, v22, or v25)
- npm (v9+)

### Installation
```bash
# Clone the repository
git clone https://github.com/K-692/Splitify.git
cd Splitify

# Install dependencies
npm install

# Start the local development server
npm run dev
```

Open your browser at `http://localhost:5173/Splitify/`.

---

## ⚙️ Firebase Setup & Configuration

Splitify uses the Firebase project: **`splitify-151bd`**.

### 1. Configure Web Credentials
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate the values from your [Firebase Console](https://console.firebase.google.com/project/splitify-151bd/settings/general):
```env
VITE_FIREBASE_API_KEY=your_actual_api_key
VITE_FIREBASE_AUTH_DOMAIN=splitify-151bd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=splitify-151bd
VITE_FIREBASE_STORAGE_BUCKET=splitify-151bd.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 2. Enable Firebase Authentication
1. Go to **Authentication** > **Sign-in method** in Firebase Console.
2. Enable **Google** sign-in provider.
3. Under **Authorized domains**, add:
   - `localhost`
   - `k-692.github.io`

### 3. Enable Cloud Firestore
1. Go to **Firestore Database** > **Create database**.
2. Select your preferred region.

### 4. Deploy Security Rules
Deploy the rules with Firebase CLI:
```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project splitify-151bd
```

---

## 🧪 Testing

Splitify includes comprehensive automated tests covering financial math, equal/unequal splits, remainder preservation, debt simplification, settlement impact, and emoji selection.

```bash
# Run all unit and component tests
npm test

# Run tests in watch mode
npm run test:watch

# Run TypeScript check and production build
npm run build
```

---

## 🚢 Deployment to GitHub Pages

The application is deployed via GitHub Actions on every push to `main`.

1. Go to **Settings** > **Pages** in the GitHub repository (`https://github.com/K-692/Splitify/settings/pages`).
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. (Optional) In **Settings** > **Secrets and variables** > **Actions**, add your Firebase web config secrets (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`).
4. Push to `main` — GitHub Actions will test, build, and deploy the application.

**Live URL:**  
https://k-692.github.io/Splitify/

---

## 📱 Future Android Compatibility (Capacitor)

The codebase is built with mobile packaging in mind:
- Pure domain financial logic has zero DOM or browser-specific dependencies.
- Navigation layout adapts to touchscreens with safe-area paddings and bottom navigation.
- Ready to wrap using Capacitor:
  ```bash
  npm install @capacitor/core @capacitor/cli @capacitor/android
  npx cap init Splitify app.splitify.web
  npx cap add android
  npx cap copy
  ```

---

## 📄 License

This project is licensed under the MIT License.
