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
