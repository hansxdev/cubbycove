# Appwrite Database Schema Template

This document serves as the single source of truth for the Appwrite database structure. It has been updated to reflect the active variables used in the codebase (currently persisting to `localStorage` via `DataService.js`) and the frontend forms.

## Project: CubbyCove

### 1. Authentication (Appwrite Auth)
All users (Parents, Staff) will use Appwrite Authentication.
- **Provider**: Email/Password
- **Additional**: FaceID (Custom auth flow logic stored in `Users` collection)

---

### 2. Database: `CubbyCoveDB`

> [!CAUTION]
> **Important Permissions Note for Kid Portal:**
> Since children log into the Kid Portal without a formal Appwrite Authentication session, any collections they need to read or write to **must** have `Any` permissions enabled in the Appwrite Console:
> - **`Videos`**: Requires `Any` Read permission so the kid portal can load videos.
> - **`Children`**: Requires `Any` Read permission so the login page can verify usernames.
> - **`kid_watch_history`**: Requires `Any` Read/Create/Update/Delete permissions.
- **`kid_favorites`**: Requires `Any` Read/Create/Update/Delete permissions.
- **`kid_rewards`**: Requires `Any` Read/Create permissions.
- **`kid_path_status`**: Requires `Any` Read/Create/Update permissions.
- **`paths`**: Requires `Any` Read permission.

#### Collection: `Users` (Profile Data)
Stores additional user information linked to the Appwrite Auth Account.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `role` | String (Size 50) | Yes | Enum: `super_admin`, `admin`, `assistant`, `creator`, `parent`. |
| `status` | String (Size 50) | Yes | Enum: `pending`, `active`, `suspended`. Default: `pending` on registration. |
| `firstName` | String (Size 100) | Yes | User's first name. |
| `middleName` | String (Size 100) | No | User's middle name. |
| `lastName` | String (Size 100) | Yes | User's last name. |
| `email` | String (Size 255) | Yes | User's email address. |
| `faceId` | String (Size 5000) | Yes | Appwrite Storage file ID of the face selfie captured during registration. |
| `idDocumentId` | Text (Size 65535) | No | Appwrite Storage file ID of the uploaded government ID document. |
| `children` | String[] | No | Array of Child IDs linked to this parent. |
| `createdAt` | String (Size 50) | No | Account creation timestamp. |
| `isPremium` | Boolean | No | Premium account status. Default `false`. |
| `staffId` | Text (Size 65535) | No | Legacy/alternative ID. |

#### Collection: `Children`
Stores profiles of children registered by parents.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `parentId` | String | Yes | Relationship: `Users` collection (The parent). |
| `name` | String | Yes | Child's Display Name. |
| `username` | String | Yes | Unique username for child login. |
| `password` | String (Size 100) | Yes | Simple password for child login. |
| `avatar` | String (Size 100) | No | Avatar seed string. |
| `allowChat` | Boolean | No | Permission setting. Default: `false`. |
| `allowGames` | Boolean | No | Permission setting. Default: `false`. |
| `isOnline` | Boolean | No | Real-time status. Default: `false`. |
| `threatScore` | Integer | No | Counter for harmful messages/interactions. Default: `0`. |
| `threatsDetected` | Integer | No | Legacy counter. Default: `0`. |
| `screenTimeLogs` | String (Size 65535) | No | Logs screen time. Format: `[{ "date": "2023-10-27", "minutes": 45 }]` |
| `activityLogs` | JSON | No | History of actions. Format: `[{ "action": "Played Math Game", "timestamp": "...", "link": "/games/math" }]` |
| `status` | String | Yes | Enum: `active`, `inactive`. |
| `totalPoints` | Integer | No | Total points earned via Watch-to-Earn. Default: `0`. |
| `kidId` | String (Size 10) | No | Public shareable ID like `#XXXXXX`. |
| `avatarImage` | String (Size 1000000) | No | Custom uploaded avatar image (Base64/URL). |
| `avatarBgColor` | String (Size 50) | No | Background color for custom avatar. |

#### Collection: `Videos` (Content Library)
Stores video content metadata, approval status, and creator details.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | String (Size 255) | Yes | Video Title. |
| `url` | String (Size 255) | Yes | YouTube URL or ID. |
| `category` | String (Size 100) | Yes | Enum: `Learning`, `Gaming`, `Music`, `Cartoons`, `Vlog`. |
| `creatorEmail` | String (Size 255) | Yes | Email of the creator who uploaded it. |
| `status` | String (Size 50) | Yes | Enum: `pending`, `approved`, `rejected`. Default: `pending`. |
| `views` | Integer | No | View count. Default: `0`. |
| `uploadedAt` | String (Size 50) | No | Timestamp of submission. |
| `likes` | Integer | No | Like count. Default: `0`. |
| `dislikes` | Integer | No | Dislike count. Default: `0`. |
| `subscriberGains` | Integer | No | Sub gains from this video. |
| `thumbnailUrl` | Text (Size 65535) | No | Custom thumbnail URL uploaded by the creator. |
| `duration` | Integer | No | Duration in seconds (for Watch-to-Earn logic). |
| `pointsValue` | Integer | No | Points awarded for completing this video. Default: `10`. |

#### Collection: `ThreatLogs` (New)
Detailed logs of detected threats for review.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `childId` | String (Size 50) | Yes | The child reported. |
| `content` | String (Size 5000) | Yes | The blocked message or action. |
| `timestamp` | String (Size 50) | No | Time of detection. |
| `resolved` | Boolean | No | Whether parent reviewed it. Default `false`. |
| `reason` | String (Size 255) | No | The reason for the report. |
| `reporterChildId` | String (Size 50) | No | Child ID of the reporter. |
| `reporterChildName` | String (Size 100) | No | Name of the reporter. |
| `reporterParentEmail` | String (Size 255) | No | Parent email of the reporter. |
| `reportedChildId` | String (Size 50) | No | Child ID of the reported user. |
| `reportedChildName` | String (Size 100) | No | Name of the reported user. |
| `reportedParentEmail` | String (Size 255) | No | Parent email of the reported user. |
| `messageContent` | String (Size 2000) | No | Full message context. |
| `violationType` | String (Size 100) | No | AI category of violation. |
| `status` | String (Size 50) | No | Resolution status: `pending`, `resolved`. |
| `resolution` | String (Size 100) | No | Status note. |
| `senderId` | String (Size 50) | No | Associated sender. |
| `receiverId` | String (Size 50) | No | Associated receiver. |

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
| `fromChildId` | String (Size 50) | Yes | Child who sent the request. |
| `toChildId` | String (Size 50) | Yes | Child who received the request. |
| `fromUsername` | String (Size 50) | Yes | Sender's display username. |
| `toUsername` | String (Size 50) | Yes | Receiver's display username. |
| `fromKidId` | String (Size 10) | No | Sender's short `#XXXXXX` ID. |
| `toKidId` | String (Size 10) | No | Receiver's short `#XXXXXX` ID. |
| `status` | String (Size 20) | Yes | Enum: `pending`, `accepted`, `declined`. |
| `createdAt` | String (Size 50) | Yes | ISO timestamp. |
| `updatedAt` | String (Size 50) | No | ISO timestamp of last status change. |

#### Collection: `parent_notifications`
Real-time notifications delivered to parents about buddy and chat events.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `parentId` | String (Size 50) | Yes | The parent to notify (`users.$id`). |
| `type` | String (Size 50) | Yes | Enum: `buddy_request` (someone wants to add child), `buddy_added` (child initiated add), `buddy_accepted`. |
| `message` | String (Size 500) | Yes | Human-readable notification text. |
| `childId` | String (Size 50) | No | The child involved. |
| `buddyId` | String (Size 50) | No | The buddy child involved. |
| `isRead` | Boolean | No | Default `false`. Shown as blue dot until dismissed. |
| `createdAt` | String (Size 50) | Yes | ISO timestamp. |

#### Collection: `chat_messages`
Stores chat messages between buddies. Powered by Appwrite Realtime.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `conversationId` | String (Size 120) | Yes | Stable ID: `[childIdA, childIdB].sort().join('_')`. |
| `fromChildId` | String (Size 50) | Yes | Sender's child document ID. |
| `fromUsername` | String (Size 50) | Yes | Sender's display name. |
| `text` | String (Size 1000) | Yes | Message content (max 1000 chars). |
| `sentAt` | String (Size 50) | Yes | ISO timestamp. |

> **Setup**: Run `js/appwrite_add_chat.js` in your Appwrite Console F12 to create this collection.
> **Realtime**: Enable Realtime in your Appwrite project settings so `subscribeToChatMessages()` works live.

#### Collection: `kid_watch_history`
Tracks which videos each kid has watched and when.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `childId` | Text (Size 65535) | Yes | The child who watched. |
| `videoId` | Text (Size 65535) | Yes | The video document ID. |
| `videoTitle` | Text (Size 65535) | No | Cached video title for display. |
| `videoCategory` | Text (Size 65535) | No | Cached video category. |
| `videoUrl` | Text (Size 65535) | No | Cached video URL. |
| `thumbnailUrl` | Text (Size 65535) | No | Cached thumbnail URL. |
| `watchedAt` | Text (Size 65535) | Yes | ISO timestamp of when the video was opened. |

> **Permissions**: `create`: `any` (kids have no Appwrite auth session); `read`: `any`.

#### Collection: `kid_favorites`
Stores videos a kid has marked as favorite.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `childId` | Text (Size 65535) | Yes | The child who favorited. |
| `videoId` | Text (Size 65535) | Yes | The video document ID. |
| `videoTitle` | Text (Size 65535) | No | Cached video title. |
| `videoCategory` | Text (Size 65535) | No | Cached video category. |
| `videoUrl` | Text (Size 65535) | No | Cached video URL. |
| `thumbnailUrl` | Text (Size 65535) | No | Cached thumbnail URL. |
| `addedAt` | Text (Size 65535) | Yes | ISO timestamp. |

> **Permissions**: `create`: `any`; `read`: `any`; `delete`: `any`.

#### Collection: `paths` (New)
Stores learning paths/series created by creators.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | String (Size 255) | Yes | Path Title. |
| `description` | String (Size 1000) | No | Short description for kids. |
| `creatorEmail` | String (Size 255) | Yes | Link to the creator document. |
| `type` | String (Size 50) | Yes | Enum: `ordered`, `flexible`. |
| `videoIds` | String[] (Size 255) | Yes | Array of video document IDs. |
| `bonusPoints` | Integer | No | Points awarded on finishing path. |
| `createdAt` | String (Size 50) | No | ISO timestamp. |
| `bonusStars` | Integer | No | Original name for bonusPoints, fallback. |

#### Collection: `kid_rewards` (New)
Ledger of point-earning events.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `childId` | String (Size 50) | Yes | The kid who earned points. |
| `rewardType` | String (Size 50) | Yes | Enum: `video_completion`, `path_bonus`. |
| `points` | Integer | Yes | Points awarded. |
| `sourceId` | String (Size 50) | No | ID of video or path. |
| `rewardId` | String (Size 100) | Yes | Unique deduplication key e.g. `video_{childId}_{videoId}`. |
| `earnedAt` | String (Size 50) | Yes | ISO timestamp. |

#### Collection: `kid_path_status` (New)
Tracks progress within a specific path.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `childId` | String (Size 50) | Yes | The child's ID ($id). |
| `pathId` | String (Size 50) | Yes | The path ID ($id). |
| `completedVideoIds` | String[] (Size 255) | No | IDs of finished videos in this path. |
| `currentStatus` | String (Size 50) | Yes | Enum: `in_progress`, `completed`. |
| `updatedAt` | String (Size 50) | Yes | ISO timestamp. |

#### Collection: `login_requests` (New / Missing from original doc)
Handles the handshake for a child logging into a parent-managed account.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `childUsername` | String (Size 50) | Yes | The username the child entered. |
| `parentEmail` | String (Size 255) | Yes | The parent's email to notify. |
| `status` | String (Size 20) | Yes | Enum: `pending`, `approved`, `denied`. |
| `requestedAt` | String (Size 50) | Yes | ISO timestamp. |
| `deviceInfo` | String (Size 500) | No | Browser/OS info of the requester (max 500 chars). |
| `expiresAt` | String (Size 50) | No | ISO timestamp (usually +5 mins). |
| `childName` | String (Size 100) | No | Child's display name. |
| `childId` | String (Size 50) | No | The child's profile ID. |
| `parentId` | String (Size 50) | No | The parent's user ID. |

#### Collection: `pending_staff` (New / Missing from original doc)
Temporary public ledger for staff and creators to claim accounts pre-created by an admin.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | String (Size 255) | Yes | Unclaimed user email. |
| `firstName` | String (Size 100) | Yes | Unclaimed user first name. |
| `lastName` | String (Size 100) | Yes | Unclaimed user last name. |
| `role` | String (Size 50) | Yes | The assigned role (`creator`, `assistant`). |
| `staffId` | String (Size 20) | Yes | Quick login staff ID (e.g. `#STF-123456`). |
| `usersDocId` | String (Size 50) | Yes | Link to the pre-created profile in `users`. |
| `isClaimed` | Boolean | No | Defaults to `false`. |

#### Collection: `screen_time_logs` (New / Missing from original doc)
Tracks how many minutes a child spends in the app per day/category.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `childId` | String (Size 50) | No | Child profile ID. |
| `date` | String (Size 20) | No | Format: `YYYY-MM-DD`. |
| `minutes` | Double | No | Minutes spent. |
| `category` | String (Size 50) | No | e.g. `general`, `learning`. |

