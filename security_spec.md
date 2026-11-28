# KLIK Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **NIM-Bound Firebase Auth Identity**: Every user profile (`/users/{userId}`) must correspond to an authenticated Firebase Auth account (`request.auth.uid == userId`) whose internal auth email strictly matches `<nim_lowercase>@klik.internal`. Passwords are never stored in Firestore.
2. **Controlled Student Provisioning (No Free Sign-Up)**: A student cannot self-join any class using an arbitrary NIM. They must exist in `/classes/{classId}/roster/{nimKey}` (provisioned by a verified `admin`/Komting with `status == 'pending'`) and submit an atomic `/classes/{classId}/activationClaims/{nimKey}` whose SHA-256 `codeHash` matches `roster/{nimKey}.activationCodeHash`.
3. **Immutable Role & Status Enforcement**: New member role and name are forced to match `roster/{nimKey}` (or `'admin'` strictly for the creator of a brand-new class via `existsAfter` / `getAfter` atomic check). Students can never self-assign or escalate `role` or `status`.
4. **Master Gate Class Scoping & Revocation**: Every subcollection under `/classes/{classId}/...` requires an active membership document in `/classes/{classId}/members/$(request.auth.uid)` with `status == 'active'`. Disabling a member immediately revokes all Firestore access.
5. **PII & Roster Isolation**: User profile emails reside in `/users/{userId}` (owner-only). Class roster entries with activation hashes (`/classes/{classId}/roster/{nimKey}`) are strictly readable and listable only by `isClassAdmin(classId)`.
6. **Admin-Only Class Management**: Schedules, schedule exceptions, courses, course collection links, individual tasks, group activities, external group members, group tasks, roster entries, and announcements can only be managed by a verified `admin` (`Komting`) of that class.
7. **Personal Completion & Note Isolation**: `/classes/{classId}/taskCompletions/{completionId}` can only be read and written by the owner (`userId == request.auth.uid`).
8. **Group Finalization & Membership Integrity**: Students may only enroll or remove themselves (`isExternal == false && userId == request.auth.uid`) in a group where `isFinal == false`. Once `isFinal == true`, membership changes are rejected.
9. **Group Task Checklist Scoping**: Only members of `groupId` or a class `admin` may toggle `/classes/{classId}/groupTaskCompletions/{groupTaskId}_{groupId}`.
10. **Strict Server Timestamps**: Creation and update timestamps are validated against `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

All 12 payloads below MUST evaluate to `PERMISSION_DENIED`:

1. **Unauthenticated Read**: `GET /classes/cls-1/schedules/sch-1` with `request.auth == null`.
2. **Arbitrary Unprovisioned NIM Activation**: `CREATE /classes/cls-1/members/{uid}` for a NIM that does not exist in `/classes/cls-1/roster/{nimKey}`.
3. **Invalid Activation Code**: `CREATE /classes/cls-1/activationClaims/{nimKey}` with a `codeHash` not matching `roster/{nimKey}.activationCodeHash`.
4. **Self-Assigned Admin Escalation**: `CREATE /classes/cls-1/members/{uid}` by a provisioned `mahasiswa` attempting `"role": "admin"`.
5. **Role or Status Tampering Update**: `UPDATE /classes/cls-1/members/{uid}` by a student attempting `{ "role": "admin" }` or `{ "status": "active" }` when disabled.
6. **Disabled Account Read**: `GET /classes/cls-1/schedules/sch-1` when `members/{uid}.status == "disabled"`.
7. **Roster Scraping by Student**: `LIST /classes/cls-1/roster` by a non-admin `mahasiswa`.
8. **PII Cross-Read**: `GET /users/{otherUid}` by another signed-in student.
9. **Shadow Ghost Field Injection**: `CREATE /classes/cls-1/individualTasks/{taskId}` by admin with extra `"isVerified": true` field not in `hasOnly(...)`.
10. **Joining a Finalized Group**: `CREATE /classes/cls-1/groupMembers/{groupId}_{uid}` when `groups/{groupId}.isFinal == true`.
11. **Unrelated Student Checking Another Group's Task**: `WRITE /classes/cls-1/groupTaskCompletions/{gtId}_{group1Id}` by a student not in `group1Id`.
12. **Reading Another Student's Notifications / Task Notes**: `LIST /classes/cls-1/notifications` without `userId == request.auth.uid` filter.

