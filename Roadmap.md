## 📆 Roadmap Frontend – Next.js + Tailwind + shadcn/ui (24 tuần)

---

### 🔹 Tháng 1 – Nền tảng & Auth

#### Tuần 1: Thiết lập dự án (Next.js 14)
- **Ngày 01:** Chọn kiến trúc monorepo (pnpm workspace), tạo repo, init `pnpm`, cấu trúc `apps/`, `packages/`.
- **Ngày 02:** Tạo app Next.js (`app-router`), cấu hình TypeScript strict, eslint, prettier, husky.
- **Ngày 03:** Tích hợp Tailwind CSS, custom config, đặt base style (fonts, colors), reset global CSS.
- **Ngày 04:** Cài shadcn/ui, generate component base (Button, Card, Dialog), thiết lập alias modules.
- **Ngày 05:** Thiết kế layout tổng (root layout, metadata), header-footer, CSS variables theme.
- **Ngày 06:** Implement dark/light toggle, lưu trạng thái vào localStorage + system preference.
- **Ngày 07:** Viết tài liệu setup nội bộ, vẽ Architecture diagram (mermaid), kiểm tra lint/pre-commit.

#### Tuần 2: Layout dashboard & navigation
- **Ngày 08:** Thiết kế dashboard shell (sidebar + topbar), responsive grid.
- **Ngày 09:** Tạo navigation config (links, icons), active state, breadcrumbs.
- **Ngày 10:** State persistence sidebar (collapsed/expanded), animation shadcn/ui.
- **Ngày 11:** Tạo component avatar, user dropdown (profile, settings, logout).
- **Ngày 12:** Tích hợp SEO cơ bản (metadata builder, OpenGraph template).
- **Ngày 13:** Tạo responsive nav cho mobile (sheet drawer, keyboard accessibility).
- **Ngày 14:** Test accessibility (axe), kiểm thử UI trên nhiều viewport, ghi chú cải thiện.

#### Tuần 3: Auth UI (NextAuth)
- **Ngày 15:** Phân tích flow auth (login, register, forgot), chọn provider (credentials/OAuth).
- **Ngày 16:** Thiết kế form login với shadcn form, validation bằng Zod/React Hook Form.
- **Ngày 17:** Tạo Register form, confirm password, các error states.
- **Ngày 18:** Forgot password UI, success state, hướng dẫn flow email.
- **Ngày 19:** Implement social login buttons (Google/GitHub) UI + placeholder.
- **Ngày 20:** Thiết lập NextAuth config (server route), JWT strategy, session callback.
- **Ngày 21:** Bảo vệ routes server + client, loading UI, viết tests cơ bản cho auth hooks.

#### Tuần 4: Tích hợp Backend auth
- **Ngày 22:** Kết nối API BE: cấu hình base URL, axios/fetch wrapper, interceptors.
- **Ngày 23:** Implement login/register thực tế (mutation + toast feedback).
- **Ngày 24:** Refresh token flow, error handling toàn hệ thống, state `useAuth`.
- **Ngày 25:** Build guard component (ProtectedRoute), redirect logic cho unauthenticated.
- **Ngày 26:** Trang Profile, hiển thị dữ liệu user, form cập nhật thông tin.
- **Ngày 27:** Điều chỉnh loading skeleton, empty state, tạo reusable states.
- **Ngày 28:** Viết Storybook cho component auth, Playwright test happy path.

---

### 🔹 Tháng 2 – Document Workspace & Upload

#### Tuần 5: Document list view
- **Ngày 29:** Thiết kế card/list item cho document, metadata (owner, status, updated).
- **Ngày 30:** API fetch documents, pagination (cursor/infinite scroll).
- **Ngày 31:** Search bar, debounce input, call API, hiển thị kết quả.
- **Ngày 32:** Bộ lọc (status tags, date range), UI filter panel (shadcn popover).
- **Ngày 33:** Sort controls (created, updated, title), integrate API.
- **Ngày 34:** Empty state illustration, CTA upload, doc shimmering skeleton.
- **Ngày 35:** Unit test list component, hook fetch, update documentation.

#### Tuần 6: Upload Experience
- **Ngày 36:** Phân tích upload flow (drag-drop, multi file, progress).
- **Ngày 37:** Tạo component Dropzone (react-dropzone), UI states (hover, error).
- **Ngày 38:** Validate file type/size, hiển thị lỗi, tooltip guidelines.
- **Ngày 39:** Hiển thị queue upload, progress bar, cancel/retry buttons.
- **Ngày 40:** Streaming status update (SSE/socket) placeholder.
- **Ngày 41:** Upload modal thành công/thất bại, integrate API backend.
- **Ngày 42:** E2E test upload flow, record demo CLI upload.

#### Tuần 7: Document detail page
- **Ngày 43:** Layout trang detail: header info, actions, tabs content.
- **Ngày 44:** Status timeline (processing stages), component stepper.
- **Ngày 45:** Metadata section (owner, tags, dates, statistics).
- **Ngày 46:** Preview area (PDF placeholder), responsive layout.
- **Ngày 47:** Action bar (download, share, reprocess, delete).
- **Ngày 48:** Comments/notes section UI (optional), integrate threads.
- **Ngày 49:** Accessibility pass detail page, fix color contrast.

#### Tuần 8: Notifications & UX polish
- **Ngày 50:** Implement global toast system (shadcn toast), consistent usage.
- **Ngày 51:** Notification center UI (list + read/unread), integrate API.
- **Ngày 52:** Skeleton builder, reusable loading blocks, shimmer style.
- **Ngày 53:** Error boundary page (500, maintenance), friendly copywriting.
- **Ngày 54:** Responsive audit (mobile/tablet), fix layout issues.
- **Ngày 55:** Add motion (Framer Motion) subtle transitions.
- **Ngày 56:** Regression tests, update design system documentation.

---

### 🔹 Tháng 3 – AI Assistant & Context tools

#### Tuần 9: Chat workspace
- **Ngày 57:** Phân tích chat layout (sidebar sessions + main thread).
- **Ngày 58:** Build session list (create, rename, delete).
- **Ngày 59:** Chat message bubbles, roles (user/assistant/system), timestamps.
- **Ngày 60:** Input composer (Markdown editor, attachments), hotkeys.
- **Ngày 61:** Typing indicators, message status (sending/sent/fail).
- **Ngày 62:** Scroll management, auto-scroll, jump to latest.
- **Ngày 63:** Unit test chat components, snapshot UI.

#### Tuần 10: Streaming & citations
- **Ngày 64:** Implement SSE/websocket streaming placeholder (mock).
- **Ngày 65:** Token-by-token animation, show typing progress.
- **Ngày 66:** Citation tags inline, anchor to context.
- **Ngày 67:** Context panel (sources list), link to document detail.
- **Ngày 68:** Copy message button, markdown rendering enhancements.
- **Ngày 69:** Feedback widgets (thumbs up/down) and rationale dialog.
- **Ngày 70:** Record demo video streaming chat, gather feedback.

#### Tuần 11: Model Context Protocol & Prompt Optimization
- **Ngày 71:** Mapping data sources (vector, metadata, knowledge graph) → UI requirements.
- **Ngày 72:** **Implement Model Context Protocol (MCP) & Prompt Optimization**  
  - [ ] Design MCP context schema (vector DB, metadata, knowledge graph)  
  - [ ] Build context aggregation pipeline & prioritization logic  
  - [ ] Implement model routing (GPT-3.5 vs GPT-4) with cost tracking  
  - [ ] Create A/B testing framework + prompt versioning system  
  - [ ] Add performance dashboard & context quality metrics  
- **Ngày 73:** Context inspector UI: chunk highlight, similarity heatmap.
- **Ngày 74:** Source preview modal, quick jump to document positions.
- **Ngày 75:** Prompt tuning panel for admins (edit prompt, compare results).
- **Ngày 76:** Telemetry collection (latency, token usage), UI charts.
- **Ngày 77:** Usability test with scripts, iterate on MCP UX.

#### Tuần 12: Versioning & accessibility
- **Ngày 78:** Conversation history versioning (snapshots), diff viewer.
- **Ngày 79:** Save/restore prompt configurations, rollback UI.
- **Ngày 80:** Implement optimistic updates + rollback states chat.
- **Ngày 81:** Accessible forms (labels, aria), screen reader review.
- **Ngày 82:** Keyboard shortcuts cheat sheet modal.
- **Ngày 83:** Print/PDF export of session transcripts.
- **Ngày 84:** QA week: fix bugs, documentation updates.

---

### 🔹 Tháng 4 – Admin & Analytics**

#### Tuần 13: Admin dashboard
- **Ngày 85:** Layout admin home, info cards (KPIs, metrics).
- **Ngày 86:** Build chart components (recharts/visx) base theme.
- **Ngày 87:** Implement usage metrics chart (documents/day, users).
- **Ngày 88:** Table for recent activity, sortable, filterable.
- **Ngày 89:** Real-time status indicators (processing queue).
- **Ngày 90:** Export data CSV, download buttons, spinner.
- **Ngày 91:** Admin dashboard tests + snapshot + storybook.

#### Tuần 14: User management
- **Ngày 92:** User list page, search/filter by role/status.
- **Ngày 93:** Detail drawer (user info, activity logs, sessions).
- **Ngày 94:** Role assignment UI (RBAC matrix), toggle permissions.
- **Ngày 95:** Invite user flow (email invitation), status tracking.
- **Ngày 96:** Account suspension/activation UI, confirm dialogs.
- **Ngày 97:** Audit log viewer, timeline component, filters.
- **Ngày 98:** Document admin processes, write changelog entry.

#### Tuần 15: Analytics & cost
- **Ngày 99:** Cost breakdown view (tokens, storage, compute).
- **Ngày 100:** Filters by user/team/date range, compare view.
- **Ngày 101:** Heatmaps for usage (week/day), time-of-day analysis.
- **Ngày 102:** Savings suggestions UI (optimize prompts, cleanup).
- **Ngày 103:** Build downloadable reports (PDF/CSV).
- **Ngày 104:** Alerts for cost spikes, thresholds config.
- **Ngày 105:** Verification tests, data accuracy audit.

#### Tuần 16: Settings & performance
- **Ngày 106:** Settings layout (tabs), forms (profile, app, billing).
- **Ngày 107:** Feature flags UI, toggle modules, environment badges.
- **Ngày 108:** Secrets management UI (API keys, rotation warnings).
- **Ngày 109:** SSR caching strategy (Next.js revalidate, SWR tuning).
- **Ngày 110:** Progressive enhancement for slow networks.
- **Ngày 111:** Performance profiling, fix costly re-renders.
- **Ngày 112:** Document setup, readiness review for production.

---

### 🔹 Tháng 5 – Integrations & Polish

#### Tuần 17: Webhooks & Docs
- **Ngày 113:** Webhook list UI, create/edit form, secret generation.
- **Ngày 114:** Test log viewer, replay delivery button.
- **Ngày 115:** API token management (create, revoke, scopes).
- **Ngày 116:** Developer documentation site (MDX), navigation.
- **Ngày 117:** API playground UI (make test call), environment selection.
- **Ngày 118:** Rate limiting warnings, quota usage UI.
- **Ngày 119:** Collect feedback from devs, document updates.

#### Tuần 18: External connectors
- **Ngày 120:** OAuth flow UI for Google Drive/Slack connectors.
- **Ngày 121:** Connector list, status badges (Connected/Syncing/Error).
- **Ngày 122:** Configuration forms (folders, channels), validation.
- **Ngày 123:** Sync history timeline, manual sync button.
- **Ngày 124:** Error handling UI (retry, report issue).
- **Ngày 125:** Notifications for connector events.
- **Ngày 126:** Integration tests, connector docs.

#### Tuần 19: Offline & resilience
- **Ngày 127:** Global offline indicator, fallback states.
- **Ngày 128:** Retry mechanism for failed fetch, toast notifications.
- **Ngày 129:** Error boundary wrapping, custom 500 pages.
- **Ngày 130:** Maintenance mode UI, countdown, info.
- **Ngày 131:** Local cache strategy (IndexedDB) for recent docs.
- **Ngày 132:** Test resilience (throttle network, offline devtools).
- **Ngày 133:** Document resilience playbook, finalize PRs.

#### Tuần 20: Optimization & SEO
- **Ngày 134:** Lighthouse audit (desktop/mobile), fix top issues.
- **Ngày 135:** Bundle analysis (webpack analyzer), code split modules.
- **Ngày 136:** Image optimization (Next Image), responsive sizes.
- **Ngày 137:** Metadata (OpenGraph/Twitter), dynamic routes.
- **Ngày 138:** Sitemap, robots, canonical tags.
- **Ngày 139:** Structured data for docs & FAQ.
- **Ngày 140:** Final polish sprint, UX review with stakeholders.

---

### 🔹 Tháng 6 – QA & Demo Prep

#### Tuần 21: Storybook & visual tests
- **Ngày 141:** Setup Storybook with themes, add main components.
- **Ngày 142:** Chromatic/visual regression (Loki/Storybook test runner).
- **Ngày 143:** Document component props, controls, MDX docs.
- **Ngày 144:** Integrate design tokens Storybook addon.
- **Ngày 145:** Accessibility review via Storybook a11y.
- **Ngày 146:** Snapshot tests for critical components.
- **Ngày 147:** Gather team feedback, iterate.

#### Tuần 22: E2E automation
- **Ngày 148:** Setup Playwright/Cypress project structure.
- **Ngày 149:** Write auth flow tests (login, register, logout).
- **Ngày 150:** Document upload + processing E2E test.
- **Ngày 151:** Chat session E2E with streaming mocks.
- **Ngày 152:** Admin CRUD E2E tests, role assertions.
- **Ngày 153:** Schedule CI runs, parallel testing config.
- **Ngày 154:** Monitor flakes, stabilize tests, docs.

#### Tuần 23: Demo & marketing
- **Ngày 155:** Prepare product tour script (use-case based).
- **Ngày 156:** Capture screen recordings (Loom/OBS), annotate.
- **Ngày 157:** Build pitch deck slides, highlight metrics.
- **Ngày 158:** Landing page polish, add testimonials/metrics.
- **Ngày 159:** Create FAQ page, pricing plans mock.
- **Ngày 160:** Prep investor/FAANG interview briefs.
- **Ngày 161:** Internal dry-run demo, gather feedback.

#### Tuần 24: Launch readiness
- **Ngày 162:** Final bug bash, triage issues, prioritize.
- **Ngày 163:** Deploy automation (Github Actions, Vercel, smoke tests).
- **Ngày 164:** Backup/rollback procedures, runbooks.
- **Ngày 165:** Security review (headers, CSP, vulnerability scan).
- **Ngày 166:** Final analytics setup (PostHog/Segment).
- **Ngày 167:** Launch checklist, sign-off docs.
- **Ngày 168:** Mock interviews, prepare case studies, rest day 🎉