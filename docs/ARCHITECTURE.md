# Noor Al-Huda Architecture

This document separates the high-level component architecture from the offline-sync data flow. Keeping them separate avoids a single diagram with crossed lines while still documenting the important consistency and security boundaries.

## 1. System architecture

~~~mermaid
flowchart TB
    U[Center users]

    subgraph CLIENT[Next.js PWA]
        UI[Role-based screens]
        AUTH[Auth / session context]
        QUERY[Query dispatcher]
        MUT[Mutation dispatcher]
        LOCAL[(Encrypted Dexie / IndexedDB)]
        OUTBOX[(Persistent outbox)]
        RUNNER[Sync runner]

        U --> UI
        UI --> QUERY --> LOCAL
        UI --> MUT
        MUT -->|atomic local transaction| LOCAL
        MUT -->|same transaction| OUTBOX
        OUTBOX --> RUNNER
        AUTH --> RUNNER
        RUNNER -->|pull results| LOCAL
    end

    subgraph SERVER[Django + DRF]
        VIEWS[API views + validation]
        AUTHZ[JWT authentication + authorization]
        SELECTORS[Selectors<br/>read visibility + row-level RBAC]
        SERVICES[Domain services<br/>write invariants + RBAC]
        ORM[Models / Django ORM]

        VIEWS --> AUTHZ
        AUTHZ --> SELECTORS
        AUTHZ --> SERVICES
        SELECTORS --> ORM
        SERVICES --> ORM
    end

    RUNNER -->|HTTPS + JWT<br/>push / pull| VIEWS
    AUTH -->|login / refresh| VIEWS
    ORM --> PG[(PostgreSQL<br/>authoritative system of record)]
~~~

### Authority model

- PostgreSQL is the authoritative server/system-of-record state shared across devices and users.
- Dexie is the device-local operational store used by offline-capable UI and the durable offline replica.
- A local optimistic edit is tentative until the server confirms it. Push conflicts replace/reconcile the local copy with server authority.
- Frontend role-based screens are UX controls only; backend selectors/services enforce authorization and row-level scope.

## 2. Offline mutation and sync flow

~~~mermaid
flowchart TB
    ACTION[User mutation]
    TX[IndexedDB transaction]
    WRITE[Optimistic local row write]
    QUEUE[Encrypted outbox row]
    PUSH[Push batch]
    IDEMP[IdempotencyKey replay protection]
    CHECK[RBAC + validation + LWW check]
    DOMAIN[Existing domain service]
    PG[(PostgreSQL)]
    RESPONSE[Per-op result]
    APPLY[Apply confirmed row / conflict resolution]
    PULL[Pull since cursor]
    DELTA[Visible deltas + tombstones]
    LOCAL[(Dexie)]

    ACTION --> TX
    TX --> WRITE
    TX --> QUEUE
    WRITE --> LOCAL
    QUEUE --> PUSH
    PUSH --> IDEMP --> CHECK --> DOMAIN --> PG
    PG --> RESPONSE --> APPLY --> LOCAL
    PG --> PULL --> DELTA --> LOCAL
~~~

### Consistency guarantees

- **Atomic local intent:** the optimistic domain write and its outbox operation commit together. If encryption, quota, or IndexedDB work fails, the transaction rolls back instead of leaving an unsyncable local edit.
- **Safe retries:** outbox operations use bounded retry/backoff. The server caches successful/conflict results by client operation UUID so replay after a crash does not duplicate writes.
- **Conflict policy:** updates carry the last server-confirmed updated_at as base_updated_at. Server-side LWW checks detect a newer authoritative row; the client applies the returned server row on conflict.
- **Pull cursor:** the client stores the server watermark. The server subtracts a small configured overlap from the next cursor so a row committed near the snapshot boundary is re-shipped rather than skipped.
- **Deletes:** hard deletes create tombstones in the same server transaction so offline clients can remove stale local rows on their next pull.
- **Scope changes:** pull logic backfills newly visible relationships and explicitly handles records that leave a teacher's scope so stale membership does not persist offline.

## 3. Network-only surfaces

Not every screen is forced into the offline pipeline. Live review/admin queues, selected imports/exports, file uploads, and other intentionally online-only operations may use the API directly. Those paths still rely on backend authentication, authorization, validation, and domain invariants.

## 4. Implementation map

| Concern | Primary implementation |
| --- | --- |
| Local schema and sync metadata | frontend/src/lib/db/schema.ts |
| Query dispatcher | frontend/src/hooks/queries.ts |
| Mutation dispatcher | frontend/src/hooks/mutations.ts |
| Persistent outbox + retry state | frontend/src/lib/sync/outbox.ts |
| Push client / conflict application | frontend/src/lib/sync/push.ts |
| Pull client / cursor application | frontend/src/lib/sync/pull.ts |
| Sync scheduling | frontend/src/lib/sync/runner.ts |
| Push endpoint | backend/sync/views/push_views.py |
| Pull endpoint | backend/sync/views/pull_views.py |
| Push orchestration / idempotency / conflict checks | backend/sync/services/push_services.py |
| Pull visibility / delta assembly | backend/sync/services/pull_services.py |
| Shared permission classes | backend/core/permissions.py |
| Server authority | PostgreSQL via Django ORM |

## 5. Design rule

Do not bypass the domain service layer from sync push handlers for writes. Sync is a transport/replay mechanism, not a second implementation of business rules. Reads must compose the existing visibility selectors rather than duplicating role logic.