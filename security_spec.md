# Workout Vault Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **User Profile PII Isolation**: A `users/{userId}` document may only be read (`get`), created, or updated by the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`). Blanket `list` on `/users` is forbidden.
2. **Owner-Scoped Subcollections**: Every document inside `/users/{userId}/plans/{dayId}`, `/users/{userId}/logs/{logId}`, and `/users/{userId}/customExercises/{exerciseId}` must carry `userId == request.auth.uid` and only be readable/writable by the verified owner of `{userId}`.
3. **Immutable Ownership & Creation Timestamps**: `uid` / `userId` and `createdAt` cannot be modified after creation. Server timestamps (`request.time`) are enforced on `createdAt` and `updatedAt`.
4. **Strict Schema & Bounds**: Unknown shadow fields are rejected via `keys().hasOnly(...)`, document IDs must match `^[a-zA-Z0-9_\-]+$` (<= 128 chars), and all strings/arrays have explicit upper bounds.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Shadow Field Injection on Profile**: `{ "uid": "u1", "displayName": "Alex", ..., "isAdmin": true }` -> `PERMISSION_DENIED` (`hasOnly` rejects `isAdmin`).
2. **Cross-User Profile Read**: User `u2` reads `/users/u1` -> `PERMISSION_DENIED`.
3. **Directory Enumeration (`list` on `/users`)**: Authenticated user queries `collection(db, 'users')` -> `PERMISSION_DENIED`.
4. **Unverified Email Spoof**: Request with `email_verified: false` attempts write -> `PERMISSION_DENIED`.
5. **Identity Spoofing on Plan**: User `u2` creates `/users/u1/plans/monday` or sets `userId: "u1"` in `/users/u2/plans/monday` -> `PERMISSION_DENIED`.
6. **Invalid Weekday ID on Plan**: User writes `/users/u1/plans/funday` -> `PERMISSION_DENIED` (`dayId in ['monday',...,'sunday']`).
7. **ID Poisoning**: Document ID with 200+ characters or `../` path traversal chars -> `PERMISSION_DENIED` (`isValidId`).
8. **Resource Exhaustion (1MB String)**: `notes` field in `CustomExercise` exceeding 1000 chars -> `PERMISSION_DENIED`.
9. **Unbounded Array Injection**: `exercises` list in `DayPlan` containing > 25 entries -> `PERMISSION_DENIED`.
10. **Client-Forged Timestamp**: `createdAt` set to backdated timestamp instead of `request.time` -> `PERMISSION_DENIED`.
11. **Immutable Owner Mutation**: Update on `UserProfile` attempting to change `uid` or `createdAt` -> `PERMISSION_DENIED` (`affectedKeys().hasOnly(...)` + equality check).
12. **Type Poisoning on Numeric Field**: `xp: "999999"` string instead of number on `UserProfile` -> `PERMISSION_DENIED`.
