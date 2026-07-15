---
name: MailerSend delivery pitfalls
description: Why outgoing emails silently fail and how support-ticket notifications are deduped/retried
---

**Rule:** All outgoing mail goes through `sendReportEmail` (best-effort, never throws). Two failure modes seen in production-like use: (1) `FROM_EMAIL` secret was accidentally set to a MailerSend token (`mlsn.…`) instead of an address — every send failed "invalid recipient"; (2) MailerSend trial daily API quota (#MS42901) returns 429 until upgraded. Check workflow logs for `MailerSend send failed` before assuming code bugs.

**Why:** Client bug report "support emails never arrive" (July 2026) was config, not code — messages were always safely stored in `support_requests`.

**How to apply:** Support notifications use claim-then-send on `support_requests.notified_at` (same pattern as landlord lifecycle emails) plus an hourly sweep that retries un-notified tickets and stops early on provider failure — so quota outages self-heal. Support inbox: `SUPPORT_EMAIL` (help@gorentalcity.com), sender `FROM_EMAIL` (noreply@gorentalcity.com; domain must stay verified in MailerSend). Never build email links from request Origin headers — use `lifecycleAppUrl()` (env-based).
