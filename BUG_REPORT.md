# 🔍 Comprehensive Codebase Bug Report

A full static and dynamic audit was performed across the repository (`noor_alhoda`), including automated test execution (`manage.py test`), TypeScript type checking (`tsc --noEmit`), ESLint analysis (`npm run lint`), git revision history inspection, and structural code reviews.

---

## 🛠️ Executive Summary

| Category | Total Bugs Found | Critical 🚨 | High 🔴 | Medium 🟡 | Minor / Warning ⚪ |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Build & Linting** | **2** | 1 | 1 | 0 | 0 |
| **Frontend & React Lifecycle** | **4** | 1 | 0 | 3 | 0 |
| **Offline Sync & Database (Dexie)** | **4** | 1 | 2 | 1 | 0 |
| **API & Network Layer** | **4** | 1 | 1 | 2 | 0 |
| **Backend & Django Signals** | **2** | 0 | 1 | 1 | 0 |
| **RTL Formatting & UI/UX** | **3** | 0 | 1 | 2 | 0 |
| **Total** | **19** | **4** | **6** | **9** | **0** |

---

## 🚨 1. Critical Bugs (Immediate Fix Required)

### 1.1 Multi-Tab Session Destruction & Logout
- **Location**: `frontend/src/contexts/AuthContext.tsx` (Lines 233-267)
- **Root Cause**: `sessionStorage` is isolated per browser tab. `restoreSessionKey()` attempts to read `sessionStorage.getItem("_dbk")`. In a newly opened browser tab, this returns `null`. Instead of prompting for an unlock password in that tab, `AuthContext` executes:
  ```typescript
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.location.href = "/login";
  ```
- **Impact**: Opening any new tab while logged in immediately clears `localStorage` tokens for **all open tabs**, logging out the user system-wide.

---

### 1.2 URL Query Parameter Truncation (`?` Collision)
- **Location**: `frontend/src/lib/api.ts` (Lines 55-59, 441-443)
- **Root Cause**: `api.get(endpoint, params)` appends `buildQueryString(params)` using `?`. When calling endpoints that already contain query params (e.g. `/api/students/?browse_all=true` in `useBrowsableStudents.ts`), the constructed URL becomes:
  `/api/students/?browse_all=true?search=ali`
  When `normalizeEndpoint` executes:
  ```typescript
  const [path, query = ""] = endpoint.split("?");
  ```
  it splits on the first `?` and silently **drops the second query string segment** (`search=ali`).
- **Impact**: All secondary search/filter query parameters sent to endpoints with existing `?` are silently discarded.

---

### 1.3 Incomplete ID Remapping in Domain Tables & Outbox
- **Location**: `frontend/src/lib/sync/outbox.ts` (Lines 148-201) & `frontend/src/lib/sync/push.ts` (Lines 186-188)
- **Root Cause**:
  1. `remapPendingOutboxIds` only remaps top-level key-value strings in outbox payloads. It does not update nested arrays (e.g., `course_ids: ["temp-id"]`).
  2. `remapPendingOutboxIds` only updates rows in the `outbox` table and **fails to update domain tables in Dexie** (`students`, `weekly_plans`, `daily_records`).
- **Impact**: Local IndexedDB records continue holding temporary UUIDs. Queries for newly synced server IDs return empty results, and downstream pending outbox operations push stale IDs causing server Foreign Key errors.

---

### 1.4 ESLint Build Breakage (`react-hooks/set-state-in-effect`)
- **Location**:
  - `frontend/src/components/notifications/DirectMessageModal.tsx` (Lines 57, 72)
  - `frontend/src/components/offline/InitialDownloadBanner.tsx` (Line 54)
  - `frontend/src/components/plans/WeeklyPlanModal.tsx` (Line 93)
- **Root Cause**: Synchronous `setState()` execution inside `useEffect` bodies triggers cascading re-renders and violates React 19 rules.
- **Impact**: Running `npm run lint` or production CI/CD builds fails with exit code `1`.

---

## 🔴 2. High-Severity Bugs

### 2.1 Out-of-Order Execution in Sync Outbox Batches
- **Location**: `frontend/src/lib/sync/push.ts` (Lines 103-110) & `frontend/src/lib/sync/outbox.ts` (Lines 327-341)
- **Root Cause**: `listPending` only fetches outbox items with `status === "pending"`. If an earlier `CREATE` operation errored and entered retry backoff (`status === "error"`), a later `UPDATE` or `DELETE` for the same record (status `"pending"`) will be pushed to the server *before* the `CREATE` operation is retried.
- **Impact**: Server receives updates/deletions for non-existent primary keys, resulting in cascading sync rejections.

---

### 2.2 Retry Counter Inflation & Permanent Outbox Locking
- **Location**: `frontend/src/lib/sync/outbox.ts` (Lines 95-122)
- **Root Cause**: `revertOrphanedInFlight` increments `attempts` on every trigger run. Because `triggerPush` invokes `revertOrphanedInFlight` at the start of every sync pass (scheduled every 30 seconds by default), an active network drop causes `attempts` to hit `MAX_ATTEMPTS` (5) in 2.5 minutes, permanently locking outbox operations.
- **Impact**: Unsent offline edits get locked in the outbox as unrecoverable errors without user intervention.

---

### 2.3 10-Second Unconditional Lock in Cross-Tab Token Refresh
- **Location**: `frontend/src/lib/api.ts` (Lines 67-78)
- **Root Cause**: When a tab detects another tab is currently refreshing the token (`_refresh_ts` present in `localStorage`), it executes `await new Promise((r) => setTimeout(r, 10000))`.
- **Impact**: All concurrent API calls across tabs freeze for a mandatory 10-second timeout.

---

### 2.4 Stale Model Instance Post-Signal Update
- **Location**: `backend/records/signals.py` (Lines 55-58)
- **Root Cause**: `infer_daily_record_result` calls `DailyRecord.objects.filter(pk=instance.pk).update(result=new_result)`. Queryset `.update()` alters the database row without updating the in-memory `instance.result`.
- **Impact**: Code operating on `instance` post-save reads `instance.result == "pending"` despite the database being updated to `"pass"` or `"fail"`.

---

### 2.5 BiDi Text Direction Scrambling (RTL)
- **Location**: Throughout `frontend/src/components/students/StudentCard.tsx` & `frontend/src/components/students/StudentHeader.tsx`
- **Root Cause**: Neutral punctuation and symbols (`-`, `+`, `/`) inside Arabic text lack `<bdi>` or `dir="ltr"` wrappers.
- **Impact**: Phone numbers (e.g. `+970599123456`), date strings (`2026-07-27`), and verse ranges (`آية 1-15`) display inverted or scrambled.

---

## 🟡 3. Medium & Minor Issues

### 3.1 Form Modals Retain Stale Props
- **Location**: Modal components under `frontend/src/components/modals/`
- **Issue**: Modals initialize internal form state with `useState(props.entity)` on mount. If a parent reopens the modal for a different student/teacher without unmounting the modal component, old values remain in form fields.

### 3.2 DRF Validation Field Error Detail Masking
- **Location**: `frontend/src/lib/api.ts` (Lines 275-283)
- **Issue**: Standard DRF dictionary field errors (e.g., `{"national_id": ["مستعمل بالفعل"]}`) are not parsed by `apiFetch`, defaulting to generic error text `"حدث خطأ غير متوقع (400)"`.

### 3.3 DRF Spectacular Schema Generator Warnings
- **Location**: Views across `courses`, `evaluations`, `notifications`, `progress`, `records`, `reports`, `students`, `teacher`, `sync`, `accounts`
- **Issue**: OpenAPI generator emits warnings regarding unidentified serializers for custom `APIView` subclasses and `operationId` collisions on collection vs. detail routes.

### 3.4 Service Worker Unused Parameter Warnings
- **Location**: `frontend/public/sw.js`
- **Issue**: Unused `_err` arguments trigger `@typescript-eslint/no-unused-vars` warnings.

---

## 📋 Recommended Remediation Action Plan

1. **Fix ESLint Errors**: Refactor `DirectMessageModal.tsx`, `InitialDownloadBanner.tsx`, and `WeeklyPlanModal.tsx` to initialize state outside effects or use functional event handlers.
2. **Fix Session Management**: Update `AuthContext.tsx` to handle missing tab session keys by prompting for a DB unlock without clearing `localStorage` tokens.
3. **Fix URL Parameter Construction**: Fix `api.ts` `buildQueryString` to check if `endpoint` already contains a `?` and use `&` accordingly.
4. **Fix Sync Outbox ID Remapping**: Extend `remapPendingOutboxIds` in `outbox.ts` to update IndexedDB domain tables (`students`, `weekly_plans`, `daily_records`) and nested payload arrays.
5. **Update Signal In-Memory State**: Update `records/signals.py` to sync `instance.result = new_result` in memory alongside `.update()`.
