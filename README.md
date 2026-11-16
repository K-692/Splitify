# Splitify — Collaborative Expense Splitting Web Application

<p align="center">
  <img src="./public/assets/splitify-logo.png" alt="Splitify Logo" width="160" height="160" style="border-radius: 28px; box-shadow: 0 10px 25px rgba(32, 61, 98, 0.2);" />
</p>

<p align="center">
  <strong>Minimalistic, intuitive, and modern expense management for trips, roommates, outings, and groups.</strong>
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
- 🏖️ **Friends and groups travelling together** (trips, weekend getaways, road trips)
- 🏠 **Roommates sharing household expenses** (rent, electricity, groceries, internet)
- 🍕 **Groups managing outings and celebrations** (birthdays, dinners, parties)

With Splitify, manual calculations and awkward debt tracking are completely eliminated. The application automatically computes individual contributions, exact shares, net balances, debt simplification suggestions, and tracks payments with a verified two-step settlement flow in real time.

---

## ✨ Key Features

### 1. 🔐 Google Authentication & Editable First-Name Profiles
- Seamless sign-in with **Google Sign-In** (popup with automatic redirect fallback).
- **First Name by Default:** New accounts automatically use the first name extracted from Google accounts (or email username).
- **Freely Editable Display Name:** Users can freely edit their display name in Profile at any time without unique handle requirements, complex suggestions, or `@` symbols.

### 2. 🔗 Exclusive Invite-Link Event Onboarding (No Friends / No Friend Requests)
- **Zero Friend Management Overhead:** No friend requests, no accepting/declining, no friend lists. People connect and collaborate solely through shareable event invitation links.
- **Unique Shareable URLs:** Every event generates a clean invitation URL (e.g. `https://k-692.github.io/Splitify/join/<token>`).
- **Accurate Real-Time Member Count:** Join invitations reliably display the accurate live count of already joined members (`Members already joined: N`) both for authenticated members and prospective invitees before signing in.
- **One-Click Share & Copy:** Share links directly across WhatsApp, Telegram, Messenger, SMS, or Email.
- **Smooth Onboarding:** Invitees click the link, authenticate with Google, and automatically join the event, appearing instantly in the event members list.

### 3. 👥 Individual Person Slots ("People")
- **Expected Participant Placeholders:** Hosts can specify expected people during event creation via inline chips or add them later in the **People** screen.
- **Slot Claiming & Creation:** When an invitee joins via an invitation link, they can claim their dedicated spot (e.g., "Claim spot for Rahul") or create a new slot to join.
- **Automatic Expense & Settlement Resolution:** Claimed slots are immediately resolved to the joined member's UID and display name across all calculations, optimal settlements, and member totals.
- **Protection of Claimed Slots:** Claimed slots display the joined member's avatar and name with a `✓ Joined` badge and cannot be deleted. Unclaimed placeholders can be removed by the host.

### 4. 🧾 Item-First Expense Architecture & Categories
Splitify adopts an **Item-First architecture** designed for speed, flexibility, and collaborative transparency:
- **Instant Direct Expenses:** When recording an expense (e.g. Airport Cab ₹1,200), it is created directly as a standalone item with its own cost, payer, split mode, and participants.
- **One-Click Category Conversion:** Any standalone item can be converted into a category whenever additional subitems need to be logged (e.g., converting "Food" into a category with "Breakfast" and "Dinner" subitems).
- **Zero Data Loss:** When converting, existing expense details are automatically preserved as the first subitem.
- **No Double-Counting:** Category items dynamically calculate their total from their active subitems, while standalone items report their direct cost.
- **Universal Collaborative Control:** Any member of an event can modify, add subitems to, or delete any item or category. Real-time alert notifications inform members of changes using clean display names.
- **Master "Select All" Checkbox:** A convenient master checkbox in the event items header selects all standalone items and subitems with one click, allowing quick bulk operations.
- **Item Information Modal ("i" Button):** Every standalone item, category, and subitem includes an information button ("i") that opens a detailed modal showing emoji, item name, parent category, total cost, date, time, payer, split mode, and complete participant shares breakdown.

### 5. ⚖️ Flexible & Exact Splitting with Auto-Balance
- **Equal Split (Default):** Divides cost equally among selected participants or slots with deterministic integer minor-unit rounding (zero remainder loss).
- **Exact Amount Split with Auto-Distribution:** When entering custom amounts, Splitify automatically and deterministically distributes the remaining unassigned balance in minor currency units (paise) across unedited participants, preventing mathematical discrepancies. Manual edits are preserved with one-click "Reset to Auto" controls.

### 6. 💸 Two-Step Settlement Confirmation Flow
- **Authoritative Ledger Integrity:** Debtor payments do not alter financial balances until verified by the creditor.
- **Step 1 (Debtor Marks `[ Paid ]`):** Debtor submits payment details (amount, method: UPI/Cash/Bank Transfer/Other, reference number, notes, date, and time). A pending record is created with status `awaiting_confirmation`. Outstanding debt remains strictly unchanged.
- **Step 2 (Creditor Verification):** Creditor receives actionable alerts in the event dashboard and notifications with a **`[ Settle Now ]`** button.
  - **`[ Confirm Receipt ]`:** Instantly records an immutable completed settlement in `events/{eventId}/settlements`, marks the confirmation `confirmed`, and adjusts balances in real time with celebratory visual feedback.
  - **`[ Not Received ]`:** Rejects the payment claim with an optional note, restores full outstanding debt, and notifies the debtor.
- **Partial Settlements:** Full support for partial repayments (`amount <= remainingDebt`), accurately reducing the outstanding balance.
- **Payment Reminders with 5-Minute Anti-Spam:** Creditors can click `Send Reminder` to remind debtors of unsettled dues. Locks out spamming for 5 minutes.

### 7. ⏱️ Chronological Sorting of All Event Entries
- **Date & Time Picker:** Standalone expenses and subitems record both date (`YYYY-MM-DD`) and time (`HH:mm`), establishing an exact `occurredAt` timestamp.
- **Unified Chronological Hierarchy:** Standalone items, category subitems, categories, settlements, and pending confirmations are ordered chronologically (newest first).

### 8. 🔍 Dedicated In-Event Expense Search
- **Real-Time Search Bar:** Positioned directly above the expense hierarchy inside every event.
- **Deep Multilevel Matching:** Matches standalone items, categories, subitem names, comments, and payer names case-insensitively with automatic category expansion.
- **Clean Empty State:** Clear "No matching expenses found" feedback with a one-click "Clear Search" button.

### 9. 📋 Copy Expenses — Plain-Text Export
- Prominent **"Copy Expenses"** button on event details.
- Formats complete event summary with the clean **Event Invitation Link placed FIRST at the very top**, followed by dates, timestamps, categorized and standalone items, subitems, payers, splits, settlements, and total expense.
- Integrated with Clipboard API.

### 10. 🚪 Event Deletion & Voluntary Leaving
- **Event Deletion (Host Only):** Soft-deletion confirmation modal with immediate removal.
- **Voluntary Leave (Members):** Members can leave an event voluntarily. Hosts cannot kick members. If an unsettled balance exists, a clear warning is displayed. On leaving, the member's claimed person slot is automatically released.

### 11. 🎨 Brand Identity, Mobile Responsiveness & Polished UI/UX
- Official palette derived from the Splitify logo:
  - Deep Navy: `#203D62`
  - Teal Green: `#16AA88`
  - Vibrant Orange: `#F36B2C`
  - Warm Yellow: `#F5A623`
  - Light Sky Blue: `#60BCE8`
- **Nunito** friendly, rounded typography.
- **Full Mobile Browser Compatibility:** Optimized for iPhone (Safari), Android (Chrome), iPad, tablets, and desktop viewports with responsive modals, safe-area padding, and touch-friendly controls.
- **Streamlined 3-Tab Mobile Navigation:** Bottom navigation focused on **Home**, **Inbox**, and **Profile**.
- **Dark & Light Mode:** Seamless theme toggle with system preference synchronization.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite 6 |
| **Routing** | React Router v7 with GitHub Pages SPA redirect support |
| **Styling** | Tailwind CSS v3.4, Custom CSS Design Tokens, Lucide Icons |
| **State & Calculations** | Custom React Contexts, Pure Domain Financial Calculation Engine |
| **Backend & Database** | Firebase Authentication (Google Sign-In), Cloud Firestore Modular SDK v11 |
| **Security** | Cloud Firestore Security Rules (`firestore.rules`) |
| **Testing** | Vitest, React Testing Library, JSDOM (14 test suites, 69 unit tests) |
| **CI/CD & Deployment** | GitHub Actions (`deploy-pages`), GitHub Pages |

---

## 🏗️ Project Architecture

```text
Splitify/
├── public/
│   ├── assets/
│   │   └── splitify-logo.png      # Official branding logo
│   └── favicon.png
├── src/
│   ├── app/
│   │   ├── providers/             # AuthContext, ThemeContext, NotificationContext
│   │   └── router/                # Protected routes and navigation
│   ├── components/
│   │   ├── common/                # Button, Avatar, Modal, Badge
│   │   ├── layout/                # Navbar, BottomNav (3-tab: Home, Inbox, Profile), AppLayout
│   │   ├── expenses/              # ExpenseModal, BulkDeleteModal, ItemInfoModal
│   │   ├── events/                # ShareInviteModal, SlotsModal
│   │   └── dashboard/             # PaymentDetailsModal, ConfirmPaymentReceiptModal
│   ├── pages/
│   │   ├── Login/                 # Google Sign-in & demo persona login
│   │   ├── Home/                  # Event overview, quick actions, event cards
│   │   ├── EventDetails/          # Core hierarchy, financial dashboard, settlements, members
│   │   ├── Join/                  # Direct invitation link onboarding & slot claiming
│   │   ├── Notifications/         # Activity inbox, payment reminders, event alerts
│   │   └── Profile/               # Display name editing, theme preferences, sign-out
│   ├── domain/
│   │   └── calculations/          # Pure financial math, equal/amount splits, debt simplification
│   ├── services/
│   │   ├── firebase/              # Firebase modular configuration and auth service
│   │   └── dataService.ts         # Dual-mode data service (Cloud Firestore + reactive local state)
│   ├── utils/                     # Currency, date formatting, emoji detection, cooldowns
│   ├── styles/                    # Tailwind CSS and brand token definitions
│   └── types/                     # Typed domain interfaces
├── tests/                         # Comprehensive Vitest unit & component test suites (69 tests)
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
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=splitify-151bd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=splitify-151bd
VITE_FIREBASE_STORAGE_BUCKET=splitify-151bd.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 2. Run Firestore Security Rules & Emulators
```bash
# Test security rules using the Firebase Firestore Emulator
npx firebase emulators:exec --only firestore "npm test"
```

---

## 🧪 Testing

```bash
# Run all Vitest unit and integration test suites
npm test

# Run tests with code coverage
npm run test:coverage
```

All 14 test suites and 69 tests execute locally with 100% pass rate.

---

## 📦 Production Build

```bash
# Compile TypeScript and bundle with Vite
npm run build
```

Production output is generated in `dist/` with optimized vendor chunking and SPA redirect support via `dist/404.html`.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
