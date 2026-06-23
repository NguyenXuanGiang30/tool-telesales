# Security Specification

## Data Invariants
- A campaign must belong to the user making the request.
- Contacts must belong to the user.
- Call logs must belong to the user.
- FlowData must belong to the user.

## The "Dirty Dozen" Payloads
1. Create campaign with a different userId than request.auth.uid (SPOOFING).
2. Update campaign to switch userId to another user (OWNERSHIP THEFT).
3. Update campaign to a status other than running/paused/completed (INVALID STATUS).
4. Create contact in another user's path (PATH INJECTION).
5. Add huge array of tags to a contact (RESOURCE EXHAUSTION).
6. Blank reads on collections (UNAUTHORIZED LISTING).
7. Create call log with incorrect timestamp format/types (TYPE MISMATCH).
8. Delete another user's campaign (UNAUTHORIZED DELETE).
9. Update campaign without validation helper (LOGIC LEAK).
10. Update flow data missing mandatory fields (SCHEMA BYPASS).
11. Path ID poisoning - long string ID (ID POISONING).
12. Create a document without authentication (ANONYMOUS WRITE).
