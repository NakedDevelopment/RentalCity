---
name: Plaid IDV QA failures
description: How to handle known QA identity-verification failures caused by Plaid network-risk velocity
---

# Plaid IDV QA failures

For an authorized QA tester whose identity fields pass but Plaid fails the overall session because repeated attempts triggered Identity Verification Network Risk, manually override the failed Risk Check in the Plaid Dashboard.

**Why:** Creating additional Rental City accounts or requesting more retries increases the device/session velocity signals. The user confirmed that overriding the failed Risk Check changed the result successfully.

**How to apply:** Use Dashboard review and override only when the tester is known and authorized. Do not treat PII redaction or local-account deletion as a risk-history reset. Use Sandbox or a QA-specific template with suitable network-risk thresholds for repeated testing.