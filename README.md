# JobFill

A Chrome extension that checks UK visa sponsorship status on job listings and autofills job applications using AI.

## Features

- **Sponsor badges** — browse LinkedIn and Indeed and instantly see which companies hold a Home Office Skilled Worker licence. Badges appear inline on every job card.
- **Autofill** — on Greenhouse and Lever application forms, fills your name, email, phone, and location from your saved profile. Open-text questions are answered by an AI using your experience and the job description.
- **Sponsor lookup** — type any company name in the popup to check its licence status manually.
- **Application tracker** — every form submission is logged. Update statuses (applied → interviewing → offer → rejected) and filter from the settings page.

## Installation

JobFill is not yet on the Chrome Web Store. Load it unpacked:

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `jobfill` folder.
5. Pin the extension from the puzzle-piece menu for easy access.

## Setup

### Profile

1. Click the JobFill icon → **Settings** (gear icon), or go to `chrome://extensions` → JobFill → **Details** → **Extension options**.
2. Fill in your personal details: name, email, phone, location, LinkedIn, GitHub.
3. Add work experience and education entries.
4. Click **Save profile**.

### Groq API Key (for AI autofill)

AI autofill of open-text questions requires a free Groq API key:

1. Sign up at [console.groq.com](https://console.groq.com) — it's free.
2. Create an API key.
3. Paste it into **Settings → API Settings → Groq API Key** → **Save API settings**.

Without a key, personal fields (name, email, phone, location) still fill automatically. Only open-text questions are skipped.

## Usage

### Sponsor badges (LinkedIn / Indeed)

Just browse jobs normally. A green **✓ Sponsor** or red **✗ No licence** badge appears next to each company name automatically.

> **Note:** The Home Office updates the register monthly. A missing badge does not confirm a company won't sponsor — check directly with the employer.

### Autofill (Greenhouse / Lever)

1. Open a job application page on `boards.greenhouse.io`, `job-boards.greenhouse.io`, or `jobs.lever.co`.
2. Click the JobFill icon.
3. Click **Fill this form**.
4. The popup reports how many fields were filled, skipped, or errored.

### Manual sponsor lookup

1. Click the JobFill icon on any tab.
2. Type a company name in the **Check a company** field.
3. The result shows licence status, tier, and route instantly.

### Application tracker

Go to **Settings → Application Tracker** to:
- See all logged applications with company, role, and date.
- Update status via the dropdown (applied / interviewing / rejected / offer).
- Filter by status.
- Delete entries.

### Refreshing the sponsor register

The register updates automatically every 7 days. To force a refresh:
**Settings → Sponsor Register → Refresh now**.

## Supported sites

| Feature | Sites |
|---|---|
| Sponsor badges | LinkedIn Jobs, Indeed (uk.indeed.com, indeed.com) |
| Autofill | Greenhouse (boards.greenhouse.io, job-boards.greenhouse.io), Lever (jobs.lever.co) |

## Privacy

- All profile data is stored locally in your browser via `chrome.storage.local`. Nothing is sent to any server except your Groq API key (used only to generate answers, sent directly to Groq).
- The sponsor register is fetched from the official UK government API and cached locally.
- No analytics, no tracking.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your profile and application log locally |
| `tabs` | Send autofill messages to the active tab |
| `activeTab` | Read the current tab URL to show the fill button |
| `alarms` | Schedule weekly register refresh |
| Host permissions | Fetch the gov.uk register and call the Groq API |
