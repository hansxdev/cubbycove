# Appwrite Database Schema Template

This document serves as the single source of truth for the Appwrite database structure. As the project evolves, this schema must be updated to reflect new data requirements.

## Project: CubbyCove

### 1. Authentication (Appwrite Auth)
All users (Parents, Staff) will use Appwrite Authentication.
- **Provider**: Email/Password
- **Additional**: FaceID (Custom auth flow using Face API logic)

---

### 2. Database: `CubbyCoveDB`

#### Collection: `Users` (Profile Data)
Stores additional user information linked to the Appwrite Auth Account.
*Link via `userId` matches Appwrite Auth ID.*

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `role` | String | Yes | Enum: `parent`, `staff`, `admin`. Determines access level. |
| `firstName` | String | Yes | User's first name. |
| `middleName` | String | No | User's middle name. |
| `lastName` | String | Yes | User's last name/surname. |
| `faceIdDescriptor` | String (Long Text) | No | JSON string of the face descriptor for biometric login. |
| `idDocumentFileId` | String | No | ID of the uploaded government ID in Storage (if verification needed). |
| `phoneNumber` | String | No | Contact number. |
| `address` | String | No | Home address. |

#### Collection: `Children`
Stores profiles of children registered by parents.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `parentId` | String | Yes | Relationship: `Users` collection (The parent). |
| `name` | String | Yes | Child's full name. |
| `dob` | Date/String | Yes | Date of Birth. |
| `photoFileId` | String | No | ID of the child's photo in Storage. |
| `medicalNotes` | String | No | Allergies, special needs, etc. |
| `status` | String | Yes | Enum: `active`, `inactive`. |

#### Collection: `AccessLogs` (Future Use)
Logs for check-in/check-out events.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `userId` | String | Yes | Who performed the action. |
| `childId` | String | Only if Check-In | The child being dropped off/picked up. |
| `action` | String | Yes | Enum: `check_in`, `check_out`, `visit`. |
| `timestamp` | Datetime | Yes | Time of event. |

---

### 3. Storage Buckets

#### Bucket: `SecureDocuments`
- **Permissions**: Encrypted, only accessible by Admins and the Uploader.
- **Content**: Government IDs, Medical Forms.

#### Bucket: `PublicAssets`
- **Permissions**: Public Read (or Authenticated Read).
- **Content**: Profile Avatars, Child Photos (Restricted).

---

### 4. Logic & Functions (Planned)
- `onUserCreate`: Trigger to create a `Users` document when a new Auth account is registered.
