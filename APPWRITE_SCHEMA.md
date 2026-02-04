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
| `role` | String | Yes | Enum: `parent`, `staff`, `admin`. |
| `status` | String | Yes | Enum: `pending`, `active`, `suspended`. Default: `pending` on registration. |
| `firstName` | String | Yes | User's first name. |
| `middleName` | String | No | User's middle name. |
| `lastName` | String | Yes | User's last name. |
| `faceId` | String | No | JSON string/ID of the face descriptor. |
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
* Unchanged from previous version *

### 4. Logic & Functions
- `onUserCreate`: Trigger to create a `Users` document.
- `monitorScreenTime`: Scheduled function to aggregate daily logs (Future).
