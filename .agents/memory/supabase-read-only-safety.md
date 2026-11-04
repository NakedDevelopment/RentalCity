---
name: Supabase read-only safety
description: Enforcing read-only production investigations through the external Supabase connection.
---

Use an explicit read-only transaction for production investigations, and check the effective transaction mode before running the investigation.

**Why:** The external Supabase connection accepted a startup option requesting read-only mode, but the database reported that the effective transaction was writable. An explicit read-only transaction correctly enforced the restriction. Do not treat a successful connection as proof that startup options were applied through the pooler.

**How to apply:** Start the investigation with `BEGIN READ ONLY`, verify `current_setting('transaction_read_only')` is `on`, run only the authorized reads, and end the transaction with `ROLLBACK`. Do not rely solely on client connection options.
