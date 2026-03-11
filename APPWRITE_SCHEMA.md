# Appwrite Database Schema Template

This document serves as the single source of truth for the Appwrite database structure. It has been updated to reflect the active variables used in the codebase (currently persisting to `localStorage` via `DataService.js`) and the frontend forms.

## Project: CubbyCove

### 1. Authentication (Appwrite Auth)
All users (Parents, Staff) will use Appwrite Authentication.
- **Provider**: Email/Password
- **Additional**: FaceID (Custom auth flow logic stored in `Users` collection)

---

### 2. Database: `CubbyCoveDB`

#### Collection: `Users` (Profile Data)
Stores additional user information linked to the Appwrite Auth Account.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `role` | String | Yes | Enum: `super_admin`, `admin`, `assistant`, `creator`, `parent`. |
| `status` | String | Yes | Enum: `pending`, `active`, `suspended`. Default: `pending` on registration. |
| `firstName` | String | Yes | User's first name. |
| `middleName` | String | No | User's middle name. |
| `lastName` | String | Yes | User's last name. |
| `email` | String | Yes | User's email address. |
| `faceId` | String | No | Appwrite Storage file ID of the face selfie captured during registration. |
| `idDocumentId` | String | No | Appwrite Storage file ID of the uploaded government ID document. |
| `children` | String[] | No | Array of Child IDs linked to this parent. |
| `createdAt` | Datetime | Yes | Account creation timestamp. |

#### Collection: `Children`
Stores profiles of children registered by parents.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `parentId` | String | Yes | Relationship: `Users` collection (The parent). |
| `name` | String | Yes | Child's Display Name. |
| `username` | String | Yes | Unique username for child login. |
| `password` | String | Yes | Simple password for child login. |
| `avatar` | String | Yes | Avatar seed string. |
| `allowChat` | Boolean | Yes | Permission setting. |
| `allowGames` | Boolean | Yes | Permission setting. |
| `isOnline` | Boolean | Yes | Real-time status. Default: `false`. |
| `threatsDetected` | Integer | Yes | Counter for harmful messages/interactions. Default: `0`. |
| `screenTimeLogs` | JSON | No | Logs screen time. Format: `[{ "date": "2023-10-27", "minutes": 45 }]` |
| `activityLogs` | JSON | No | History of actions. Format: `[{ "action": "Played Math Game", "timestamp": "...", "link": "/games/math" }]` |
| `status` | String | Yes | Enum: `active`, `inactive`. |

#### Collection: `Videos` (Content Library)
Stores video content metadata, approval status, and creator details.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | String | Yes | Video Title. |
| `url` | String | Yes | YouTube URL or ID. |
| `category` | String | Yes | Enum: `Learning`, `Gaming`, `Music`, `Cartoons`, `Vlog`. |
| `creatorEmail` | String | Yes | Email of the creator who uploaded it. |
| `status` | String | Yes | Enum: `pending`, `approved`, `rejected`. Default: `pending`. |
| `views` | Integer | Yes | View count. Default: `0`. |
| `uploadedAt` | Datetime | Yes | Timestamp of submission. |

#### Collection: `ThreatLogs` (New)
Detailed logs of detected threats for review.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `childId` | String | Yes | The child involved. |
| `content` | String | Yes | The blocked message or action. |
| `timestamp` | Datetime | Yes | Time of detection. |
| `resolved` | Boolean | Yes | Whether parent reviewed it. |

#### Collection: `AccessLogs`
Logs for check-in/check-out events.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `userId` | String | Yes | Who performed the action. |
| `childId` | String | Only if Check-In | The child being dropped off/picked up. |
| `action` | String | Yes | Enum: `check_in`, `check_out`, `visit`. |
| `timestamp` | Datetime | Yes | Time of event. |

---

### 3. Storage Buckets

#### Bucket: `parent_docs`
Stores uploaded images from the parent registration flow.

| Setting | Value |
| :--- | :--- |
| **Bucket ID** | `parent_docs` (set as `BUCKET_PARENT_DOCS` in `appwrite_config.js`) |
| **Allowed File Types** | `image/jpeg`, `image/png`, `image/webp` |
| **Max File Size** | 5 MB |
| **Permissions** | `create`: `any` (so unlogged-in registrants can upload); `read`: `users` (so logged-in staff can view) |

> ⚠️ **Required Setup**: You must create this bucket in your Appwrite Console → Storage → Create Bucket.
> Use the bucket ID `parent_docs` (or update the `BUCKET_PARENT_DOCS` constant in `appwrite_config.js` to match).

### 4. Logic & Functions
- `onUserCreate`: Trigger to create a `Users` document.
- `monitorScreenTime`: Scheduled function to aggregate daily logs (Future).

---

### 5. Additional Collections (Added via setup scripts)

#### Collection: `buddies`
Tracks friend relationships and pending requests between children.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `fromChildId` | String | Yes | Child who sent the request. |
| `toChildId` | String | Yes | Child who received the request. |
| `fromUsername` | String | Yes | Sender's display username. |
| `toUsername` | String | Yes | Receiver's display username. |
| `fromKidId` | String | No | Sender's short `#XXXXXX` ID. |
| `toKidId` | String | No | Receiver's short `#XXXXXX` ID. |
| `status` | String | Yes | Enum: `pending`, `accepted`, `declined`. |
| `createdAt` | String | Yes | ISO timestamp. |
| `updatedAt` | String | No | ISO timestamp of last status change. |

#### Collection: `parent_notifications`
Real-time notifications delivered to parents about buddy and chat events.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `parentId` | String | Yes | The parent to notify (`users.$id`). |
| `type` | String | Yes | Enum: `buddy_request` (someone wants to add child), `buddy_added` (child initiated add), `buddy_accepted`. |
| `message` | String | Yes | Human-readable notification text. |
| `childId` | String | No | The child involved. |
| `buddyId` | String | No | The buddy child involved. |
| `isRead` | Boolean | No | Default `false`. Shown as blue dot until dismissed. |
| `createdAt` | String | Yes | ISO timestamp. |

#### Collection: `chat_messages`
Stores chat messages between buddies. Powered by Appwrite Realtime.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `conversationId` | String | Yes | Stable ID: `[childIdA, childIdB].sort().join('_')`. |
| `fromChildId` | String | Yes | Sender's child document ID. |
| `fromUsername` | String | Yes | Sender's display name. |
| `text` | String | Yes | Message content (max 1000 chars). |
| `sentAt` | String | Yes | ISO timestamp. |

> **Setup**: Run `js/appwrite_add_chat.js` in your Appwrite Console F12 to create this collection.
> **Realtime**: Enable Realtime in your Appwrite project settings so `subscribeToChatMessages()` works live.

#### Collection: `kid_watch_history`
Tracks which videos each kid has watched and when.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `childId` | String | Yes | The child who watched. |
| `videoId` | String | Yes | The video document ID. |
| `videoTitle` | String | No | Cached video title for display. |
| `videoCategory` | String | No | Cached video category. |
| `videoUrl` | String | No | Cached video URL. |
| `thumbnailUrl` | String | No | Cached thumbnail URL. |
| `watchedAt` | String | Yes | ISO timestamp of when the video was opened. |

> **Permissions**: `create`: `any` (kids have no Appwrite auth session); `read`: `any`.

#### Collection: `kid_favorites`
Stores videos a kid has marked as favorite.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `childId` | String | Yes | The child who favorited. |
| `videoId` | String | Yes | The video document ID. |
| `videoTitle` | String | No | Cached video title. |
| `videoCategory` | String | No | Cached video category. |
| `videoUrl` | String | No | Cached video URL. |
| `thumbnailUrl` | String | No | Cached thumbnail URL. |
| `addedAt` | String | Yes | ISO timestamp. |

> **Permissions**: `create`: `any`; `read`: `any`; `delete`: `any`.

#### Videos Collection — New Attribute

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `thumbnailUrl` | String | No | Custom thumbnail URL uploaded by the creator. If empty, auto-generate from YouTube/video. |

