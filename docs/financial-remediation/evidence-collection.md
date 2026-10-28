# Evidence collection and recovery procedure — proposed, not executed

## Approval and preservation

An authorized environment owner must first approve read-only runtime/catalog evidence collection and identify access-controlled evidence storage. Production deployment, restart, settlement, sync, cleanup, refund, schema mutation and historical correction remain prohibited without their own explicit approvals. Do not start the app, run deploy workflows, run backup pruning, or import application modules during collection.

Preserve existing financial rows, audit logs, gateway events, job payloads and deployment logs. Reference restricted copies; do not commit their contents. Coordinate a baseline freeze with concurrent editors; capture file hashes before/after collection. Approve a baseline only when the relevant source files are stable and the build maps to that source.

## 1. Production identity

Owner captures environment/platform/service identifiers, running container image IDs and registry digests (or process artifact hashes), mapped Git SHA, CI run/build ID, deployment time and release owner. Capture every replica, gateway wrapper and worker. Inspect only allowlisted runtime fields; full container inspect/environment dumps can reveal credentials. Record both the source-to-build and build-to-running-instance evidence chains. Mutable tags such as v704/latest are observations, not immutable identities.

Check which main-push workflow actually targets production; neither workflow's existence proves it ran. Do not push this pack to main until deployment triggers and authorization have been handled through the normal release process.

## 2. Database schema

With a separately approved read-only role, collect PostgreSQL engine version, applied migration identifiers/checksums/status, tables/columns/enums/defaults, constraints, unique/nonunique indexes and trigger definitions. Read `_prisma_migrations` if present; absence must be recorded rather than inferred away. Use information_schema and pg_catalog queries in a read-only transaction. Do not use Prisma db push, migrate dev, migration application, or application startup to discover schema.

Compare actual schema to the captured Prisma schema, every migration checksum, manual schema scripts, and startup DDL. Report each missing/additional/different object and financial consequence. Inventory legacy Payment duplicates and wallet reference collisions with read-only aggregate queries under separate data-access approval. A shared gateway reference across different order allocations is not automatically a duplicate. Do not delete or add uniqueness to legacy rows during inventory.

Publish a redacted schema drift report and propose an additive migration baseline. A human database owner approves that baseline and later migration scope separately. Proposed new receipt/event tables can enforce their own identities after review; do not silently apply constraints to legacy Payment records.

## 3. Workers and schedules

Owner captures all running app/PM2/systemd/container processes, replica counts, host cron/system timers, Redis/Bull queue consumers/repeat jobs, CI/scheduler jobs and provider-dashboard synchronization/webhook registrations. Include commands/entrypoint artifact hashes with arguments sanitized. Record queue namespace, consumer concurrency, schedule timezone, retry/backoff, startup actions, lease owner/TTL and overlap behavior. Include disabled jobs with independent runtime evidence that they are disabled.

Source-discovered tasks in active-workers.json are candidate coverage; host/provider jobs outside Git must be explicitly inventoried. A Bull job ID deduplicates enqueuing; it does not make financial posting idempotent. No source-discovered distributed lease was found for Easebuzz cron; runtime must establish whether another guard exists.

## 4. Backup and isolated recovery

Backup/recovery owner defines coverage: database schema, data, migrations, audit/event evidence, roles/permissions, extensions, binary/uploads/object storage, queues and provider evidence, with exclusions documented. Capture backup UTC timestamp, consistency method and transaction/WAL boundary where available, artifact checksum, encryption/key reference, retention/immutability and restricted restore access. Backups contain sensitive data and must never enter Git.

Propose a backup-only operation with checked pg_dump exit status and integrity verification; do not run the existing combined backup/prune script. Account for database/role grants and objects pg_dump of a single database does not preserve. Infrastructure owner selects and approves the tool/runtime-compatible backup format and restore procedure.

Perform the restore only in an approved isolated recovery environment with outbound access denied and all app workers disabled. Verify checksum and decryptability, then restore schema/data/extensions/permissions as required. Compare source and restored financial aggregate counts/invariants without exporting customer data; validate Payment/Order/Wallet/AuditLog coverage, referential integrity and migration state. Record failures and reruns. Restore success requires actual measured results, not command exit alone.

Measure RTO from authorized recovery start to validated availability; measure RPO from the latest recoverable committed transaction boundary to the agreed failure/reference time. Both targets require owner approval; do not invent acceptable durations. Preserve measured duration, recovery point and review evidence. This is a recovery rehearsal, not permission to overwrite production. Production recovery/cutover remains a separate approved procedure with incident owner, rollback/abort criteria and communications.

## 5. Staging isolation

Provision through the approved environment workflow only. Verify distinct database/roles, credential versions, Redis instances or strongly isolated namespaces, consumers, webhook registration URLs, payment merchant sandbox, messaging sink, storage namespace, search/index instance and every external integration. Confirm outbound allowlists deny production gateway, real WhatsApp recipients and production data services. Hostnames alone do not prove isolation.

Use synthetic or approved masked customers. Do not clone production secrets or live webhook subscriptions. Test that production credentials fail in staging and staging credentials cannot access production, without initiating live transactions. Run only explicitly approved sandbox events and messaging-sink tests after staging test approval. Record evidence per integration, not one global “staging=true”.

## 6. Approval and handoff

Each approver records identity/role, decision, scope, ISO timestamp with offset, environment, evidence references and permitted operations. The source implementation decision references exact source hashes, schema baseline and staging evidence. Record exclusions and expiration/revalidation triggers. Rejected/revoked/pending approvals cannot release execution. Gate owner signs the overall release of source implementation only when prerequisite evidence is complete. Production deployment and historical changes remain separate decisions.
