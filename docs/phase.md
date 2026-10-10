# PriceCompare — Development Roadmap (phase.md)

> Source of truth: `docs/appidea.md`. This document splits the entire application into dependency-ordered phases. Each phase is fully complete, integrated, tested, and production-ready before the next begins. No placeholder, mock, or fake functionality is planned at any stage.

**Confirmed decisions:**
- Notifications: **in-app** (stored in MongoDB, shown in a notification center). Email/push deferred.
- Store integrations: **real authorized APIs / affiliate feeds** with live credentials available when Phase 3 starts.
- Currency: Indian Rupees (₹), implied by appidea.md examples and supported platforms.
- `Price` concept in appidea.md is modeled as: current price fields on `StoreListing` + a `PriceHistory` collection.

---

## Phase 1 — Project Foundation & Data Model

### Objective
Establish the complete technical foundation: monorepo scaffold, database connectivity, every domain model with indexes, and base seed data — so all later phases build on a stable, schema-complete backend.

### Features Included
- Monorepo layout: `client/` and `server/`
- Frontend scaffold: React + Vite + Tailwind CSS + Redux Toolkit + Axios + React Router
- Backend scaffold: Node.js + Express.js app with environment configuration
- Central error-handling middleware and consistent API error format
- Request input validation middleware
- MongoDB connection via Mongoose (with reconnect handling)
- Health-check endpoint
- Seed scripts: stores, category tree, initial admin user

### Pages / Routes
- `client/` app shell with router installed (no feature pages yet)
- `GET /api/health` — server health/status endpoint

### Backend
- Express server bootstrap: CORS, JSON body parsing, route mounting structure, 404 handler, centralized error handler
- Config module reading environment variables (`PORT`, `MONGO_URI`, `JWT_SECRET`, store API credentials placeholders, `ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- All Mongoose models compiled and exported

### Database
All collections created with relationships, indexes, and constraints:
- **User**: name, email (unique), passwordHash, role (`user` | `admin`), timestamps
- **Store**: name, slug (unique), domain, affiliateLinkTemplate/config, active flag
- **Category**: name, slug (unique), parent (self-referencing), timestamps
- **Product**: title, brand, model, sku, gtin/ean/upc, category (ref), images[], specs (key-value), variant attributes (color, size, variant name), normalized search fields, timestamps; **text index** on title/brand/model
- **StoreListing**: product (ref), store (ref), storeProductId, url, affiliateUrl, currentPrice, mrp, discountPercent, availability status, deliveryInfo, lastSyncedAt; **unique compound index** on (store, storeProductId); index on product
- **PriceHistory**: listing (ref), product (ref), price, mrp, capturedAt; index on (product, capturedAt)
- **Wishlist**: user (ref), product (ref); unique compound index on (user, product)
- **PriceAlert**: user (ref), product (ref), targetPrice, condition, active flag, timestamps
- **SyncJob**: type, store (ref), status (`pending` | `running` | `success` | `failed`), stats, error, startedAt, finishedAt
- **DataQualityIssue**: type, related listing/product refs, description, status, timestamps
- **Notification**: user (ref), type, message, related product, read flag, timestamps
- **ActivityLog**: actor (ref), action, entity, metadata, timestamps

### Business Logic
- Documented model decisions: current price lives on `StoreListing`; `PriceHistory` records snapshots

### Integrations
- None yet (credential slots reserved via environment variables)

### Security & Permissions
- Environment variables for secrets; no secrets committed to the repo
- Passwords stored as hashes only (bcrypt used from Phase 2; schema field prepared now)

### Edge Cases
- Seed script must be idempotent (safe to re-run without duplicating stores/categories/admin)
- Database connection failure must surface a clear error, not crash silently

### Completion Criteria
1. `npm run dev` starts both client and server
2. `GET /api/health` returns a success response
3. All models compile; indexes are created in MongoDB
4. Seed script runs idempotently: 3 stores (Amazon, Flipkart, Myntra), a category tree, and one admin user exist
5. Lint passes on both client and server

---

## Phase 2 — Authentication, User Accounts & Authorization

### Objective
Deliver complete, secure authentication and authorization for both `user` and `admin` roles, end to end (backend + frontend), including profile management.

### Features Included
- Register, login, logout
- JWT-based session handling
- Password hashing (bcrypt)
- Role-based access control (`user`, `admin`)
- Profile view and edit (name, email)
- Change password
- Protected route components on the frontend
- Persistent auth state (token + user in Redux, restored on page refresh)

### Pages / Routes
- `/register` — registration form
- `/login` — login form
- `/profile` — authenticated profile management page
- Frontend route guards: `RequireAuth`, `RequireAdmin`

### Backend
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/users/me` (update profile)
- `PUT /api/users/me/password` (change password)
- Auth middleware: `requireAuth`, `requireRole('admin')`
- JWT issuance with expiry; simple re-authentication on expiry

### Database
- User documents created/updated through the above endpoints
- No new collections required (User model from Phase 1)

### Business Logic
- Email uniqueness enforced at registration
- Password strength validation
- Profile update cannot set another user's email already in use
- Password change requires current password confirmation

### Integrations
- None

### Security & Permissions
- bcrypt password hashing with appropriate cost factor
- JWT signed with `JWT_SECRET`
- Auth middleware applied to protected endpoints
- Rate limiting on auth endpoints (brute-force protection)
- No password or token ever logged
- Input validation on all auth/user endpoints

### Edge Cases
- Duplicate email registration → clear conflict error
- Invalid credentials → generic error (no user enumeration)
- Expired/invalid token → 401 with frontend redirect to login
- Non-admin accessing admin routes → 403
- Changing password invalidates other sessions where feasible

### Completion Criteria
1. A new user can register, log out, log back in, and persists across refresh
2. Login with wrong password fails with a clear message
3. Protected pages redirect unauthenticated users to `/login`
4. Admin-only routes return 403 for regular users
5. Profile edit and password change work end to end
6. All validation, loading, and error states function on auth pages

---

## Phase 3 — Automatic Product Discovery & Store Integration Pipeline

> This is the application's stated most-important requirement: a central product catalog + store listing aggregation + price comparison system with automatic discovery of new products.

### Objective
Build the full ingestion pipeline that periodically synchronizes product data from Amazon, Flipkart, and Myntra via their authorized APIs/affiliate feeds, discovers new products, matches listings to existing products, updates prices and availability, and records price history.

### Features Included
- Per-store integration adapter contract
- Live adapters for Amazon, Flipkart, and Myntra (credentials via environment variables)
- Periodic scheduled synchronization (in-process background scheduler)
- Manual sync trigger endpoint (admin API; UI in Phase 6)
- Ingestion pipeline: fetch → normalize → detect new → existence check → product matching → upsert → price/availability update → price history recording
- Product name normalization utilities
- Product matching engine using reliable identifiers
- Unmatched / ambiguous listings routed to a data-quality queue
- Sync failure capture, retry with backoff, and error logging
- Price-change event hook (consumed by Phase 5 price alerts)

### Pages / Routes
- No user-facing pages in this phase (pipeline + admin-facing API only)

### Backend
- Adapter interface: each store adapter fetches listings (new/updated since a cursor) and normalizes them to a canonical listing DTO
- Sync orchestration: SyncJob lifecycle (`pending` → `running` → `success`/`failed`), one concurrent run per store, retry policy, full stats capture (new products, updated listings, unmatched, errors)
- Ingestion service implementing the full pipeline described above
- Admin API endpoints (role-protected): list sync jobs, get job detail, trigger manual sync, view failed jobs, list data-quality issues

### Database
- Writes to: Product, StoreListing, PriceHistory, SyncJob, DataQualityIssue, ActivityLog
- Existence checks against StoreListing unique index (store + storeProductId)
- PriceHistory appended only when price actually changes

### Business Logic
- **Matching order**: exact GTIN/EAN/UPC → SKU → brand + model + variant (size/color) → normalized-name similarity with a confidence threshold
- Similar names alone are never treated as proof of identical products; low-confidence matches are queued for admin review instead of auto-merged
- New products become immediately searchable in the catalog
- Existing products get listing/price updates rather than duplicates
- Idempotent re-runs (same feed data twice produces no duplicate products or listings)

### Integrations
- Amazon authorized product API (e.g., Product Advertising API) — live credentials
- Flipkart authorized API/affiliate feed — live credentials
- Myntra authorized API/feed — live credentials
- Each adapter isolated so store-specific quirks do not leak into core pipeline logic

### Security & Permissions
- Store API credentials stored only in environment variables
- Admin job/monitoring endpoints protected by `requireRole('admin')`
- External API responses validated before persisting (schema validation on ingestion)

### Edge Cases
- Store API timeout / rate limit / downtime → job marked failed with error captured, no partial corrupt data
- Partial batch failure → successfully processed items committed, failures recorded
- Duplicate listings within one feed batch → deduplicated
- Product removed/out of stock upstream → availability updated
- Malformed upstream data → rejected and logged, not persisted
- Matching ambiguity → DataQualityIssue created, listing quarantined from auto-merge

### Completion Criteria
1. Scheduled sync runs and creates SyncJob records with accurate stats
2. With live credentials, a real sync discovers new products and updates existing listings in the database
3. The same product from 3 stores links to one Product document with 3 StoreListing documents
4. Price changes appear in PriceHistory; unchanged prices create no history entries
5. Re-running a sync does not create duplicates
6. Forced API failure produces a failed SyncJob with a readable error, no data corruption
7. Unmatched listings appear in the data-quality queue
8. Newly synced products are queryable in the database (searchable in Phase 4)

---

## Phase 4 — Catalog Search, Browse & Price Comparison

### Objective
Expose the synced catalog to end users: search, browse by category, view a multi-store comparison screen with all comparison attributes, see price history, and be redirected to the chosen store via permitted/affiliate links.

### Features Included
- Product search with filters, sorting, and pagination
- Category browsing
- Product detail / comparison screen (same product across stores)
- Best-price highlighting and discount computation
- Price history chart per product
- Tracked "Buy Now" / "Go to Store" redirect with affiliate link
- Search result filtering by: category, brand, price range, availability, store
- Sorting by: relevance, price (low/high), discount, newest
- All empty, loading, and error states

### Pages / Routes
- `/` — home with search bar
- `/search?q=...` — search results with filter/sort UI
- `/category/:slug` — category browse
- `/product/:id` — product detail & price comparison screen (listings grouped, price chart, Buy Now buttons)

### Backend
- `GET /api/products/search` — query, filters, sort, pagination
- `GET /api/categories` — category tree
- `GET /api/products/:id` — product detail with all StoreListings, computed best price, discount, availability, delivery info
- `GET /api/products/:id/price-history`
- `GET /api/go/:listingId` — logs a click (ActivityLog) and 302-redirects to the listing's affiliate/product URL

### Database
- Reads from Product, StoreListing, PriceHistory, Category
- Writes ClickLog/ActivityLog entries on store redirects
- Query performance verified against existing indexes (text index on Product)

### Business Logic
- Best price computed across active, in-stock listings
- Discount computed from MRP vs current price
- Affiliate link used for redirect per store configuration
- Price history chart data aggregated per day where appropriate

### Integrations
- Affiliate link templates configured per store (from Phase 1 Store config)

### Security & Permissions
- Public (guest-accessible) endpoints; no auth required for search/browse/compare
- Redirect endpoint cannot be abused to redirect to arbitrary external URLs (only persisted listing URLs)
- Input validation on all query parameters

### Edge Cases
- No search results → clear empty state
- Product with a single store listing → comparison screen still renders correctly
- Product with zero active listings → graceful handling
- Invalid product/listing ID → 404 page
- Very long search queries / injection attempts → safely handled
- Slow backend → loading skeletons on all pages

### Completion Criteria
1. Searching a term returns synced products with correct filters and sorting
2. Product page shows the same product from multiple stores side by side with price, MRP, discount, availability, delivery info, store name, and URL
3. Clicking Buy Now logs the click and redirects to the correct store URL with the affiliate link
4. Price history chart renders real historical data
5. Empty, loading, and error states work on every page
6. All comparison fields listed in appidea.md are visible

---

## Phase 5 — Wishlist, Price Alerts & In-App Notifications

### Objective
Allow authenticated users to save products, set price alerts, and receive in-app notifications when target prices are reached.

### Features Included
- Add/remove product to/from wishlist
- View saved products (wishlist page) with current prices
- Create, view, pause, and delete price alerts
- Alert evaluation integrated into the Phase 3 price-update flow
- In-app notification creation on price-drop alert trigger (deduplicated)
- Notification center: list notifications, mark read, mark all read, unread count badge

### Pages / Routes
- `/wishlist` — saved products
- `/alerts` — price alerts management
- Notification bell/dropdown in the app header; `/notifications` page

### Backend
- `POST /api/wishlist/:productId` / `DELETE /api/wishlist/:productId`
- `GET /api/wishlist`
- `POST /api/alerts`, `GET /api/alerts`, `PATCH /api/alerts/:id`, `DELETE /api/alerts/:id`
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`
- Alert evaluation hook invoked whenever a listing price updates (from Phase 3 pipeline)

### Database
- Writes to Wishlist, PriceAlert, Notification
- Unique constraint prevents duplicate wishlist entries per user/product

### Business Logic
- Alert triggers when current price ≤ target price (or agreed drop condition)
- A single price drop triggers one notification per matching alert, not repeated on every sync of the same unchanged price
- Alerts can be paused/resumed and deleted
- Wishlist add/remove is a toggle, idempotent

### Integrations
- None (in-app notifications only, per confirmed decision)

### Security & Permissions
- All endpoints require authentication; users can only access their own wishlist/alerts/notifications (ownership enforced in queries)
- Input validation: target price must be a positive number; productId must exist

### Edge Cases
- Adding an already-wished product → no duplicate, clear feedback
- Alert target already below current price at creation → handled (notify immediately or on next drop; behavior documented)
- Product with no listings → alert remains, evaluates on future price data
- Multiple alerts on the same product → each evaluates independently
- Notification deduplication for unchanged prices across sync runs

### Completion Criteria
1. Authenticated user can add/remove wishlist items; page reflects state after refresh
2. Price alert can be created, paused, resumed, and deleted
3. A real (or manually triggered) price drop to the target creates an in-app notification for the correct user
4. No duplicate notifications for an unchanged price across multiple syncs
5. Notification bell shows unread count; marking read works
6. Unauthenticated access to any of these routes redirects to login
7. All empty, loading, and error states work

---

## Phase 6 — Admin Area

### Objective
Deliver a complete admin dashboard allowing administrators to manage and monitor every aspect of the system listed in appidea.md.

### Features Included
- Admin dashboard with summary statistics
- Product management (view, edit, create manually, merge/unmerge matching review)
- Store listing management (view, edit, attach/detach from products)
- Store management (CRUD, affiliate link configuration, enable/disable)
- Category management (CRUD, tree structure)
- User management (list, change role, deactivate)
- Price data views (current prices, history, anomalies)
- Product matching review (approve/resolve data-quality issues, manually merge listings)
- Sync job monitoring (list, detail, trigger manual sync, retry failed)
- Failed integrations view
- Data quality issues queue with resolution actions
- Price updates audit view
- System activity log

### Pages / Routes
- `/admin` — dashboard
- `/admin/products`, `/admin/products/:id`
- `/admin/listings`
- `/admin/stores`, `/admin/stores/:id`
- `/admin/categories`
- `/admin/users`
- `/admin/prices`
- `/admin/matching` (data quality / matching review)
- `/admin/jobs` (sync jobs, failed integrations)
- `/admin/activity` (system activity log)

### Backend
- All Phase 3 admin job APIs now consumed by real UI
- CRUD endpoints for: Product, StoreListing, Store, Category
- User management endpoints (role change, deactivate)
- Matching review endpoints: approve match, reject/merge, resolve data-quality issues
- ActivityLog read endpoints for audit views

### Database
- All writes go through the existing models; admin actions recorded in ActivityLog
- Merge operation reassigns StoreListings between Product documents and archives the merged product

### Business Logic
- Manual product creation supports the "manually entered products" complement to auto-discovery
- Merging products reassigns listings correctly and removes duplicates
- Only admin role can access any `/admin` route or API
- Destructive actions (deactivate user, disable store) require confirmation and are logged

### Integrations
- None new (consumes existing Phase 3/4/5 integrations)

### Security & Permissions
- Every admin route and API is protected by `requireRole('admin')`
- Frontend `RequireAdmin` guard redirects non-admins
- All mutating admin actions written to ActivityLog (who did what, when)

### Edge Cases
- Merging products with conflicting identifiers → validation, prevented or flagged
- Deactivating a store hides its listings from public comparison
- Deleting a category with products → prevented or products reassigned (documented behavior)
- Non-admin attempting any admin API → 403
- Concurrent admin edits → last-write-wins with validation, no crash

### Completion Criteria
1. Admin can log in and access the dashboard; non-admin cannot
2. Every capability listed in appidea.md's Admin section is reachable and functional via the UI
3. Manual product creation works and the product appears in search
4. Matching review can resolve a data-quality issue created in Phase 3
5. Sync jobs can be triggered, retried, and inspected from the UI
6. Every admin mutation appears in the activity log
7. All admin pages have working empty, loading, and error states

---

## Phase 7 — Advanced Features & Production Hardening

### Objective
Add the genuinely useful advanced features identified in appidea.md, apply caching and performance improvements, and harden the application for production.

### Features Included
- Search suggestions / autocomplete (debounced, backed by the product text index)
- Product recommendations: related products (same category/brand) on the detail page; trending products (from click/view activity)
- Caching layer for hot search/category queries (TTL-based invalidation on sync)
- Background job queue formalization (Redis-backed if available; otherwise the DB-backed scheduler from Phase 3 remains, documented)
- Rate limiting, security headers, input sanitization hardening across all endpoints
- Performance audit: index usage, pagination caps, N+1 query elimination
- Global request logging and error monitoring basics
- Final full regression across all phases

### Pages / Routes
- Search suggestions dropdown on the search bar
- "Related products" and "Trending" sections on the product page
- No new top-level pages required

### Backend
- Search suggestion endpoint (prefix/fuzzy match on normalized product names)
- Recommendation endpoint (related + trending)
- Cache middleware for hot endpoints
- Security middleware: helmet (or equivalent), global rate limiting, stricter CORS
- Optional Redis connection for cache/queue (graceful fallback if unavailable)

### Database
- No new required collections; trending may use existing ActivityLog/ClickLog aggregation
- Verified and potentially additional indexes based on audit findings

### Business Logic
- Cache invalidated when product/listing data updates (post-sync)
- Recommendations exclude the current product; respect availability where sensible

### Integrations
- Redis (optional, per appidea.md "potential future infrastructure")

### Security & Permissions
- Full security pass: headers, rate limits, input sanitization, CORS lockdown, no sensitive data in logs
- Re-verify all role gates and ownership checks across every endpoint

### Edge Cases
- Redis unavailable → application degrades gracefully to uncached DB-backed behavior
- Search with no suggestions → dropdown hidden
- Cold-start trending (no click data yet) → sensible fallback or hidden section

### Completion Criteria (final — whole application)
1. Search suggestions and recommendations work on real data
2. Hot endpoints are cached; cache invalidates correctly after sync updates
3. Security headers and global rate limiting are active
4. Performance audit completed; no N+1 queries or missing indexes remain
5. **Full regression**: every completion criterion from Phases 1–6 re-verified and passing
6. The application is stable, coherent, and usable end to end as a production deployment

---

## Requirement Coverage Check (appidea.md → phase)

| appidea.md requirement | Phase |
|---|---|
| Core price comparison across Amazon/Flipkart/Myntra | P1 (models), P4 (UI) |
| Search / browse / filters / sort / pagination | P4 |
| Product detail with all comparison fields (name, brand, model, image, variant, color, size, specs, price, MRP, discount, availability, delivery, store, URL) | P1 (fields), P4 (display) |
| Buy Now / Go to Store redirect with affiliate link | P4 |
| **Automatic product discovery (periodic sync, new product detection, matching, price update, price history, searchable)** | **P3** |
| Central catalog + store listing separation (Product, Store, StoreListing, Price, PriceHistory) | P1 |
| Product matching with identifiers + name normalization | P1 (fields), P3 (engine) |
| Account creation, login/logout | P2 |
| Wishlist add/remove, saved products | P5 |
| Price alerts | P5 |
| Price history view | P3 (record), P4 (chart) |
| Profile management | P2 |
| Price-drop notifications | P5 (in-app) |
| Search suggestions | P7 |
| Product recommendations | P7 |
| Deals / coupons | **Ambiguous** — conditional on store feed data; not planned unless appidea.md's "if genuinely useful" criterion is met with real data; documented here, not silently dropped |
| Multiple product variants | P1 (fields), P4 (display) |
| Store availability | P3 (sync), P4 (display) |
| Background synchronization / job queues | P3 (scheduler), P7 (queue formalization) |
| Caching | P7 |
| Admin monitoring (products, listings, stores, categories, users, prices, matching, jobs, failures, data quality, updates, activity) | P3 (API), P6 (full UI) |
| User roles: guest, user, admin | P2 (auth), P4 (guest), P6 (admin) |
| Tech stack (React/Vite/Tailwind/Redux/Axios/Router, Node/Express, MongoDB/Mongoose, JWT) | P1, P2 |
| Redis / notifications infrastructure (future) | P5 (in-app notifications), P7 (optional Redis) |
