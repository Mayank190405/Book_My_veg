# Corrected backup validation process — design only

Execution status: NOT EXECUTED. No production access, restore target, recovery owner, approved evidence store or independent reviewer has been identified. Do not run the existing backup/prune script for this process. Changing production backup automation or restoring a database is outside documentation-only authorization.

## Separate acquisition, validation, retention and restore

1. Obtain named authorization for backup acquisition and isolated restoration, with source/target identities and allowed operations. Select a PostgreSQL-compatible tool version after actual engine evidence is collected.
2. Acquire backup without pruning or deleting existing artifacts. Prefer a PostgreSQL archive format suited to validation/restore; use protected temporary storage, restrictive permissions and approved encryption. Capture pg_dump exit status independently. If compression is piped, require pipeline failure propagation and validate each stage. Never infer dump success from gzip or upload success.
3. Capture timestamp/timezone, consistent snapshot/WAL boundary, engine/tool versions and complete coverage/exclusions. Include roles/grants/extensions and non-database dependencies through separately approved artifacts. pg_dump of one database does not prove whole-system recovery.
4. Hash final encrypted and plaintext artifacts as permitted by security policy; preserve immutable object version, encryption/key identifiers, retention/object-lock policy and download/checksum verification in restricted storage. Git contains sanitized references only. Compression/archive listing is a preliminary integrity check, not recovery proof.
5. Provision/confirm an explicitly approved isolated recovery target with production egress denied, separate credentials/storage/queues and no application workers or real messaging/gateway endpoints. A target name alone is not evidence of isolation.
6. Independent operator restores from the retained artifact, captures all exit statuses and error logs, and validates schema/migrations, constraints/indexes/triggers, referential integrity and financial coverage (orders/payments/wallet/audit/refunds/allocations where present). Compare approved source-snapshot aggregates and recovery invariants; store row-level evidence only in the restricted store. Do not start the production app as a validator because startup mutates schema/data and runs sync.
7. Measure elapsed recovery time to independently validated availability and actual recoverable point relative to the approved reference time. Record approved RTO/RPO targets separately from measured outcomes. A completed command or an archive listing is not an independent successful restore.
8. Named reviewer signs result PASS/FAIL with immutable evidence references, observed exceptions and explicit scope. Failures retain evidence and block readiness. Retention pruning is a separate authorized process after recovery verification, never part of evidence capture.

## Required recovery evidence

Backup source/time/coverage, tool version/exit status, checksums/object version, encryption/retention controls, isolated-target identity/isolation proof, authorized operator and independent reviewer, restore start/end/results, integrity comparisons, measured RTO/RPO, errors/exclusions, approval references and rollback/abort procedure. All remain pending until performed and independently reviewed.
