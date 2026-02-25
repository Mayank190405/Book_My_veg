
-- 1. Security Audit Log Function
CREATE OR REPLACE FUNCTION audit_critical_operation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "SecurityAuditLog" (
        "tableName",
        "attemptedOperation",
        "attemptedBy",
        "rawQuerySnippet",
        "severity"
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        current_setting('app.current_user_id', true),
        'Attempted mutation on immutable record.',
        'CRITICAL'
    );
    RAISE EXCEPTION 'SECURITY POLICY VIOLATION: TABLE % IS IMMUTABLE FOR % OPERATIONS.', TG_TABLE_NAME, TG_OP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Prevent Updates on Refund (Fully Immutable)
DROP TRIGGER IF EXISTS trg_refund_immutability ON "Refund";
CREATE TRIGGER trg_refund_immutability
BEFORE UPDATE OR DELETE ON "Refund"
FOR EACH ROW EXECUTE FUNCTION audit_critical_operation();

-- 3. Prevent Updates on InventoryLedger (Audit Trail Integrity)
DROP TRIGGER IF EXISTS trg_inventory_ledger_immutability ON "InventoryLedger";
CREATE TRIGGER trg_inventory_ledger_immutability
BEFORE UPDATE OR DELETE ON "InventoryLedger"
FOR EACH ROW EXECUTE FUNCTION audit_critical_operation();

-- 4. Conditional Immutability for CashierShift (Only block if CLOSED)
CREATE OR REPLACE FUNCTION protect_closed_shift()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'CLOSED' THEN
        INSERT INTO "SecurityAuditLog" (
            "tableName",
            "attemptedOperation",
            "attemptedBy",
            "rawQuerySnippet",
            "severity"
        ) VALUES (
            'CashierShift',
            TG_OP,
            current_setting('app.current_user_id', true),
            'Attempted to modify a CLOSED shift: ' || OLD.id,
            'CRITICAL'
        );
        RAISE EXCEPTION 'SECURITY POLICY VIOLATION: CLOSED SHIFT % CANNOT BE MODIFIED.', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_closed_shift ON "CashierShift";
CREATE TRIGGER trg_protect_closed_shift
BEFORE UPDATE OR DELETE ON "CashierShift"
FOR EACH ROW EXECUTE FUNCTION protect_closed_shift();

-- 5. Force specific transaction tracing (Example for JournalEntry)
-- In a real financial app, we'd also protect JournalEntry.
DROP TRIGGER IF EXISTS trg_journal_immutability ON "JournalEntry";
CREATE TRIGGER trg_journal_immutability
BEFORE UPDATE OR DELETE ON "JournalEntry"
FOR EACH ROW EXECUTE FUNCTION audit_critical_operation();
