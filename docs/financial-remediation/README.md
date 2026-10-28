# Financial Remediation Readiness Pack

Status: **NOT READY — evidence and approvals pending**. Prepared 28 October 2026 (India time).

This pack records repository observations and the evidence required before financial implementation. It does not certify production, create staging, verify a backup, approve migrations, or authorize historical corrections. Unknown values are explicit nulls; source configuration is not runtime evidence. Do not fill unknowns with inferred production facts.

## Artifacts

1. `production-identity.json`: production identity and deployment evidence.
2. `database-schema.json`: actual schema, drift, migration baseline and collection specification.
3. `active-workers.json`: source-discovered processes/tasks, retry/lease behavior and runtime inventory gaps.
4. `backup-recovery.json`: backup coverage, protection, restore evidence, RTO/RPO and approver.
5. `staging-isolation.json`: isolation controls and evidence required for every integration.
6. `approval-register.json`: decisions, scope, evidence and explicitly permitted operations. No approval is implied by an empty approver or a draft record.
7. `source-snapshot.json`: local Git identity, dirty paths and SHA-256 observations for selected financial/build files and migration files; excludes secrets and financial records.
8. `evidence-collection.md`: controlled collection and recovery procedure; nothing in it has been executed against production.
9. `implementation-sequence.md`: concrete remediation and acceptance sequence after readiness approval.

The pack itself is tracked in Git. Source evidence is tied to the captured source hashes, not merely HEAD, because the working tree contains existing changes. Pack-only edits do not approve or change application behavior. Never push to `main` as part of evidence collection: existing push workflows can deploy and mutate schema.

## Evidence convention

Each external evidence reference must include an access-controlled URI, SHA-256 or immutable version, capture time with timezone, environment, collector, reviewer and redaction description. Store no secrets, raw customer/payment payloads, passwords, private keys, access tokens, signed URLs or database dumps in this repository. Reference encrypted evidence in the approved restricted store. Reference secret identifiers/versions only, never values.

Use `REPOSITORY_OBSERVED` for inspected configuration; `UNVERIFIED` for runtime facts; `VERIFIED` only with reviewed evidence. Approval decisions are `PENDING`, `APPROVED`, `REJECTED`, or `REVOKED`. An approval applies only to its exact baseline, environment and listed operations. Changed hashes, images, schema or scope require reevaluation and a new decision; preserve earlier decisions.

## Release gate

Implementation remains gated until every required external field/evidence item is verified, an independent restore test succeeds, staging isolation is demonstrated, and an authorized human records an APPROVED decision for the exact implementation scope and baseline. Missing evidence means NOT READY. This pack's JSON syntax checks are not operational verification.

Keep separate approvals for source implementation, additive schema migration, production deployment, historical corrections and irreversible actions. None is pre-approved here. Automatic payment-due reminders must remain disabled in source, staging and production. The original escalation attachment ended in section 12 at “Correct behavior”; its remainder is still an open scope item.

## Repository-observed hazards

- Two workflows deploy on push to main: AWS ECR/EC2 and VPS/PM2. Which is active in production is unverified.
- The AWS workflow contains a Prisma `db push` command with a data-loss acceptance option. Do not invoke it for this remediation. Source approval does not authorize running that command.
- Docker/package startup uses `dist/src/index.js`; PM2 config names `dist/index.js`. Resolve running entrypoints and artifact provenance.
- Server startup performs role/column DDL, User cleanup, pricing/location data changes, search setup, metrics timer and live Easebuzz sync. Importing the application is not a read-only inspection technique.
- Existing backup script prunes remote backups and lacks pipeline failure protection for pg_dump piped into gzip; a successful gzip/upload is insufficient proof of a valid database dump.
- Checkout and source files have been changing concurrently. The snapshot is a capture manifest, not a declaration that collaborators have frozen the baseline.

## Local validation

Parse every JSON file using the Python standard library and check referenced repository paths. Review the Git diff to ensure only this pack is staged. No application imports, service startup, migrations, database queries or notifications are needed to validate documentation. Record the local pack commit via `git log -- docs/financial-remediation`; no remote push is needed.

## Authorized local implementation exception

On 28 October 2026 the requesting user explicitly authorized local code, isolated tests and a push to a separate codex/ branch despite pending readiness. See `verification-containment.md` for this first code batch and its limitations. This exception does not approve production, real transactions, schema execution, historical corrections or runtime access. All operational evidence and independent approvals remain pending.
