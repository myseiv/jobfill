# JobFill — Next Update Roadmap

Four issues to address before broader distribution.

---

## 1. Register resilience

**Problem:** The extension depends on the Home Office register being at a consistent URL in a consistent format. It already broke once during development (xlsx → CSV). When it breaks again, sponsor badges silently stop working with no user-facing indication.

**What needs fixing:**
- Show a visible "register unavailable" state on badges and in the popup rather than rendering nothing
- Add a last-updated timestamp to the popup so users can tell if the data is stale
- Build a fallback — either a cached copy hosted independently, or a grace period where the last good register is kept until a fresh one is confirmed valid
- Monitor the gov.uk Content API response on each refresh and surface failures clearly

---

## 2. ATS coverage — Workday and SmartRecruiters

**Problem:** The autofill only works on Greenhouse and Lever. Workday and SmartRecruiters handle the majority of enterprise UK job applications and are currently unsupported.

**What needs fixing:**
- Add content scripts and field detection for `myworkdayjobs.com` and `careers.smartrecruiters.com`
- Both platforms use heavily JavaScript-rendered forms — field detection timing and MutationObserver logic will need tuning
- Workday in particular uses non-standard input patterns that may require custom classification logic
- Add both domains to `manifest.json` host_permissions and content_scripts matches

---

## 3. Multi-page form handling

**Problem:** The field cache is built once on page load and only covers the current visible form. Multi-page applications (common on Workday, and sometimes Greenhouse) mean page 2+ fields are never detected or filled.

**What needs fixing:**
- Detect page/step transitions via URL changes or DOM mutations and re-run field detection on each step
- Clear and rebuild `fieldCache` on navigation within a single-page application flow
- Consider storing partially-filled session state so a user can trigger Fill on each page without reconfiguring

---

## 4. Sponsor check as a standalone web tool

**Problem:** The popup sponsor lookup is the most universally useful feature — it works for anyone job-hunting in the UK regardless of which ATS or job board they use. Requiring a Chrome extension install to access it limits reach significantly.

**What needs fixing:**
- Build a simple web page (could be a GitHub Pages site) where anyone can type a company name and instantly check its licence status
- The register data is public — it can be fetched client-side with no backend needed
- This removes the install friction entirely for the most common use case
- Would also serve as a discovery funnel for the full extension
