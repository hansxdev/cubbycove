# Appwrite Database Schema (Current)

This document reflects the current Appwrite schema used by the website code.

## Project: CubbyCove

## 1. Database
- Database ID: use the `DB_ID` configured in `js/appwrite_config.js`.

## 2. Collections

### `users`
Profile records for parents and staff.

| Attribute | Type | Required | Notes |
| --- | --- | --- | --- |
| `role` | String | Yes | `super_admin`, `admin`, `assistant`, `creator`, `parent`, `kid` (kid role used in session flow) |
| `status` | String | Yes | Common values: `pending`, `active`, `banned`, `suspended` |
| `firstName` | String | Yes |  |
| `middleName` | String | No |  |
| `lastName` | String | Yes |  |
| `email` | String | Yes | Queried frequently |
| `faceId` | String | No | Face data/file id depending on flow |
| `idDocumentId` | String | No | Appwrite Storage file id |
| `createdAt` | String (ISO datetime) | No | Used for sorting |

### `children`
Child profiles linked to a parent.

| Attribute | Type | Required | Notes |
| --- | --- | --- | --- |
| `parentId` | String | Yes | Links to `users.$id` |
| `name` | String | Yes | Display name |
| `username` | String | Yes | Used for child login lookup |
| `password` | String | Yes | Current implementation stores plain password |
| `isOnline` | Boolean | No | Default `false` |
| `threatScore` | Integer | No | Default `0` |
| `kidId` | String | No | Buddy lookup id |

### `videos`
Creator/admin video library records.

| Attribute | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | String | Yes |  |
| `url` | String | Yes | YouTube URL or ID |
| `category` | String | Yes |  |
| `creatorEmail` | String | Yes | Used in creator dashboard filter |
| `status` | String | Yes | `pending`, `approved`, `rejected` |
| `views` | Integer | No | Default `0` |
| `uploadedAt` | String (ISO datetime) | No | Used for sorting |

### `threat_logs`
Threat moderation records.

| Attribute | Type | Required | Notes |
| --- | --- | --- | --- |
| `childId` | String | Yes |  |
| `content` | String | Yes | Threat content payload |
| `timestamp` | String (ISO datetime) | Yes | Used by threat log list sorting |
| `status` | String | Yes | Updated by moderation flow |
| `resolution` | String | No | Moderator/parent note |
| `resolved` | Boolean | No | Legacy field still safe to keep |

### `login_requests`
Kid-to-parent approval login flow.

| Attribute | Type | Required | Notes |
| --- | --- | --- | --- |
| `childUsername` | String | Yes |  |
| `parentEmail` | String | Yes | Queried by parent |
| `status` | String | Yes | `pending`, `approved`, `denied` |
| `requestedAt` | String (ISO datetime) | Yes |  |
| `deviceInfo` | String | No | Device/user-agent snippet |
| `expiresAt` | String (ISO datetime) | No | Request expiry |
| `childName` | String | No | Filled on approval |
| `childId` | String | No | Filled on approval |
| `parentId` | String | No | Filled on approval |

### `buddies`
Buddy requests and accepted buddy links.

| Attribute | Type | Required | Notes |
| --- | --- | --- | --- |
| `fromChildId` | String | Yes |  |
| `toChildId` | String | Yes |  |
| `fromUsername` | String | Yes |  |
| `toUsername` | String | Yes |  |
| `fromKidId` | String | No |  |
| `toKidId` | String | No |  |
| `status` | String | Yes | `pending`, `accepted`, `declined` |
| `createdAt` | String (ISO datetime) | Yes |  |
| `updatedAt` | String (ISO datetime) | No |  |

### `parent_notifications`
Parent notification feed for buddy events.

| Attribute | Type | Required | Notes |
| --- | --- | --- | --- |
| `parentId` | String | Yes | Queried by parent |
| `type` | String | Yes | `buddy_request`, `buddy_accepted`, etc. |
| `message` | String | Yes |  |
| `childId` | String | No |  |
| `buddyId` | String | No |  |
| `isRead` | Boolean | No | Default `false` |
| `createdAt` | String (ISO datetime) | Yes | Used for sorting |

## 3. Recommended Indexes

### `users`
- `idx_email` on `email`
- `idx_role` on `role`
- `idx_createdAt` on `createdAt`

### `children`
- `idx_username` on `username`
- `idx_parentId` on `parentId`
- `idx_kidId` on `kidId`

### `videos`
- `idx_creatorEmail` on `creatorEmail`
- `idx_status` on `status`
- `idx_uploadedAt` on `uploadedAt`

### `threat_logs`
- `idx_timestamp` on `timestamp`
- `idx_status` on `status`
- `idx_childId` on `childId`

### `login_requests`
- `idx_parentEmail` on `parentEmail`
- `idx_status` on `status`
- `idx_requestedAt` on `requestedAt`

### `buddies`
- `idx_fromChildId` on `fromChildId`
- `idx_toChildId` on `toChildId`
- `idx_status` on `status`
- `idx_createdAt` on `createdAt`

### `parent_notifications`
- `idx_parentId` on `parentId`
- `idx_isRead` on `isRead`
- `idx_createdAt` on `createdAt`

## 4. Storage

### Bucket: `parent_docs`
Used for parent verification uploads (ID document and selfie/face files).

## 5. Notes
- `access_logs` exists in config constants but is not actively used by current app logic.
- The old schema fields like `children[]`, `avatar`, `allowChat`, `allowGames`, and JSON activity arrays are not used by current Appwrite-backed flows.
