# Marketing Performance System - Comprehensive API Documentation

This document provides complete, production-grade technical documentation for every API endpoint available in the **Marketing Performance System (MPS)**.

---

## 1. Global Specifications & Architecture

### Base URL
- **Local Development**: `http://localhost:3000`
- **Production**: `https://marketing.yourdomain.com` (configured via reverse proxy / hosting environment)

### Standard Headers
All protected API requests require authentication and standard JSON payload headers:
- `Content-Type: application/json` (Required for `POST`, `PUT`, `PATCH`)
- `Accept: application/json`
- `Cookie: mps_token=<jwt-token>` (Default session cookie set automatically upon login)
- `Authorization: Bearer <token_or_cron_secret>` (Used for API clients or external Cron triggers)

### Authentication & Authorization Model
- **Authentication**: Stateless JSON Web Token (`JWT`) signed with `HMAC-SHA256` using the server secret `JWT_SECRET`.
- **Session Duration**: Tokens expire in 7 days by default.
- **Roles**:
  - `ADMIN`: Head of Marketing / System Administrator. Full access to management, targets, budgets, settings, audit trails, and reports.
  - `EMPLOYEE`: Digital Marketer. Scoped access restricted to assigned sections, own task queue, daily performance entry, own leads, and personal performance dashboards.

### Standard Error Response Format
All error responses return a standardized JSON structure with appropriate HTTP status codes:
```json
{
  "error": "Error description message in Bengali or English",
  "details": {}
}
```

| HTTP Status | Meaning | Typical Trigger |
|---|---|---|
| `400 Bad Request` | Validation failure or malformed payload | Zod schema invalid, duplicate entity name, dates out of bounds |
| `401 Unauthorized` | Unauthenticated access | Missing or expired JWT session cookie |
| `403 Forbidden` | Insufficient privileges / Role mismatch | Employee accessing Admin endpoints, Admin attempting daily entry submission, account deactivated |
| `404 Not Found` | Resource does not exist | Invalid UUID/ID requested |
| `429 Too Many Requests` | Rate limit exceeded | Exceeding 5 login attempts per minute per IP |
| `500 Internal Server Error`| Unexpected server/database error | Database connection failure, unhandled server exception |

---

## 2. Authentication APIs

### 2.1 Login
Authenticate user credentials, enforce rate limits (5 requests/min per IP), generate JWT, set HttpOnly cookie, and log audit event.

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Auth Required**: No (Public)
- **Rate Limit**: 5 attempts per 60 seconds per IP address

#### Request Body
```json
{
  "email": "employee1@company.com",
  "password": "SecurePassword123!"
}
```
*Constraints*: `email` valid format; `password` minimum 6 characters.

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "user": {
    "id": "e2a14e9f-92bd-482a-bc9e-63f538eec101",
    "name": "রাকিব হাসান (Rakib Hasan)",
    "email": "employee1@company.com",
    "role": "EMPLOYEE",
    "phone": "01711223344"
  },
  "redirectUrl": "/employee/my-work"
}
```
*Response Header*: `Set-Cookie: mps_token=...; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`

#### Error Status Codes
- `400 Bad Request`: `{ "error": "পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে / Password must be at least 6 characters" }`
- `401 Unauthorized`: `{ "error": "ইমেইল বা পাসওয়ার্ড সঠিক নয় / Invalid email or password" }`
- `403 Forbidden`: `{ "error": "আপনার অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।" }`
- `429 Too Many Requests`: `{ "error": "অতিরিক্ত চেষ্টার কারণে লগইন সাময়িক বন্ধ আছে। দয়া করে 52 সেকেন্ড পর চেষ্টা করুন।" }`
- `500 Internal Server Error`: `{ "error": "লগইন প্রক্রিয়ায় সমস্যা হয়েছে" }`

---

### 2.2 Logout
Invalidate current session by clearing the `mps_token` cookie.

- **URL**: `/api/auth/logout`
- **Method**: `POST`
- **Auth Required**: Any authenticated user (`ADMIN` or `EMPLOYEE`)

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```
*Response Header*: `Set-Cookie: mps_token=; Path=/; HttpOnly; Max-Age=0`

---

### 2.3 Get Current User Session (`Me`)
Retrieve the decoded profile of the currently authenticated user.

- **URL**: `/api/auth/me`
- **Method**: `GET`
- **Auth Required**: `ADMIN` or `EMPLOYEE`

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "user": {
    "id": "e2a14e9f-92bd-482a-bc9e-63f538eec101",
    "name": "রাকিব হাসান",
    "email": "employee1@company.com",
    "role": "EMPLOYEE",
    "phone": "01711223344"
  }
}
```

#### Error Status Codes
- `401 Unauthorized`: `{ "error": "Not authenticated" }`

---

## 3. Sections & Facebook Group Links APIs (Admin)

### 3.1 List All Sections
Retrieve all group sections with total links, active links, and assigned employee counts.

- **URL**: `/api/admin/sections`
- **Method**: `GET`
- **Auth Required**: `ADMIN`

#### Sample Success Response (`200 OK`)
```json
{
  "sections": [
    {
      "id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
      "name": "মাশরুম চাষি ও খামারি গ্রুপ (Mushroom Farmers)",
      "description": "Commercial mushroom cultivators and organic growers community groups",
      "is_active": true,
      "total_links": 45,
      "active_links": 42,
      "assigned_employees": 2,
      "created_at": "2026-10-20T08:30:00.000Z"
    }
  ]
}
```

---

### 3.2 Create New Section
Create a new group section container. Section name must be unique.

- **URL**: `/api/admin/sections`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "name": "রেস্তোরাঁ ও পাইকারি ক্রেতা গ্রুপ",
  "description": "B2B culinary buyers and bulk mushroom purchasers",
  "is_active": true
}
```

#### Sample Success Response (`201 Created`)
```json
{
  "success": true,
  "section": {
    "id": "c1f24d8b-d790-449e-b998-384f5539ab82",
    "name": "রেস্তোরাঁ ও পাইকারি ক্রেতা গ্রুপ",
    "description": "B2B culinary buyers and bulk mushroom purchasers",
    "is_active": true,
    "created_at": "2026-10-25T05:15:00.000Z",
    "updated_at": "2026-10-25T05:15:00.000Z"
  }
}
```

#### Error Status Codes
- `400 Bad Request`: Duplicate name or validation failure.
- `403 Forbidden`: Non-admin role.

---

### 3.3 Get Single Section Details
Retrieve single section details along with all associated links, upload batches, and assignments.

- **URL**: `/api/admin/sections/[id]`
- **Method**: `GET`
- **Auth Required**: `ADMIN`

#### Sample Success Response (`200 OK`)
```json
{
  "section": {
    "id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
    "name": "মাশরুম চাষি ও খামারি গ্রুপ",
    "description": "Commercial mushroom cultivators",
    "is_active": true,
    "group_links": [
      {
        "id": "a918f4a1-0e1f-4efc-8b89-21b9201a0001",
        "url": "https://facebook.com/groups/mushroomgrowersbd",
        "title": "Mushroom Farmers Bangladesh",
        "is_active": true,
        "created_at": "2026-10-21T10:00:00.000Z"
      }
    ],
    "assignments": [
      {
        "id": "b109e4a1-0e1f-4efc-8b89-21b9201a0002",
        "employee": {
          "id": "e2a14e9f-92bd-482a-bc9e-63f538eec101",
          "name": "রাকিব হাসান",
          "email": "employee1@company.com"
        }
      }
    ]
  }
}
```

---

### 3.4 Update Section
Update name, description, or active status of a section.

- **URL**: `/api/admin/sections/[id]`
- **Method**: `PUT`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "name": "মাশরুম চাষি ও খামারি গ্রুপ (আপডেটেড)",
  "description": "আপডেটেড বিবরণী",
  "is_active": true
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "section": {
    "id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
    "name": "মাশরুম চাষি ও খামারি গ্রুপ (আপডেটেড)",
    "description": "আপডেটেড বিবরণী",
    "is_active": true
  }
}
```

---

### 3.5 Delete Section
Delete a group section. Cascades deletions of related links, completions, and assignments.

- **URL**: `/api/admin/sections/[id]`
- **Method**: `DELETE`
- **Auth Required**: `ADMIN`

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "সেকশনটি সফলভাবে মুছে ফেলা হয়েছে"
}
```

---

### 3.6 Add Single Link to Section
- **URL**: `/api/admin/sections/[id]/links`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "url": "https://www.facebook.com/groups/dhakab2bbuyers",
  "title": "ঢাকা পাইকারি ক্রেতা ফোরাম"
}
```

#### Sample Success Response (`201 Created`)
```json
{
  "success": true,
  "link": {
    "id": "fa20de12-b108-412f-98c0-bc661910ad21",
    "section_id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
    "url": "https://www.facebook.com/groups/dhakab2bbuyers",
    "title": "ঢাকা পাইকারি ক্রেতা ফোরাম",
    "is_active": true,
    "created_at": "2026-10-25T05:20:00.000Z"
  }
}
```

---

### 3.7 Bulk Deactivate Links
Deactivate all links belonging to a section.

- **URL**: `/api/admin/sections/[id]/links/bulk-deactivate`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "updatedCount": 42,
  "message": "42 টি লিঙ্ক নিষ্ক্রিয় করা হয়েছে"
}
```

---

### 3.8 CSV Upload Preview
Parse uploaded CSV file, sanitize URLs (strip query params, trailing slashes), detect duplicates within CSV and against the database. Does NOT commit to database.

- **URL**: `/api/admin/sections/[id]/csv/preview`
- **Method**: `POST`
- **Auth Required**: `ADMIN`
- **Payload Format**: `multipart/form-data` with field `file` containing `.csv`

#### Sample Success Response (`200 OK`)
```json
{
  "fileName": "facebook_groups_batch_1.csv",
  "totalRows": 50,
  "validRows": 45,
  "duplicateRows": 3,
  "invalidRows": 2,
  "preview": [
    {
      "url": "https://facebook.com/groups/freshvegetablesbd",
      "title": "Fresh Vegetables BD",
      "status": "VALID"
    },
    {
      "url": "https://facebook.com/groups/duplicate_group",
      "title": "Duplicate Group",
      "status": "DUPLICATE_DB",
      "error": "লিঙ্কটি ডাটাবেজে ইতিমধ্যে রয়েছে"
    }
  ]
}
```

---

### 3.9 CSV Upload Confirm
Confirm and commit parsed CSV links into the database under an audit tracked `CsvUploadBatch`.

- **URL**: `/api/admin/sections/[id]/csv/confirm`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "fileName": "facebook_groups_batch_1.csv",
  "links": [
    { "url": "https://facebook.com/groups/freshvegetablesbd", "title": "Fresh Vegetables BD" },
    { "url": "https://facebook.com/groups/agrotradersbd", "title": "Agro Traders BD" }
  ]
}
```

#### Sample Success Response (`201 Created`)
```json
{
  "success": true,
  "batchId": "bc110a99-b14a-4d22-90ab-12908fae3100",
  "inserted": 2,
  "duplicatesSkipped": 0,
  "invalidSkipped": 0,
  "message": "২ টি নতুন লিঙ্ক সফলভাবে যুক্ত করা হয়েছে"
}
```

---

### 3.10 CSV Upload History
Retrieve global history of all CSV upload batches across all sections.

- **URL**: `/api/admin/csv/history`
- **Method**: `GET`
- **Auth Required**: `ADMIN`

#### Sample Success Response (`200 OK`)
```json
{
  "batches": [
    {
      "id": "bc110a99-b14a-4d22-90ab-12908fae3100",
      "section_id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
      "section_name": "মাশরুম চাষি ও খামারি গ্রুপ",
      "file_name": "facebook_groups_batch_1.csv",
      "total_rows": 50,
      "inserted": 45,
      "duplicates": 3,
      "invalid": 2,
      "uploader_name": "Admin User",
      "created_at": "2026-10-25T05:22:00.000Z"
    }
  ]
}
```

---

## 4. Employees & Assignments APIs (Admin)

### 4.1 List Employees
Retrieve all employees with their assigned sections, lead counts, and completed task tallies.

- **URL**: `/api/admin/employees`
- **Method**: `GET`
- **Auth Required**: `ADMIN`

#### Sample Success Response (`200 OK`)
```json
{
  "employees": [
    {
      "id": "e2a14e9f-92bd-482a-bc9e-63f538eec101",
      "name": "রাকিব হাসান",
      "email": "rakib@company.com",
      "phone": "01711223344",
      "is_active": true,
      "created_at": "2026-10-15T09:00:00.000Z",
      "sections": [
        { "id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a", "name": "মাশরুম চাষি ও খামারি গ্রুপ" }
      ],
      "total_completed_links": 128,
      "total_leads": 34
    }
  ]
}
```

---

### 4.2 Create New Employee
Create a new digital marketer employee account. Optionally assign sections immediately.

- **URL**: `/api/admin/employees`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "name": "তানভীর আহমেদ (Tanvir Ahmed)",
  "email": "tanvir@company.com",
  "phone": "01812345678",
  "password": "InitialEmployeePassword123!",
  "sectionIds": ["7b09fd02-0c92-48ec-9f4c-e83692aa102a"]
}
```

#### Sample Success Response (`201 Created`)
```json
{
  "success": true,
  "employee": {
    "id": "c33b2f12-0012-4f81-a991-8819dcf10a19",
    "name": "তানভীর আহমেদ",
    "email": "tanvir@company.com",
    "phone": "01812345678",
    "is_active": true,
    "role": "EMPLOYEE"
  }
}
```

---

### 4.3 Update Employee Profile
Update employee name, phone, or active/inactive status.

- **URL**: `/api/admin/employees/[id]`
- **Method**: `PUT`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "name": "তানভীর আহমেদ (সিনিয়র)",
  "phone": "01812345678",
  "is_active": true
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "employee": {
    "id": "c33b2f12-0012-4f81-a991-8819dcf10a19",
    "name": "তানভীর আহমেদ (সিনিয়র)",
    "phone": "01812345678",
    "is_active": true
  }
}
```

---

### 4.4 Assign Sections to Employee
Replace or configure the assigned sections for an employee. (Also supported via route alias `/api/admin/employees/[id]/sections`).

- **URL**: `/api/admin/employees/[id]/assign`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "sectionIds": [
    "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
    "c1f24d8b-d790-449e-b998-384f5539ab82"
  ]
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "সেকশন অ্যাসাইনমেন্ট সফলভাবে আপডেট করা হয়েছে",
  "assignedCount": 2
}
```

---

### 4.5 Reset Employee Password
- **URL**: `/api/admin/employees/[id]/reset-password`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "newPassword": "NewSecureEmployeePass2026!"
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে"
}
```

---

## 5. Employee Work & Task Queue APIs

### 5.1 Get Employee Work Queue
Retrieve the active task list for the logged-in employee: assigned sections, uncompleted links (`todoLinks`), links completed today (`completedLinks`), daily progress count, and undo permission flag.

- **URL**: `/api/employee/work`
- **Method**: `GET`
- **Auth Required**: `EMPLOYEE`
- **Query Parameters**:
  - `sectionId` *(optional)*: Filter links by specific assigned section.
  - `q` *(optional)*: Search query matching link title or URL.

#### Sample Success Response (`200 OK`)
```json
{
  "assignedSections": [
    { "id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a", "name": "মাশরুম চাষি ও খামারি গ্রুপ" }
  ],
  "todoLinks": [
    {
      "id": "a918f4a1-0e1f-4efc-8b89-21b9201a0001",
      "section_id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
      "section_name": "মাশরুম চাষি ও খামারি গ্রুপ",
      "url": "https://facebook.com/groups/mushroomgrowersbd",
      "title": "Mushroom Farmers Bangladesh",
      "completedToday": false
    }
  ],
  "completedLinks": [
    {
      "id": "a918f4a1-0e1f-4efc-8b89-21b9201a0099",
      "section_id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
      "section_name": "মাশরুম চাষি ও খামারি গ্রুপ",
      "url": "https://facebook.com/groups/dhakaagro",
      "title": "Dhaka Agro Discussion",
      "completedAt": "2026-10-25T06:12:30.000Z"
    }
  ],
  "progress": {
    "completedToday": 1,
    "totalAssigned": 2,
    "percentage": 50
  },
  "undoEnabled": true
}
```

---

### 5.2 Mark Link Task as Complete
Mark a link in the employee's assigned section as posted/completed. Idempotent: if already completed today, returns `alreadyDone: true`. (Also documented under route alias `/api/employee/work/[id]/complete`).

- **URL**: `/api/employee/work/[linkId]/done`
- **Method**: `POST`
- **Auth Required**: `EMPLOYEE`

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "completionId": "dc881a20-0982-4fa1-8891-91280ab01923",
  "completedAt": "2026-10-25T06:12:30.000Z",
  "alreadyDone": false
}
```

#### Error Status Codes
- `403 Forbidden`: Link does not belong to an assigned section or link is inactive.
- `404 Not Found`: Link ID not found.

---

### 5.3 Undo Link Task Completion
Undo a previously marked completion. Checks `ScoringSettings.undo_enabled`. Sets `undone_at` timestamp and writes audit record.

- **URL**: `/api/employee/work/[linkId]/undo`
- **Method**: `POST`
- **Auth Required**: `EMPLOYEE`

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "পোস্টিং সম্পন্ন রেকর্ড আনডু (Undo) করা হয়েছে"
}
```

#### Error Status Codes
- `403 Forbidden`: Undo disabled in system settings.
- `404 Not Found`: No active completion record exists to undo.

---

## 6. Daily Performance Entry APIs

### 6.1 Get Daily Entry Data
Fetch performance metrics, product sales, daily issues/priorities text, and edit window status for a specific date.

- **URL**: `/api/employee/daily-entry`
- **Method**: `GET`
- **Auth Required**: `EMPLOYEE` (can only view own data) or `ADMIN` (can specify `employee_id`)
- **Query Parameters**:
  - `date`: Date formatted `YYYY-MM-DD` (defaults to today in `Asia/Dhaka`).
  - `employee_id` *(Admin only)*: Target employee's ID to inspect.

#### Sample Success Response (`200 OK`)
```json
{
  "entry_date": "2026-10-25",
  "is_locked": false,
  "can_edit": true,
  "lock_reason": null,
  "metrics": {
    "POSTS_DONE": 25,
    "SALES_AMOUNT": 12500,
    "PROFIT_AMOUNT": 3750,
    "NEW_CLIENTS": 4,
    "B2B_ORDERS": 2,
    "RETENTION_COUNT": 3,
    "FOLLOWUPS_DONE": 18
  },
  "metric_notes": {
    "SALES_AMOUNT": "৩টি রেস্তোরাঁ থেকে স্পেশাল বাটন মাশরুমের সরাসরি অর্ডার"
  },
  "product_sales": [
    {
      "product_id": "78091a11-8891-4401-bc81-229081a9f001",
      "product_name_bn": "তাজা বাটন মাশরুম (Button Mushroom)",
      "quantity": 25,
      "amount": 12500
    }
  ],
  "daily_text": {
    "main_issue": "বৃষ্টির কারণে কিছু এলাকায় ডেলিভারি সাময়িক বিলম্বিত হয়েছে।",
    "next_priorities": "উত্তরা ও ধানমন্ডির ক্যাফেগুলোতে স্যাম্পল টেস্ট পাঠানো।"
  }
}
```

---

### 6.2 Submit Daily Performance Entry
Submit daily performance figures, individual product breakdown, qualitative reflections, and metric notes. Strictly enforced: **Admins are prohibited from submitting daily entries (HTTP 403)**. Submission must fall within the configured edit window (`today` and up to `N` days prior).

- **URL**: `/api/employee/daily-entry`
- **Method**: `POST`
- **Auth Required**: `EMPLOYEE` only

#### Request Body
```json
{
  "entry_date": "2026-10-25",
  "metrics": {
    "SALES_AMOUNT": 12500,
    "PROFIT_AMOUNT": 3750,
    "NEW_CLIENTS": 4,
    "B2B_ORDERS": 2,
    "RETENTION_COUNT": 3,
    "FOLLOWUPS_DONE": 18
  },
  "product_sales": [
    {
      "product_id": "78091a11-8891-4401-bc81-229081a9f001",
      "quantity": 25,
      "amount": 12500
    }
  ],
  "daily_text": {
    "main_issue": "বৃষ্টির কারণে ডেলিভারি জটিলতা।",
    "next_priorities": "পাইকারি ডিলারদের সাথে যোগাযোগ বৃদ্ধি।"
  },
  "metric_notes": {
    "SALES_AMOUNT": "ক্যাফে ক্লায়েন্ট বাল্ক অর্ডার"
  }
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "দৈনিক পারফরম্যান্স ডাটা সফলভাবে সংরক্ষিত হয়েছে",
  "entry_date": "2026-10-25"
}
```

#### Error Status Codes
- `400 Bad Request`: Validation failure or date is locked / outside edit window (`"এই তারিখের এন্ট্রি উইন্ডো বন্ধ হয়ে গেছে।"`).
- `403 Forbidden`: Admin role attempted submission (`"অ্যাডমিনদের দৈনিক এন্ট্রি জমা দেওয়ার অনুমতি নেই"`).

---

## 7. Leads & CRM Pipeline APIs

### 7.1 List Leads
Query leads with filtering by status, buyer type, search query, or unfinished orders.
- **Scoping Rule**: Digital Marketers (`EMPLOYEE`) see only their assigned leads; `ADMIN` sees all company leads.

- **URL**: `/api/leads`
- **Method**: `GET`
- **Auth Required**: `ADMIN` or `EMPLOYEE`
- **Query Parameters**:
  - `status`: Filter by `NEW`, `CONTACTED`, `QUALIFIED`, `ORDERED`, `LOST`.
  - `buyerType`: Filter by `FARMER`, `WHOLESALER`, `RESTAURANT`, `DEALER`, `RETAIL`, `OTHER`.
  - `unfinished`: `true` to filter QUALIFIED leads older than 3 days with no order placed (Acceptance Test 15).
  - `q`: Search by lead name, phone number, or notes.

#### Sample Success Response (`200 OK`)
```json
{
  "leads": [
    {
      "id": "e91024a1-1200-4882-ab00-8819dcf10a01",
      "name": "আব্দুল করিম (গুলশান ক্যাফে)",
      "phone": "017******89",
      "raw_phone": "01712345689",
      "address": "বাড়ি ১২, রোড ৫, গুলশান ১, ঢাকা",
      "buyer_type": "RESTAURANT",
      "source_channel": "ফেসবুক গ্রুপ",
      "status": "QUALIFIED",
      "quality_rating": 5,
      "expected_value": 35000,
      "order_amount": null,
      "is_unfinished": true,
      "owner": { "id": "e2a14e9f-92bd-482a-bc9e-63f538eec101", "name": "রাকিব হাসান" },
      "notes_count": 3,
      "created_at": "2026-10-20T11:00:00.000Z"
    }
  ]
}
```

---

### 7.2 Create New Lead
Add a new customer lead into the CRM pipeline with Bangladeshi phone normalization (`01[3-9]XXXXXXXX`). Automatically flags if phone already exists.

- **URL**: `/api/leads`
- **Method**: `POST`
- **Auth Required**: `ADMIN` or `EMPLOYEE`

#### Request Body
```json
{
  "name": "মো: রফিকুল ইসলাম (ধানমন্ডি ট্রেডার্স)",
  "phone": "01712345678",
  "address": "ধানমন্ডি ২/এ, ঢাকা",
  "buyer_type": "DEALER",
  "source_channel": "ফেসবুক বিজ্ঞাপন (Facebook Ad)",
  "status": "NEW",
  "quality_rating": 4,
  "expected_value": 50000,
  "initial_note": "প্রতি সপ্তাহে ৫০ কেজি মাশরুম ক্রয়ে আগ্রহী।"
}
```

#### Sample Success Response (`201 Created`)
```json
{
  "success": true,
  "lead": {
    "id": "e91024a1-1200-4882-ab00-8819dcf10a02",
    "name": "মো: রফিকুল ইসলাম (ধানমন্ডি ট্রেডার্স)",
    "phone": "01712345678",
    "buyer_type": "DEALER",
    "status": "NEW",
    "owner_id": "e2a14e9f-92bd-482a-bc9e-63f538eec101",
    "created_at": "2026-10-25T06:30:00.000Z"
  }
}
```

---

### 7.3 Check Phone Duplication
Check in real time whether a phone number exists in the database.

- **URL**: `/api/leads/check-phone?phone=01712345678`
- **Method**: `GET`
- **Auth Required**: `ADMIN` or `EMPLOYEE`

#### Sample Success Response (`200 OK`)
```json
{
  "exists": true,
  "lead": {
    "id": "e91024a1-1200-4882-ab00-8819dcf10a01",
    "name": "আব্দুল করিম",
    "owner_name": "রাকিব হাসান",
    "status": "QUALIFIED"
  }
}
```

---

### 7.4 Update Lead Status & Order Details
- **URL**: `/api/leads/[id]`
- **Method**: `PUT`
- **Auth Required**: `ADMIN` or `EMPLOYEE` (Owner only)

#### Request Body
```json
{
  "status": "ORDERED",
  "order_amount": 48500,
  "lost_reason": null,
  "next_followup_date": null
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "lead": {
    "id": "e91024a1-1200-4882-ab00-8819dcf10a02",
    "status": "ORDERED",
    "order_amount": 48500
  }
}
```

---

### 7.5 Add Follow-up Note to Lead
- **URL**: `/api/leads/[id]/notes`
- **Method**: `POST`
- **Auth Required**: `ADMIN` or `EMPLOYEE` (Owner only)

#### Request Body
```json
{
  "note": "গ্রাহকের সাথে ফোনে কথা হয়েছে, আগামী রবিবার কনফার্ম করবেন।"
}
```

#### Sample Success Response (`201 Created`)
```json
{
  "success": true,
  "note": {
    "id": "d09121a8-1200-4882-ab00-8819dcf10b01",
    "lead_id": "e91024a1-1200-4882-ab00-8819dcf10a02",
    "note": "গ্রাহকের সাথে ফোনে কথা হয়েছে, আগামী রবিবার কনফার্ম করবেন।",
    "author": { "id": "e2a14e9f-92bd-482a-bc9e-63f538eec101", "name": "রাকিব হাসান", "role": "EMPLOYEE" },
    "created_at": "2026-10-25T06:35:00.000Z"
  }
}
```

---

## 8. Targets & Budgets APIs (Admin)

### 8.1 List Targets
- **URL**: `/api/targets`
- **Method**: `GET`
- **Auth Required**: `ADMIN` or `EMPLOYEE`
- **Query Parameters**:
  - `section_id` *(optional)*: Filter targets by group section.
  - `period_type` *(optional)*: Filter by `DAILY`, `MONTHLY`, `CUSTOM`.

#### Sample Success Response (`200 OK`)
```json
{
  "targets": [
    {
      "id": "t11029a1-0982-4112-9901-ac812019a001",
      "section_id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
      "section": { "id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a", "name": "মাশরুম চাষি ও খামারি গ্রুপ" },
      "metric_type": "POSTS_DONE",
      "target_value": 600,
      "period_type": "MONTHLY",
      "period_start": "2026-10-01",
      "period_end": "2026-10-31",
      "creator": { "id": "admin-id", "name": "Admin User", "email": "admin@company.com" }
    }
  ]
}
```

---

### 8.2 Create Section Target with Overlap Detection
Set a new performance target for a section. Performs overlap check: alerts or rejects conflicting date ranges for the same metric in the same section.

- **URL**: `/api/targets`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "section_id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
  "metric_type": "SALES_AMOUNT",
  "target_value": 300000,
  "period_type": "MONTHLY",
  "period_start": "2026-11-01",
  "period_end": "2026-11-30"
}
```

#### Sample Success Response (`201 Created`)
```json
{
  "success": true,
  "target": {
    "id": "t11029a1-0982-4112-9901-ac812019a002",
    "section_id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
    "metric_type": "SALES_AMOUNT",
    "target_value": 300000,
    "period_type": "MONTHLY",
    "period_start": "2026-11-01",
    "period_end": "2026-11-30"
  }
}
```

#### Error Status Codes
- `400 Bad Request`: Date overlap error (`"একই সেকশন ও মেট্রিকের জন্য এই সময়সীমায় ইতিমধ্যে আরেকটি টার্গেট বিদ্যমান"`).

---

### 8.3 Bulk Copy Targets Across Sections
Copy all active targets from a source section to multiple destination sections for a specified month.

- **URL**: `/api/targets/bulk-copy`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "source_section_id": "7b09fd02-0c92-48ec-9f4c-e83692aa102a",
  "target_section_ids": [
    "c1f24d8b-d790-449e-b998-384f5539ab82",
    "d2a33e99-8812-4211-ac99-991280ab0199"
  ],
  "target_month": "2026-11"
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "copiedCount": 8,
  "message": "৮ টি টার্গেট সফলভাবে অনুলিপি (Copy) করা হয়েছে"
}
```

---

### 8.4 Get Marketing Budgets
Fetch total monthly marketing budget limit and individual campaign budgets.

- **URL**: `/api/budgets`
- **Method**: `GET`
- **Auth Required**: `ADMIN` or `EMPLOYEE`
- **Query Parameters**:
  - `month`: Format `YYYY-MM` (defaults to current Dhaka month).

#### Sample Success Response (`200 OK`)
```json
{
  "month": "2026-10",
  "monthly_budget": {
    "id": "b09121a1-4412-4f81-a991-8819dcf10a01",
    "scope": "MONTHLY_TOTAL",
    "month": "2026-10",
    "amount": 100000,
    "setter": { "id": "admin-id", "name": "Admin User", "email": "admin@company.com" }
  },
  "campaign_budgets": [
    {
      "id": "b09121a1-4412-4f81-a991-8819dcf10a02",
      "scope": "CAMPAIGN",
      "amount": 40000,
      "campaign": {
        "id": "c9012a11-0982-4112-9901-ac812019a001",
        "name": "অক্টোবর মাশরুম বুস্টিং",
        "channel": "FACEBOOK_AD",
        "status": "RUNNING",
        "budget_amount": 40000
      }
    }
  ]
}
```

---

### 8.5 Set or Update Budget Limit
- **URL**: `/api/budgets`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "scope": "MONTHLY_TOTAL",
  "month": "2026-11",
  "amount": 120000
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "budget": {
    "id": "b09121a1-4412-4f81-a991-8819dcf10a03",
    "scope": "MONTHLY_TOTAL",
    "month": "2026-11",
    "amount": 120000
  }
}
```

---

## 9. Performance Reports & Analytics APIs

### 9.1 Daily Performance Report
Compute daily team totals, pro-rated daily targets, weighted achievement scores, and individual employee breakdowns.

- **URL**: `/api/reports/daily`
- **Method**: `GET`
- **Auth Required**: `ADMIN`
- **Query Parameters**:
  - `date`: Format `YYYY-MM-DD` (defaults to today in Dhaka).

#### Sample Success Response (`200 OK`)
```json
{
  "date": "2026-10-25",
  "summary": {
    "team_sales": 48500,
    "team_profit": 14200,
    "team_posts": 65,
    "team_new_clients": 12,
    "team_b2b_orders": 6,
    "team_retention": 8,
    "team_followups": 45,
    "average_score": 0.942,
    "passing_count": 4,
    "failing_count": 0
  },
  "employees": [
    {
      "employee_id": "e2a14e9f-92bd-482a-bc9e-63f538eec101",
      "employee_name": "রাকিব হাসান",
      "assigned_sections": ["মাশরুম চাষি ও খামারি গ্রুপ"],
      "score": 0.965,
      "is_failing": false,
      "metrics": {
        "POSTS_DONE": { "target": 20, "achieved": 25, "achievement_rate": 1.0 },
        "SALES_AMOUNT": { "target": 10000, "achieved": 12500, "achievement_rate": 1.0 }
      }
    }
  ]
}
```

---

### 9.2 Export Daily Report (Excel / CSV)
- **URL**: `/api/reports/daily/export`
- **Method**: `GET`
- **Auth Required**: `ADMIN`
- **Query Parameters**: `date=YYYY-MM-DD&format=xlsx` (or `format=csv`)
- **Response**: Binary stream (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` or `text/csv`) with header `Content-Disposition: attachment; filename="daily_report_2026-10-25.xlsx"`.

---

### 9.3 Weekly Performance Report (5 Fixed Strategic Questions)
Generate or fetch the automated analytics draft for Sunday-to-Saturday weeks, retrieve answers for the 5 strategic questions, or publish final reports.

- **URL**: `/api/reports/weekly`
- **Method**: `GET`
- **Auth Required**: `ADMIN`
- **Query Parameters**:
  - `date`: Any date inside the target week (defaults to today).
  - `history`: `true` to list past weekly reports.

#### Sample Success Response (`200 OK`)
```json
{
  "report": {
    "id": "w10924a1-0982-4112-9901-ac812019a001",
    "week_start": "2026-10-18",
    "week_end": "2026-10-24",
    "status": "DRAFT",
    "auto_data": {
      "question_1_top_products": [
        { "product_name_bn": "বাটন মাশরুম", "quantity": 180, "amount": 90000 }
      ],
      "question_2_campaign_roi": [
        { "campaign_name": "ফেসবুক বিজ্ঞাপন", "ad_spend": 15000, "sales_generated": 65000, "roi_ratio": 4.33 }
      ],
      "question_3_pipeline_metrics": {
        "new_leads": 45,
        "qualified_leads": 28,
        "conversion_rate": 62.2
      }
    },
    "answers": [
      {
        "question_no": 1,
        "question_text": "কোন কোন পণ্যে সর্বোচ্চ বিক্রয় ও প্রবৃদ্ধি হয়েছে?",
        "answer_text": "বাটন মাশরুম ও ফ্রেশ অয়েস্টার মাশরুম সর্বোচ্চ চাহিদায় ছিল।"
      },
      {
        "question_no": 2,
        "question_text": "কোন চ্যানেল বা ক্যাম্পেইনে মার্কেটিং বাজেট সবচেয়ে কার্যকরী ছিল?",
        "answer_text": "ফেসবুক বুস্টিংয়ে ৪.৩৩ গুণ রিটার্ন অন অ্যাড স্পেন্ড (ROAS) অর্জিত হয়েছে।"
      },
      {
        "question_no": 3,
        "question_text": "লিড ফানেলের কনভার্সন রেট কেমন ছিল এবং কোথায় ড্রপ-অফ ঘটেছে?",
        "answer_text": "ফলোআপ স্তরে কিছু দেরি হলেও কনভার্সন রেট ৬২% অতিক্রম করেছে।"
      },
      {
        "question_no": 4,
        "question_text": "চলতি সপ্তাহের প্রধান চ্যালেঞ্জ ও প্রতিবন্ধকতা কী কী ছিল?",
        "answer_text": "লজিস্টিকস কুরিয়ারে ২ দিন বিলম্ব।"
      },
      {
        "question_no": 5,
        "question_text": "আগামী সপ্তাহের শীর্ষ ৩টি অগ্রাধিকার কর্মপরিকল্পনা কী?",
        "answer_text": "১. পাইকারি রেস্তোরাঁ চুক্তি স্বাক্ষর, ২. নতুন প্যাক ডিজাইন, ৩. ফলোআপ গতি বৃদ্ধি।"
      }
    ],
    "published_at": null
  }
}
```

---

### 9.4 Save Answers / Publish Weekly Report
- **URL**: `/api/reports/weekly`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "id": "w10924a1-0982-4112-9901-ac812019a001",
  "week_start": "2026-10-18",
  "publish": true,
  "answers": [
    { "question_no": 1, "answer_text": "বাটন মাশরুম শীর্ষ বিক্রিত পণ্য।" },
    { "question_no": 2, "answer_text": "ফেসবুক গ্রুপ মার্কেটিং অত্যন্ত কার্যকরী ছিল।" },
    { "question_no": 3, "answer_text": "৬২% কনভার্সন অর্জন।" },
    { "question_no": 4, "answer_text": "কুরিয়ার লজিস্টিকস বিলম্ব।" },
    { "question_no": 5, "answer_text": "১. ক্যাফে চুক্তি, ২. নতুন ক্রিয়েটিভ অ্যাড।" }
  ]
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "সাপ্তাহিক রিপোর্ট সফলভাবে প্রকাশিত হয়েছে",
  "status": "PUBLISHED",
  "published_at": "2026-10-25T06:45:00.000Z"
}
```

---

### 9.5 Export Weekly Report (PDF / Excel)
- **URL**: `/api/reports/weekly/export`
- **Method**: `GET`
- **Auth Required**: `ADMIN`
- **Query Parameters**: `date=YYYY-MM-DD&format=pdf` (or `format=xlsx`)
- **Response**: Binary stream (`application/pdf` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).

---

### 9.6 Monthly Executive Report
- **URL**: `/api/reports/monthly`
- **Method**: `GET`
- **Auth Required**: `ADMIN`
- **Query Parameters**: `month=YYYY-MM` (defaults to current month).

#### Sample Success Response (`200 OK`)
```json
{
  "report": {
    "id": "m90124a1-0982-4112-9901-ac812019a001",
    "month": "2026-10",
    "status": "DRAFT",
    "auto_data": {
      "total_sales": 850000,
      "total_profit": 255000,
      "ad_spend": 60000,
      "net_margin_percent": 30.0,
      "target_achievement_percent": 106.2
    },
    "summary_text": "অক্টোবর মাসে সামগ্রিক টার্গেটের ১০৬% অর্জিত হয়েছে।",
    "next_month_goal": "নভেম্বরে ১০ লক্ষ টাকা বিক্রয় ও ১৫টি নতুন পাইকারি ক্লায়েন্ট যুক্ত করা।",
    "next_month_budget": 80000,
    "finalized_at": null
  }
}
```

---

### 9.7 Finalize Monthly Executive Report
- **URL**: `/api/reports/monthly`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "month": "2026-10",
  "summary_text": "অক্টোবর মাসে চমৎকার বিক্রয় ও মুনাফা অর্জিত হয়েছে।",
  "next_month_goal": "১০ লক্ষ টাকা বিক্রয় ও কর্পোরেট ডিলারশিপ সম্প্রসারণ।",
  "next_month_budget": 80000,
  "finalize": true
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "মাসিক রিপোর্ট সফলভাবে চূড়ান্ত (Finalized) করা হয়েছে",
  "status": "FINAL"
}
```

---

### 9.8 Export Monthly Executive Report (PDF / Excel)
- **URL**: `/api/reports/monthly/export`
- **Method**: `GET`
- **Auth Required**: `ADMIN`
- **Query Parameters**: `month=YYYY-MM&format=pdf` (or `format=xlsx`)

---

## 10. 90-Day Strategic Plan APIs

### 10.1 Get Active 90-Day Plan
Retrieve the active 90-day plan divided into 3 distinct phases (Days 1–30, Days 31–60, Days 61–90), including all tasks, owners, due dates, statuses, completion percentages, milestones, and aggregated statistics.

- **URL**: `/api/plan`
- **Method**: `GET`
- **Auth Required**: `ADMIN` or `EMPLOYEE`

#### Sample Success Response (`200 OK`)
```json
{
  "plan": {
    "id": "p11029a1-0982-4112-9901-ac812019a001",
    "name": "৯০ দিনের মার্কেটিং ও বিক্রয় রূপান্তর পরিকল্পনা",
    "start_date": "2026-10-01",
    "status": "ACTIVE",
    "phases": [
      {
        "id": "ph1-id",
        "name_bn": "পর্যায় ১: ফাউন্ডেশন ও পাইপলাইন তৈরি",
        "name_en": "Phase 1: Foundation & Pipeline Building",
        "day_start": 1,
        "day_end": 30,
        "order_no": 1,
        "tasks": [
          {
            "id": "task-1",
            "title_bn": "ফেসবুক গ্রুপ লিঙ্ক ডাটাবেজ ৫০০-এ উন্নীত করা",
            "status": "DONE",
            "progress_percent": 100,
            "owner": { "id": "e2a14e9f-92bd-482a-bc9e-63f538eec101", "name": "রাকিব হাসান" },
            "due_date": "2026-10-15"
          }
        ],
        "milestones": [
          {
            "id": "ms-1",
            "title_bn": "সাপ্তাহিক বিক্রয় ১ লক্ষ টাকা স্থিতিশীলকরণ",
            "expected_result": "টানা ২ সপ্তাহ ১ লক্ষ টাকা বিক্রয় অর্জন",
            "status": "MET",
            "achieved_result": "গড় বিক্রয় ১,১৫,০০০ টাকা অর্জিত হয়েছে",
            "reviewed_at": "2026-10-24T10:00:00.000Z"
          }
        ]
      }
    ]
  },
  "stats": {
    "totalTasks": 24,
    "completedTasks": 18,
    "inProgressTasks": 4,
    "blockedTasks": 0,
    "overallProgress": 78
  }
}
```

---

### 10.2 Create or Activate Plan
- **URL**: `/api/plan`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "name": "২০২৬ Q4 ৯০ দিনের এক্সিলারেশন প্ল্যান",
  "start_date": "2026-10-01",
  "status": "ACTIVE"
}
```

#### Sample Success Response (`201 Created`)
```json
{
  "success": true,
  "plan": {
    "id": "p11029a1-0982-4112-9901-ac812019a002",
    "name": "২০২৬ Q4 ৯০ দিনের এক্সিলারেশন প্ল্যান",
    "start_date": "2026-10-01",
    "status": "ACTIVE"
  }
}
```

---

### 10.3 Add Task to Plan Phase
- **URL**: `/api/plan/task` (or `/api/plan/tasks`)
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "phase_id": "ph1-id",
  "title_bn": "১০টি প্রিমিয়াম রেস্তোরাঁয় ভিজিট ও স্যাম্পল প্রদান",
  "title_en": "Sample distribution to 10 premium restaurants",
  "owner_id": "e2a14e9f-92bd-482a-bc9e-63f538eec101",
  "due_date": "2026-10-28",
  "status": "IN_PROGRESS",
  "progress_percent": 40
}
```

#### Sample Success Response (`201 Created`)
```json
{
  "success": true,
  "task": {
    "id": "tk-99012a11-0982-4112-9901-ac812019a001",
    "phase_id": "ph1-id",
    "title_bn": "১০টি প্রিমিয়াম রেস্তোরাঁয় ভিজিট ও স্যাম্পল প্রদান",
    "status": "IN_PROGRESS",
    "progress_percent": 40
  }
}
```

---

### 10.4 Update Task Progress & Status
- **URL**: `/api/plan/task/[id]` (or `/api/plan/tasks/[id]`)
- **Method**: `PATCH` / `PUT`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "status": "DONE",
  "progress_percent": 100,
  "outcome_note": "১০টি রেস্তোরাঁ সম্পন্ন, ৪টি অর্ডার প্রাপ্তি নিশ্চিত।"
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "task": {
    "id": "tk-99012a11-0982-4112-9901-ac812019a001",
    "status": "DONE",
    "progress_percent": 100,
    "outcome_note": "১০টি রেস্তোরাঁ সম্পন্ন, ৪টি অর্ডার প্রাপ্তি নিশ্চিত।"
  }
}
```

---

### 10.5 Review Plan Milestone
Review and evaluate milestone outcomes (`PENDING`, `MET`, `PARTIAL`, `MISSED`).

- **URL**: `/api/plan/milestone/[id]` (or `/api/plan/milestones/[id]`)
- **Method**: `PATCH` / `PUT`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "status": "MET",
  "achieved_result": "টার্গেট ছিল ৫০ কেজি, বাস্তবে ৬২ কেজি সরবরাহ সম্পন্ন হয়েছে।"
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "milestone": {
    "id": "ms-1",
    "status": "MET",
    "achieved_result": "টার্গেট ছিল ৫০ কেজি, বাস্তবে ৬২ কেজি সরবরাহ সম্পন্ন হয়েছে।",
    "reviewed_at": "2026-10-25T07:00:00.000Z"
  }
}
```

---

## 11. Settings & Administration APIs

### 11.1 Get Scoring & System Settings
Retrieve system settings: 5 scoring section weights (must sum to 100%), achievement cap, failing threshold, undo enable/disable, employee edit window days, report day, and language style.

- **URL**: `/api/admin/settings`
- **Method**: `GET`
- **Auth Required**: `ADMIN`

#### Sample Success Response (`200 OK`)
```json
{
  "settings": {
    "id": "default",
    "section_weights": {
      "SALES_PROFIT": 30,
      "CONTENT": 20,
      "NEW_BUYERS_B2B": 20,
      "RETENTION": 15,
      "INBOX_FOLLOWUP": 15
    },
    "achievement_cap": 1.0,
    "failing_threshold": 0.8,
    "undo_enabled": true,
    "employee_edit_window_days": 1,
    "weekly_report_day": "SUNDAY",
    "weekly_report_time": "09:00",
    "language_default": "bn",
    "digit_style": "bn"
  }
}
```

---

### 11.2 Update Scoring & System Settings
Update configuration parameters. Validates that section weights sum exactly to 100.

- **URL**: `/api/admin/settings`
- **Method**: `POST` (or `PUT`)
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "section_weights": {
    "SALES_PROFIT": 35,
    "CONTENT": 20,
    "NEW_BUYERS_B2B": 15,
    "RETENTION": 15,
    "INBOX_FOLLOWUP": 15
  },
  "achievement_cap": 1.0,
  "failing_threshold": 0.8,
  "undo_enabled": true,
  "employee_edit_window_days": 2
}
```

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "সিস্টেম সেটিংস সফলভাবে আপডেট করা হয়েছে",
  "settings": {
    "id": "default",
    "section_weights": {
      "SALES_PROFIT": 35,
      "CONTENT": 20,
      "NEW_BUYERS_B2B": 15,
      "RETENTION": 15,
      "INBOX_FOLLOWUP": 15
    },
    "employee_edit_window_days": 2
  }
}
```

#### Error Status Codes
- `400 Bad Request`: Weights do not sum to 100 (`"সেকশন ওয়েটগুলোর যোগফল অবশ্যই ঠিক ১০০ হতে হবে"`).

---

## 12. Audit Trail APIs

### 12.1 Query Audit Logs
Search through immutable system audit records with pagination and filters by actor, action, entity type, and date range.

- **URL**: `/api/admin/audit`
- **Method**: `GET`
- **Auth Required**: `ADMIN`
- **Query Parameters**:
  - `actor_id` *(optional)*: User ID of actor.
  - `action` *(optional)*: `LOGIN`, `CREATE`, `UPDATE`, `DELETE`, `UNDO`, `REPORT_PUBLISH`, `TARGET_SET`, etc.
  - `entity` *(optional)*: Filter by entity type (`User`, `Lead`, `LinkCompletion`, `GroupSection`, etc.).
  - `startDate` / `endDate`: Filter by ISO date strings.
  - `page`: Page number (default: 1).
  - `limit`: Records per page (default: 25, max: 100).

#### Sample Success Response (`200 OK`)
```json
{
  "logs": [
    {
      "id": "aud-99012a11-0982-4112-9901-ac812019a001",
      "actor_id": "e2a14e9f-92bd-482a-bc9e-63f538eec101",
      "actor": {
        "id": "e2a14e9f-92bd-482a-bc9e-63f538eec101",
        "name": "রাকিব হাসান",
        "email": "rakib@company.com",
        "role": "EMPLOYEE"
      },
      "action": "UNDO",
      "entity": "LinkCompletion",
      "entity_id": "dc881a20-0982-4fa1-8891-91280ab01923",
      "payload": {
        "groupLinkId": "a918f4a1-0e1f-4efc-8b89-21b9201a0099"
      },
      "created_at": "2026-10-25T06:15:00.000Z"
    }
  ],
  "pagination": {
    "total": 340,
    "page": 1,
    "limit": 25,
    "totalPages": 14
  }
}
```

---

## 13. Leaderboard & Performance Dashboard APIs

### 13.1 Employee Performance & Leaderboard Data
Retrieve employee scoring calculations across the 5 dimensions, 14-day historical performance trends, product sales breakdowns, and team ranking. (Documented under `/api/employee/performance` and alias `/api/employee/leaderboard`).

- **URL**: `/api/employee/performance`
- **Method**: `GET`
- **Auth Required**: `ADMIN` or `EMPLOYEE`
- **Query Parameters**:
  - `period`: `daily`, `weekly`, or `monthly` (default: `monthly`).
  - `date`: Reference date (defaults to today in Dhaka).
  - `employee_id` *(Admin only)*: Target employee ID to inspect.

#### Sample Success Response (`200 OK`)
```json
{
  "period": "monthly",
  "start_date": "2026-10-01",
  "end_date": "2026-10-31",
  "assigned_sections": ["মাশরুম চাষি ও খামারি গ্রুপ"],
  "score_result": {
    "totalScore": 94.5,
    "isPassing": true,
    "sections": {
      "SALES_PROFIT": { "weight": 30, "achievedRate": 1.0, "weightedScore": 30.0 },
      "CONTENT": { "weight": 20, "achievedRate": 0.95, "weightedScore": 19.0 },
      "NEW_BUYERS_B2B": { "weight": 20, "achievedRate": 0.90, "weightedScore": 18.0 },
      "RETENTION": { "weight": 15, "achievedRate": 0.90, "weightedScore": 13.5 },
      "INBOX_FOLLOWUP": { "weight": 15, "achievedRate": 0.93, "weightedScore": 14.0 }
    }
  },
  "trend": [
    { "date": "10-23", "score": 92.0, "sales": 11000, "posts": 22 },
    { "date": "10-24", "score": 95.0, "sales": 13500, "posts": 26 },
    { "date": "10-25", "score": 94.5, "sales": 12500, "posts": 25 }
  ],
  "product_sales": [
    { "name_bn": "তাজা বাটন মাশরুম", "quantity": 120, "amount": 60000 },
    { "name_bn": "অয়েস্টার মাশরুম", "quantity": 85, "amount": 25500 }
  ]
}
```

---

## 14. Products & Campaigns APIs

### 14.1 List Products
- **URL**: `/api/products`
- **Method**: `GET`
- **Auth Required**: `ADMIN` or `EMPLOYEE`
- **Query Parameters**: `all=true` *(Admin only, includes deactivated products)*

#### Sample Success Response (`200 OK`)
```json
{
  "products": [
    {
      "id": "78091a11-8891-4401-bc81-229081a9f001",
      "name_bn": "তাজা বাটন মাশরুম",
      "name_en": "Fresh Button Mushroom",
      "unit": "kg",
      "selling_price": "500.00",
      "is_active": true
    }
  ]
}
```

---

### 14.2 Create Product
- **URL**: `/api/products`
- **Method**: `POST`
- **Auth Required**: `ADMIN`

#### Request Body
```json
{
  "name_bn": "ড্রাইড অয়েস্টার মাশরুম",
  "name_en": "Dried Oyster Mushroom",
  "unit": "packet",
  "selling_price": 250,
  "is_active": true
}
```

#### Sample Success Response (`201 Created`)
```json
{
  "success": true,
  "product": {
    "id": "78091a11-8891-4401-bc81-229081a9f002",
    "name_bn": "ড্রাইড অয়েস্টার মাশরুম",
    "selling_price": 250
  }
}
```

---

### 14.3 List Marketing Campaigns
- **URL**: `/api/campaigns`
- **Method**: `GET`
- **Auth Required**: `ADMIN` or `EMPLOYEE`

#### Sample Success Response (`200 OK`)
```json
{
  "campaigns": [
    {
      "id": "c9012a11-0982-4112-9901-ac812019a001",
      "name": "অক্টোবর মাশরুম বুস্টিং",
      "channel": "FACEBOOK_AD",
      "budget_amount": 40000,
      "status": "RUNNING",
      "leads_count": 52
    }
  ]
}
```

---

## 15. Scheduled Cron Job Endpoints

### 15.1 Daily Lock Cron Trigger
Verifies and enforces the daily performance locking rule in `Asia/Dhaka` timezone. Any day older than the edit window (`today - editWindowDays`) is locked from modifications.

- **URL**: `/api/cron/daily-lock`
- **Method**: `GET` or `POST`
- **Auth Required**: Bearer Secret Header (`Authorization: Bearer <CRON_SECRET>`)

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Daily lock executed for Asia/Dhaka timezone",
  "activeDhakaDate": "2026-10-25",
  "editWindowDays": 1,
  "lockedBeforeDate": "2026-10-24"
}
```

---

### 15.2 Weekly Report Draft Generator Cron Trigger
Runs every Sunday at 09:00 AM (Dhaka time). Automatically aggregates the previous completed week's data (Sunday to Saturday) across all metrics, compiles automated answers for Questions 1, 2, and 3, and creates a `DRAFT` `WeeklyReport` ready for Admin review. (Also accessible via `/api/cron/weekly-report`).

- **URL**: `/api/cron/weekly-report-draft` (or `/api/cron/weekly-report`)
- **Method**: `GET` or `POST`
- **Auth Required**: Bearer Secret Header (`Authorization: Bearer <CRON_SECRET>`)

#### Sample Success Response (`200 OK`)
```json
{
  "message": "Weekly report draft created for week 2026-10-18 to 2026-10-24",
  "reportId": "w10924a1-0982-4112-9901-ac812019a001",
  "status": "DRAFT",
  "questionsCreated": 5
}
```

#### Error Status Codes
- `401 Unauthorized`: Missing or invalid `CRON_SECRET`.
