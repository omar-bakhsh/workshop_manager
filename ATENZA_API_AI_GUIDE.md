# 🤖 ATENZA WORKSHOP REST API & DATABASE INTEGRATION SPECIFICATION
> **System Prompt for AI Assistants & Senior Android Developer Integration Guide**
> **Application:** Atenza App (مركزأتينزا - فرع كيلو14)
> **Engine:** RESTful JSON API v1.0 & Bidirectional Sync Engine v2.0
> **Architecture:** Offline-First Android (Kotlin + Room + Retrofit 2 + Coroutines + WorkManager)
> **Developer & Programmer:** م. عمر
> **Generated At:** 2026-10-03T09:44:58.842Z

---

## 🧭 ROLE & OBJECTIVE FOR THE AI ASSISTANT (تعليمات النظام للذكاء الاصطناعي)

You are acting as an expert Senior Android Software Architect and Kotlin Engineer. You are provided with the complete, ground-truth schema, RESTful API specifications, and database dictionary for the **Atenza App** workshop management system.

### Guiding Rules When Assisting the Developer:
1. **Strict Data Accuracy**: When generating Android entities, DTOs, Room DAOs, or queries, adhere strictly to the exact column names, data types, and primary keys provided in the **Database Tables Dictionary** below. Never invent arbitrary columns.
2. **Offline-First Resilience**: Mobile devices inside automotive workshops frequently lose Wi-Fi. Always prioritize an offline-first architecture where the Android application writes to a local Room Database immediately, and queues network sync requests using Android `WorkManager` or background coroutines.
3. **API Key Transmission**: Always include the `x-api-key` header in every Retrofit request.
4. **Batch Synchronization**: For syncing large datasets or offline queues, utilize the batch sync endpoints (`GET /api/v1/sync/pull` and `POST /api/v1/sync/push`) to preserve battery and reduce network round-trips.
5. **Password Redaction**: Notice that the `users` table in this API automatically redacts password hashes. Never expect or send unencrypted passwords.

---

## 🌐 1. NETWORK & CONNECTION MATRIX (عناوين وخوادم الاتصال)

The server runs locally on port `8080` and serves the REST API under `/api/v1`. Depending on the Android runtime environment, use the appropriate base URL:

| Target Environment | Base URL | Description & Instructions |
|---|---|---|
| **Android Studio Emulator** | `http://10.0.2.2:8080/api/v1/` | Android emulator loopback IP that resolves to the host machine's `127.0.0.1` |
| **Physical Android Phone (Wi-Fi)** | `http://192.168.8.112:8080/api/v1/` | Connect phone and host PC to the same Wi-Fi network |
| **Public Domain / Production VPS** | `https://<your-domain-or-ip>/api/v1/` | Cloud production URL with reverse proxy and SSL certificate |
| **Host PC (Local Browser/Postman)** | `http://127.0.0.1:8080/api/v1/` | Direct local testing URL on the host machine |

> 💡 **Important Android Manifest Configuration (`AndroidManifest.xml`)**:
> Because local development occurs over HTTP, ensure your `AndroidManifest.xml` allows cleartext traffic for local subnets:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config"
        ... >
    </application>
</manifest>
```

---

## 🔐 2. AUTHENTICATION & SECURITY (المصادقة والأمان)

The API secures all CRUD endpoints with an API Key verification middleware. Health checks (`/ping`) and documentation metadata (`/meta/*`) are public.

- **Active Workshop Mobile API Key**: `atenza_apk_35d4210d094cffa26e26835938901b8f`
- **API Status**: `Enabled (نشط ومفعل)`

### How to Send the API Key in Android Requests:
1. **HTTP Header (Recommended)**:
   ```http
   x-api-key: atenza_apk_35d4210d094cffa26e26835938901b8f
   ```
2. **Authorization Bearer Header**:
   ```http
   Authorization: Bearer atenza_apk_35d4210d094cffa26e26835938901b8f
   ```
3. **Query Parameter (Fallback)**:
   ```http
   GET /api/v1/db/inspections?api_key=atenza_apk_35d4210d094cffa26e26835938901b8f
   ```

---

## 🚀 3. RESTFUL API ENDPOINTS SPECIFICATION (المسارات والعمليات)

### 3.1 System Discovery & Health Check

#### `GET /api/v1/ping`
- **Purpose**: Verifies server connection, returns server timestamp, active workshop details, and local network IPs.
- **Response Example**:
```json
{
  "success": true,
  "status": "online",
  "message": "Workshop Manager Android REST API is operational 🚀",
  "app_name": "Atenza App",
  "workshop_name": "مركزأتينزا - فرع كيلو14",
  "version": "2.0.0",
  "total_tables_available": 27
}
```

#### `GET /api/v1/meta/schema`
- **Purpose**: Returns the real-time SQLite/MySQL schema for all tables, column types, nullability, and primary keys.

#### `GET /api/v1/meta/tables`
- **Purpose**: Returns a list of all 27 supported tables with their primary keys and current live record counts.

#### `GET /api/v1/meta/ai-guide`
- **Purpose**: Generates this exact Markdown specification (`?format=markdown`) or structured JSON (`?format=json`) dynamically.

### 3.2 Dynamic Database CRUD Endpoints

You can perform complete CRUD operations on any of the **27 tables** using the standardized `/api/v1/db/:table` routes:

#### A. [PULL] Get Records List: `GET /api/v1/db/:table`
- **Query Parameters**:
  - `limit` (integer, default: 200, max: 2000): Number of rows to return.
  - `offset` (integer, default: 0): Pagination offset.
  - `sort` (string): Column to sort by (e.g. `id`, `created_at`, `name`).
  - `order` (string): `ASC` or `DESC` (default: `DESC`).
  - `search` (string): Full-text wildcard search across text columns.
  - Column filters: Any valid column name can be passed directly as a query parameter (e.g., `?status=in_progress&client_id=12`).
- **Example Request**:
  `GET /api/v1/db/inspections?status=completed&limit=10&sort=id&order=DESC`
- **Response Format**:
```json
{
  "success": true,
  "table": "inspections",
  "count": 10,
  "total": 142,
  "limit": 10,
  "offset": 0,
  "primary_key": "id",
  "data": [ /* Array of records */ ]
}
```

#### B. [PULL ONE] Get Single Record: `GET /api/v1/db/:table/:id`
- **Purpose**: Fetches a single record by primary key (ID or key).
- **Example Request**:
  `GET /api/v1/db/clients/5`
- **Response Format**:
```json
{
  "success": true,
  "table": "clients",
  "primary_key": "id",
  "id": "5",
  "data": {
    "id": 5,
    "name": "عبدالله محمد السالم",
    "phone": "0501234567",
    "national_id": "1098765432",
    "created_at": "2026-03-01 10:15:00"
  }
}
```

#### C. [PUSH] Create New Record: `POST /api/v1/db/:table`
- **Purpose**: Inserts a new record (or array of records for batch insertion).
- **Request Body (Single)**:
```json
{
  "plate_number": "أ ب ج 1234",
  "car_model": "تويوتا كامري 2023",
  "client_id": 5,
  "chassis_number": "JTDKN3DU5A0123456",
  "odometer": 45000,
  "status": "pending",
  "total_amount": 350.00
}
```
- **Response Format**:
```json
{
  "success": true,
  "message": "1 record(s) inserted successfully into 'inspections'",
  "inserted_id": 143,
  "data": { "id": 143, /* inserted record */ }
}
```

#### D. [EDIT] Update Record: `PUT /api/v1/db/:table/:id`
- **Purpose**: Updates specific fields of an existing record.
- **Request Body**:
```json
{
  "status": "completed",
  "paid_amount": 350.00,
  "payment_method": "شبكة مدى",
  "notes": "تم الانتهاء من فحص المحرك وفحص الكمبيوتر وتغيير الزيت"
}
```
- **Response Format**:
```json
{
  "success": true,
  "message": "Record with id=143 in 'inspections' updated successfully",
  "updated_fields": ["status", "paid_amount", "payment_method", "notes"]
}
```

#### E. [DELETE] Delete Record: `DELETE /api/v1/db/:table/:id`
- **Purpose**: Permanently removes a record by ID.
- **Response Format**:
```json
{
  "success": true,
  "message": "Record with id=143 deleted successfully from 'inspections'"
}
```

### 3.3 Bidirectional Synchronization Endpoints (Offline-First Sync Engine)

#### A. [SYNC PULL] Pull Changes: `GET /api/v1/sync/pull`
- **Purpose**: Pulls complete or incremental updates across multiple tables simultaneously for offline caching.
- **Query Parameters**:
  - `since` (string, optional): ISO 8601 or SQLite timestamp (e.g. `2026-03-01T00:00:00Z`). When supplied, only records created/updated after this date are returned.
  - `tables` (string, optional): Comma-separated list of tables to pull (e.g. `inspections,clients,services,cash_box_entries`). If omitted, all 27 tables are pulled.
  - `limit_per_table` (integer, default: 2000).
- **Response Format**:
```json
{
  "success": true,
  "version": "2.0.0",
  "exported_at": "2026-03-03T09:40:00.000Z",
  "synced_tables": 4,
  "tables": {
    "inspections": [ /* rows */ ],
    "clients": [ /* rows */ ],
    "services": [ /* rows */ ],
    "cash_box_entries": [ /* rows */ ]
  }
}
```

#### B. [SYNC PUSH] Batch Push Changes: `POST /api/v1/sync/push`
- **Purpose**: Pushes a dictionary of modified or created records from the mobile SQLite/Room cache to the server in a single atomic transaction. Existing records are updated via `REPLACE INTO`.
- **Request Body**:
```json
{
  "tables": {
    "inspections": [
      { "id": 144, "plate_number": "د هـ و 9876", "car_model": "نيسان باترول 2022", "status": "completed" }
    ],
    "cash_box_entries": [
      { "id": 89, "type": "income", "amount": 500.00, "category": "أجور فحص", "date": "2026-03-03" }
    ]
  }
}
```
- **Response Format**:
```json
{
  "success": true,
  "message": "Batch sync push completed successfully",
  "summary": {
    "inspections": { "status": "success", "synced_count": 1 },
    "cash_box_entries": { "status": "success", "synced_count": 1 }
  }
}
```

---

## 📊 4. DATABASE TABLES DICTIONARY (قاموس الجداول الـ 27 بالتفصيل)

Below is the complete database dictionary containing all 27 tables, column definitions, data types, and primary keys:

### 4.1 جدول `inspections` (أوامر العمل وفحص المركبات - Vehicle Inspections & Work Orders)
- **الوصف**: الجدول الرئيسي لبطاقات الفحص ودخول المركبات، يحتوي على رقم اللوحة، رقم الشاصي (VIN)، الممشى، بيانات السيارة، حالة الأمر (pending, in_progress, completed, cancelled)، إجمالي المبالغ، والخصومات.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 23 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `inspector_id` | `INTEGER` | نعم (YES) | — | — |
| `customer_name` | `TEXT` | لا (NULL) | — | — |
| `customer_phone` | `TEXT` | لا (NULL) | — | — |
| `car_type` | `TEXT` | لا (NULL) | — | — |
| `car_color` | `TEXT` | لا (NULL) | — | — |
| `car_model` | `TEXT` | لا (NULL) | — | — |
| `plate_number` | `TEXT` | لا (NULL) | — | — |
| `total_amount` | `REAL` | لا (NULL) | `0` | — |
| `vat_amount` | `REAL` | لا (NULL) | `0` | — |
| `final_amount` | `REAL` | لا (NULL) | `0` | — |
| `paid_amount` | `REAL` | لا (NULL) | `0` | — |
| `remaining_amount` | `REAL` | لا (NULL) | `0` | — |
| `created_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |
| `status` | `TEXT` | لا (NULL) | `'new'` | — |
| `assigned_technician_id` | `INTEGER` | لا (NULL) | — | — |
| `job_order_notes` | `TEXT` | لا (NULL) | — | — |
| `car_defects_diagram` | `TEXT` | لا (NULL) | — | — |
| `car_status` | `TEXT` | لا (NULL) | `'in_progress'` | — |
| `odometer` | `TEXT` | لا (NULL) | — | — |
| `vin` | `TEXT` | لا (NULL) | — | — |
| `discount_code` | `VARCHAR(100)` | لا (NULL) | — | — |
| `discount_amount` | `DOUBLE` | لا (NULL) | `0` | — |
| `discount_type` | `VARCHAR(50)` | لا (NULL) | — | — |
| `discount_value` | `DOUBLE` | لا (NULL) | `0` | — |
| `invoice_number` | `VARCHAR(100)` | لا (NULL) | — | — |
| `invoiced_at` | `DATETIME` | لا (NULL) | — | — |
| `payment_method` | `VARCHAR(50)` | لا (NULL) | `'cash'` | — |
| `zatca_uuid` | `VARCHAR(100)` | لا (NULL) | — | — |
| `zatca_hash` | `TEXT` | لا (NULL) | — | — |
| `zatca_status` | `VARCHAR(50)` | لا (NULL) | `'draft'` | — |

### 4.2 جدول `inspection_items` (بنود وتفاصيل الفحص - Inspection Checklist Items)
- **الوصف**: عناصر الفحص الفردية التابعة لأمر العمل (اسم البند، الحالة: سليم/يحتاج استبدال/تم الإصلاح، السعر، ملاحظات الفني). مرتبط بـ inspection_id.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 199 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `inspection_id` | `INTEGER` | نعم (YES) | — | — |
| `category` | `TEXT` | لا (NULL) | — | — |
| `service_description` | `TEXT` | لا (NULL) | — | — |
| `quantity` | `INTEGER` | لا (NULL) | `1` | — |
| `price` | `REAL` | لا (NULL) | `0` | — |
| `total` | `REAL` | لا (NULL) | `0` | — |
| `is_completed` | `INTEGER` | لا (NULL) | `0` | — |
| `completed_at` | `DATETIME` | لا (NULL) | — | — |
| `completed_by` | `TEXT` | لا (NULL) | — | — |

### 4.3 جدول `inspection_photos` (صور توثيق الفحص - Inspection Photos & Documentation)
- **الوصف**: الصور المرفقة ببطاقة فحص المركبة قبل وأثناء وبعد الإصلاح مع تحديد الجزء والملاحظات. مرتبط بـ inspection_id.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 0 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `inspection_id` | `INTEGER` | نعم (YES) | — | — |
| `photo_type` | `TEXT` | لا (NULL) | `'before'` | — |
| `file_path` | `TEXT` | نعم (YES) | — | — |
| `caption` | `TEXT` | لا (NULL) | — | — |
| `created_at` | `DATETIME` | لا (NULL) | `CURRENT_TIMESTAMP` | — |

### 4.4 جدول `inspection_technicians` (فنيي أمر العمل - Assigned Technicians)
- **الوصف**: ربط الفنيين والميكانيكيين بأمر العمل مع تحديد حصة أو نسبة الإنجاز وشغل اليد. مرتبط بـ inspection_id و employee_id.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 5 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `inspection_id` | `INTEGER` | نعم (YES) | — | — |
| `technician_id` | `INTEGER` | نعم (YES) | — | — |

### 4.5 جدول `inspection_bundles` (باقات الفحص الجاهزة - Inspection Packages / Bundles)
- **الوصف**: باقات الفحص المعرفة مسبقاً في المركز مثل (الفحص الشامل، فحص كمبيوتر، فحص القير والمحرك، فحص الشراء).
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 23 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `name` | `TEXT` | نعم (YES) | — | — |
| `icon` | `TEXT` | لا (NULL) | — | — |

### 4.6 جدول `inspection_bundle_items` (بنود باقات الفحص - Bundle Items Details)
- **الوصف**: تفاصيل البنود الافتراضية التابعة لكل باقة فحص لإضافتها دفعة واحدة لأمر العمل.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 454 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `bundle_id` | `INTEGER` | نعم (YES) | — | — |
| `service_description` | `TEXT` | نعم (YES) | — | — |
| `category` | `TEXT` | لا (NULL) | — | — |

### 4.7 جدول `inspection_terms` (الشروط والأحكام والضمانات - Terms, Conditions & Warranty)
- **الوصف**: الشروط القانونية والضمانات المطبوعة على كروت أوامر العمل وسندات التسليم للعملاء.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 143 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `term` | `TEXT` | نعم (YES) | — | — |

### 4.8 جدول `clients` (سجل العملاء والشركات - Customers & Fleet Directory)
- **الوصف**: دليل العملاء والشركات (الاسم، رقم الجوال، الهوية الوطنية أو الرقم الضريبي، العنوان، الملاحظات، الرصيد).
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 10162 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `name` | `TEXT` | نعم (YES) | — | — |
| `phone` | `TEXT` | نعم (YES) | — | — |
| `intl_phone` | `TEXT` | لا (NULL) | — | — |
| `notes` | `TEXT` | لا (NULL) | — | — |
| `created_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |
| `updated_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |

### 4.9 جدول `employees` (سجل الموظفين والفنيين - Employees & Technicians)
- **الوصف**: ملفات الموظفين، التخصصات، الراتب الأساسي، التارجت، نسبة الدخل، البنك، والحسابات المالية.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 37 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `name` | `TEXT` | نعم (YES) | — | — |
| `section_id` | `INTEGER` | لا (NULL) | — | — |
| `target` | `INTEGER` | نعم (YES) | `0` | — |
| `base_salary` | `INTEGER` | لا (NULL) | `0` | — |
| `is_active` | `INTEGER` | لا (NULL) | `1` | — |
| `hide_income` | `INTEGER` | لا (NULL) | `0` | — |
| `target_amount` | `REAL` | لا (NULL) | `0` | — |
| `deposit_amount` | `REAL` | لا (NULL) | `0` | — |
| `total_withdrawals` | `REAL` | لا (NULL) | `0` | — |
| `remaining_salary` | `REAL` | لا (NULL) | `0` | — |
| `net_remaining` | `REAL` | لا (NULL) | `0` | — |
| `bank_type` | `TEXT` | لا (NULL) | — | — |
| `bank_name` | `TEXT` | لا (NULL) | `'كاش'` | — |
| `last_sync_at` | `TIMESTAMP` | لا (NULL) | — | — |

### 4.10 جدول `sections` (أقسام وتخصصات الورشة - Workshop Departments & Sections)
- **الوصف**: أقسام المركز (ميكانيكا عامة، كهرباء وتشخيص كمبيوتر، فحص سريان سوائل، سمكرة ودهان، صيانة دورية).
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 8 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `name` | `TEXT` | نعم (YES) | — | — |
| `shift_start` | `VARCHAR(20)` | لا (NULL) | `'08:00'` | — |
| `shift_end` | `VARCHAR(20)` | لا (NULL) | `'18:00'` | — |
| `can_view_income` | `TINYINT` | لا (NULL) | `1` | — |
| `can_withdraw` | `TINYINT` | لا (NULL) | `1` | — |
| `can_inspect` | `TINYINT` | لا (NULL) | `0` | — |
| `can_manage_parts` | `TINYINT` | لا (NULL) | `0` | — |
| `permissions` | `TEXT` | لا (NULL) | — | — |
| `can_job_orders` | `TINYINT` | لا (NULL) | `0` | — |
| `target_enabled` | `TINYINT` | لا (NULL) | `1` | — |
| `target_type` | `VARCHAR(50)` | لا (NULL) | `'percentage'` | — |
| `target_percent` | `DOUBLE` | لا (NULL) | `100` | — |
| `default_target` | `DOUBLE` | لا (NULL) | `0` | — |

### 4.11 جدول `banks` (البنوك وطرق الدفع والصناديق - Banks, POS & Payment Methods)
- **الوصف**: الحسابات البنكية، الخزينة النقدية (الكاش)، نقاط البيع (مدى / فيزا)، والحسابات الدائنة.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 4 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `name` | `TEXT` | نعم (YES) | — | — |
| `is_default` | `INTEGER` | لا (NULL) | `0` | — |
| `created_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |

### 4.12 جدول `services` (دليل الخدمات والأجور - Services Catalog & Standard Rates)
- **الوصف**: قائمة الخدمات الافتراضية بالمركز مع الأجور القياسية لسرعة إدراجها في أوامر الفحص.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 70 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `category` | `TEXT` | نعم (YES) | — | — |
| `service_name` | `TEXT` | نعم (YES) | — | — |
| `price` | `REAL` | لا (NULL) | `0` | — |

### 4.13 جدول `cash_box_entries` (سندات الخزينة والصندوق اليومي - Daily Cash Box Transactions)
- **الوصف**: سجل سندات القبض والصرف بالخزينة، الفئات، أرقام السندات، الحساب البنكي، والمبالغ المقبوضة أو المصروفة.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 3 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `entry_type` | `TEXT` | نعم (YES) | — | — |
| `payment_method` | `TEXT` | لا (NULL) | `'cash'` | — |
| `amount` | `REAL` | نعم (YES) | — | — |
| `category` | `TEXT` | لا (NULL) | — | — |
| `description` | `TEXT` | نعم (YES) | — | — |
| `job_order_id` | `INTEGER` | لا (NULL) | — | — |
| `created_by` | `TEXT` | لا (NULL) | `'admin'` | — |
| `balance_before` | `REAL` | لا (NULL) | `0` | — |
| `entry_date` | `DATE` | لا (NULL) | — | — |
| `entry_time` | `TEXT` | لا (NULL) | — | — |
| `created_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |

### 4.14 جدول `entries` (سجل العمليات والمداخيل - Income Entries Log)
- **الوصف**: حركات الإيرادات التشغيلية المنفذة ونسب الإنجاز المسجلة للموظفين.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 25 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `employee_id` | `INTEGER` | نعم (YES) | — | — |
| `section_id` | `INTEGER` | نعم (YES) | — | — |
| `income` | `INTEGER` | نعم (YES) | — | — |
| `details` | `TEXT` | لا (NULL) | — | — |
| `created_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |

### 4.15 جدول `withdrawals` (سحبيات وسلف الموظفين - Employee Advances & Withdrawals)
- **الوصف**: سلف وسحبيات الموظفين المؤقتة وخصميات الراتب مع حالة الموافقة الإدارية.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 9 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `employee_id` | `INTEGER` | نعم (YES) | — | — |
| `amount` | `INTEGER` | نعم (YES) | — | — |
| `reason` | `TEXT` | لا (NULL) | — | — |
| `created_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |
| `status` | `TEXT` | لا (NULL) | `'approved'` | — |
| `admin_note` | `TEXT` | لا (NULL) | — | — |
| `date` | `DATE` | لا (NULL) | `CURRENT_DATE` | — |
| `payment_method` | `TEXT` | لا (NULL) | `'cash'` | — |

### 4.16 جدول `absences` (سجل الغيابات والخصميات - Employee Absences Log)
- **الوصف**: سجل غياب وتأخر الموظفين وأيام الخصم والجزاءات.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 0 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `employee_id` | `INTEGER` | نعم (YES) | — | — |
| `date` | `DATE` | نعم (YES) | — | — |
| `reason` | `TEXT` | لا (NULL) | — | — |
| `created_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |

### 4.17 جدول `leave_requests` (طلبات الإجازات - Leave Requests & Approvals)
- **الوصف**: طلبات الإجازات السنوية والمرضية والاضطرارية وتواريخ البداية والنهاية والاعتماد.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 0 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `employee_id` | `INTEGER` | نعم (YES) | — | — |
| `leave_type` | `TEXT` | لا (NULL) | `'annual'` | — |
| `start_date` | `TEXT` | نعم (YES) | — | — |
| `end_date` | `TEXT` | نعم (YES) | — | — |
| `days_count` | `INTEGER` | نعم (YES) | — | — |
| `reason` | `TEXT` | لا (NULL) | — | — |
| `status` | `TEXT` | لا (NULL) | `'pending'` | — |
| `admin_notes` | `TEXT` | لا (NULL) | — | — |
| `created_at` | `TEXT` | لا (NULL) | `CURRENT_TIMESTAMP` | — |
| `updated_at` | `TEXT` | لا (NULL) | `CURRENT_TIMESTAMP` | — |
| `attachment_path` | `VARCHAR(255)` | لا (NULL) | — | — |
| `attachment_name` | `VARCHAR(255)` | لا (NULL) | — | — |

### 4.18 جدول `attendance` (سجل الحضور والانصراف - Daily Attendance Log)
- **الوصف**: سجل البصمة وتسجيل حضور وانصراف الموظفين اليومي وأوقات الدخول والخروج.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 22 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `employee_id` | `INTEGER` | نعم (YES) | — | — |
| `date` | `DATE` | لا (NULL) | `CURRENT_DATE` | — |
| `check_in` | `TIMESTAMP` | لا (NULL) | — | — |
| `check_out` | `TIMESTAMP` | لا (NULL) | — | — |
| `status` | `TEXT` | لا (NULL) | `'present'` | — |
| `late_minutes` | `INTEGER` | لا (NULL) | `0` | — |
| `overtime_minutes` | `INTEGER` | لا (NULL) | `0` | — |
| `total_hours` | `REAL` | لا (NULL) | `0` | — |
| `early_leaving_minutes` | `INTEGER` | لا (NULL) | `0` | — |
| `early_departure_minutes` | `INTEGER` | لا (NULL) | `0` | — |
| `shift_start` | `TEXT` | لا (NULL) | — | — |
| `shift_end` | `TEXT` | لا (NULL) | — | — |
| `delay_minutes` | `INTEGER` | لا (NULL) | `0` | — |
| `check_in_time` | `VARCHAR(50)` | لا (NULL) | — | — |
| `check_out_time` | `VARCHAR(50)` | لا (NULL) | — | — |

### 4.19 جدول `workshop_lifts` (رافعات ومسارات الورشة - Workshop Lifts & Service Bays)
- **الوصف**: رافعات الورشة والمسارات وحالتها الحالية (متاحة، مشغولة، قيد الصيانة) وتعيينها لأوامر العمل.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 5 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `TEXT` | لا (NULL) | — | 🔑 PK |
| `name` | `TEXT` | نعم (YES) | — | — |
| `status` | `TEXT` | لا (NULL) | `'idle'` | — |
| `technician_id` | `INTEGER` | لا (NULL) | — | — |
| `issue_description` | `TEXT` | لا (NULL) | — | — |
| `last_updated` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |

### 4.20 جدول `branch_shifts` (ورديات وفترات الدوام - Work Shifts & Schedules)
- **الوصف**: الفترات الصباحية والمسائية وساعات بدء وانتهاء الدوام.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 7 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `day_of_week` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `shift_start` | `TEXT` | لا (NULL) | `'08:00'` | — |
| `shift_end` | `TEXT` | لا (NULL) | `'18:00'` | — |
| `is_closed` | `INTEGER` | لا (NULL) | `0` | — |

### 4.21 جدول `work_schedule` (جدولة مواعيد الموظفين - Employee Work Schedule)
- **الوصف**: توزيع الموظفين والفنيين على أيام الأسبوع والورديات المختلفة.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 7 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `day_of_week` | `TEXT` | لا (NULL) | — | — |
| `start_time` | `TEXT` | لا (NULL) | — | — |
| `end_time` | `TEXT` | لا (NULL) | — | — |
| `is_closed` | `INTEGER` | لا (NULL) | `0` | — |

### 4.22 جدول `promo_codes` (كوبونات وأكواد الخصم - Promotional Promo Codes)
- **الوصف**: أكواد الخصومات الترويجية، نسبة أو مبلغ الخصم، وتاريخ الانتهاء والحد الأدنى.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 2 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `code` | `TEXT` | نعم (YES) | — | — |
| `discount_type` | `TEXT` | نعم (YES) | `'percentage'` | — |
| `discount_value` | `REAL` | نعم (YES) | `0` | — |
| `min_order_amount` | `REAL` | لا (NULL) | `0` | — |
| `max_discount_amount` | `REAL` | لا (NULL) | `NULL` | — |
| `usage_limit` | `INTEGER` | لا (NULL) | `NULL` | — |
| `times_used` | `INTEGER` | لا (NULL) | `0` | — |
| `is_active` | `INTEGER` | لا (NULL) | `1` | — |
| `start_date` | `TEXT` | لا (NULL) | — | — |
| `end_date` | `TEXT` | لا (NULL) | — | — |
| `description` | `TEXT` | لا (NULL) | — | — |
| `created_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |

### 4.23 جدول `messages` (سجل الرسائل والإشعارات - SMS & WhatsApp Messages)
- **الوصف**: سجل الرسائل النصية الموجهة للعملاء بتحديثات أوامر الفحص وجاهزية السيارة.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 17 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `employee_id` | `INTEGER` | نعم (YES) | — | — |
| `sender` | `TEXT` | نعم (YES) | — | — |
| `message` | `TEXT` | نعم (YES) | — | — |
| `is_read` | `INTEGER` | لا (NULL) | `0` | — |
| `created_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |

### 4.24 جدول `sys_notifications` (إشعارات النظام الداخلية - System Alerts & Notifications)
- **الوصف**: تنبيهات الإدارة والمسؤولين بمواعيد تجديد الإقامات والوثائق والمهام المعلقة.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 36 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `recipient_type` | `TEXT` | نعم (YES) | — | — |
| `recipient_id` | `INTEGER` | لا (NULL) | — | — |
| `title` | `TEXT` | لا (NULL) | — | — |
| `message` | `TEXT` | لا (NULL) | — | — |
| `type` | `TEXT` | لا (NULL) | `'info'` | — |
| `is_read` | `INTEGER` | لا (NULL) | `0` | — |
| `created_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |

### 4.25 جدول `employee_documents` (أرشيف وثائق الموظفين - Employee Documents & Files)
- **الوصف**: وثائق الموظفين (الهويات، رخص القيادة، عقود العمل، الإقامات) وتواريخ انتهائها.
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 1 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `employee_id` | `INTEGER` | نعم (YES) | — | — |
| `document_type` | `TEXT` | نعم (YES) | `'other'` | — |
| `title` | `TEXT` | نعم (YES) | — | — |
| `notes` | `TEXT` | لا (NULL) | — | — |
| `file_path` | `TEXT` | نعم (YES) | — | — |
| `file_name` | `TEXT` | نعم (YES) | — | — |
| `file_size` | `INTEGER` | لا (NULL) | `0` | — |
| `mime_type` | `TEXT` | لا (NULL) | — | — |
| `status` | `TEXT` | لا (NULL) | `'pending'` | — |
| `admin_notes` | `TEXT` | لا (NULL) | — | — |
| `created_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |
| `updated_at` | `TIMESTAMP` | لا (NULL) | `CURRENT_TIMESTAMP` | — |

### 4.26 جدول `users` (مستخدمي النظام والصلاحيات - System Users & Roles)
- **الوصف**: حسابات الدخول للنظام وصلاحيات الأدمن والمحاسبين (يتم حجب وإخفاء كلمات المرور تلقائياً في الـ API للأمان).
- **المفتاح الأساسي (Primary Key)**: `id`
- **عدد السجلات الحالي**: 23 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `id` | `INTEGER` | لا (NULL) | — | 🔑 PK |
| `employee_id` | `INTEGER` | لا (NULL) | — | — |
| `username` | `TEXT` | نعم (YES) | — | — |
| `password` | `TEXT` | نعم (YES) | — | — |
| `role` | `TEXT` | نعم (YES) | — | — |

### 4.27 جدول `settings` (إعدادات النظام العامة - System Configuration Store)
- **الوصف**: تكوين الورشة، الاسم، الشعار، الضريبة، الهاتف، مفاتيح الـ API بصيغة Key-Value.
- **المفتاح الأساسي (Primary Key)**: `key`
- **عدد السجلات الحالي**: 23 سجل

| اسم الحقل (Column) | النوع (Type) | إلزامي (Not Null) | الافتراضي (Default) | المفتاح (PK) |
|---|---|---|---|---|
| `key` | `TEXT` | لا (NULL) | — | 🔑 PK |
| `value` | `TEXT` | لا (NULL) | — | — |

---

## 📱 5. PRODUCTION ANDROID KOTLIN CODE SAMPLES (نماذج الأكواد الجاهزة للأندرويد)

### 5.1 Gradle Dependencies (`app/build.gradle.kts`)
```kotlin
dependencies {
    // Retrofit & Network
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // Room Database (Offline Cache)
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    kapt("androidx.room:room-compiler:$roomVersion")

    // WorkManager (Background Sync)
    implementation("androidx.work:work-runtime-ktx:2.9.0")
}
```

### 5.2 Retrofit API Client with Authentication Interceptor (`ApiClient.kt`)
```kotlin
package com.atenza.workshop.network

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {
    // Use 10.0.2.2:8080 for Emulator or host LAN IP (192.168.8.112:8080) for real device
    private const val BASE_URL = "http://10.0.2.2:8080/api/v1/"
    private const val API_KEY = "atenza_apk_35d4210d094cffa26e26835938901b8f"

    private val authInterceptor = Interceptor { chain ->
        val request = chain.request().newBuilder()
            .addHeader("x-api-key", API_KEY)
            .addHeader("Content-Type", "application/json")
            .addHeader("Accept", "application/json")
            .build()
        chain.proceed(request)
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val apiService: WorkshopApiService = retrofit.create(WorkshopApiService::class.java)
}
```

### 5.3 Retrofit Service Interface (`WorkshopApiService.kt`)
```kotlin
package com.atenza.workshop.network

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

interface WorkshopApiService {

    // 1. Health Ping
    @GET("ping")
    suspend fun ping(): Response<JsonObject>

    // 2. Dynamic PULL (List records with pagination & filters)
    @GET("db/{table}")
    suspend fun getRecords(
        @Path("table") table: String,
        @Query("limit") limit: Int = 100,
        @Query("offset") offset: Int = 0,
        @Query("sort") sort: String? = null,
        @Query("order") order: String? = "DESC",
        @Query("search") search: String? = null,
        @QueryMap filterMap: Map<String, String> = emptyMap()
    ): Response<JsonObject>

    // 3. Dynamic PULL ONE
    @GET("db/{table}/{id}")
    suspend fun getRecordById(
        @Path("table") table: String,
        @Path("id") id: String
    ): Response<JsonObject>

    // 4. Dynamic PUSH (Create record)
    @POST("db/{table}")
    suspend fun createRecord(
        @Path("table") table: String,
        @Body body: Any
    ): Response<JsonObject>

    // 5. Dynamic EDIT (Update record)
    @PUT("db/{table}/{id}")
    suspend fun updateRecord(
        @Path("table") table: String,
        @Path("id") id: String,
        @Body updates: JsonObject
    ): Response<JsonObject>

    // 6. Dynamic DELETE
    @DELETE("db/{table}/{id}")
    suspend fun deleteRecord(
        @Path("table") table: String,
        @Path("id") id: String
    ): Response<JsonObject>

    // 7. Full Offline SYNC PULL
    @GET("sync/pull")
    suspend fun syncPull(
        @Query("since") since: String? = null,
        @Query("tables") tables: String? = null
    ): Response<JsonObject>

    // 8. Batch Offline SYNC PUSH
    @POST("sync/push")
    suspend fun syncPush(
        @Body payload: JsonObject
    ): Response<JsonObject>
}
```

### 5.4 Data Models (`Models.kt`)
```kotlin
package com.atenza.workshop.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName

@Entity(tableName = "inspections")
data class InspectionEntity(
    @PrimaryKey val id: Long,
    @SerializedName("inspection_number") val inspectionNumber: String?,
    @SerializedName("plate_number") val plateNumber: String?,
    @SerializedName("car_model") val carModel: String?,
    @SerializedName("chassis_number") val chassisNumber: String?,
    @SerializedName("odometer") val odometer: Double?,
    @SerializedName("client_id") val clientId: Long?,
    @SerializedName("status") val status: String? = "pending",
    @SerializedName("total_amount") val totalAmount: Double? = 0.0,
    @SerializedName("paid_amount") val paidAmount: Double? = 0.0,
    @SerializedName("created_at") val createdAt: String?,
    @SerializedName("updated_at") val updatedAt: String?
)

@Entity(tableName = "cash_box_entries")
data class CashBoxEntity(
    @PrimaryKey val id: Long,
    @SerializedName("type") val type: String, // 'income' or 'expense'
    @SerializedName("amount") val amount: Double,
    @SerializedName("category") val category: String?,
    @SerializedName("description") val description: String?,
    @SerializedName("date") val date: String?,
    @SerializedName("receipt_no") val receiptNo: String?
)
```

---

## 🛠️ 6. TYPICAL WORKFLOWS & PRACTICAL RECIPES (سيناريوهات العمل)

### Recipe 1: Vehicle Check-In & Inspection Ticket
1. Lookup existing client: `GET /api/v1/db/clients?phone=0501234567`
2. If client does not exist, create: `POST /api/v1/db/clients`
3. Create inspection record: `POST /api/v1/db/inspections` with `client_id`
4. Insert checklist items: `POST /api/v1/db/inspection_items` passing array of items
5. Attach photos: `POST /api/v1/db/inspection_photos` with image base64/url and `inspection_id`

### Recipe 2: Daily Cash Box Transaction
1. To record income from a repair bill:
   `POST /api/v1/db/cash_box_entries`
   ```json
   {
     "type": "income",
     "amount": 250.00,
     "category": "صيانة دورية",
     "description": "استلام فاتورة كرت فحص رقم 143",
     "date": "2026-03-03",
     "bank_id": 1
   }
   ```

### Recipe 3: Bidirectional Offline Sync
1. **Pull Step**: Call `GET /api/v1/sync/pull?since={last_sync_timestamp}`. Save returned records into local Room database.
2. **Push Step**: Query local Room database for records marked with `is_dirty = 1` (created or edited offline). Send them to `POST /api/v1/sync/push`.
3. Mark records as synced locally upon receiving `success: true`.

---

**Atenza Workshop Management System** — Built with precision for automotive workshops. (برمجة وتطوير: م. عمر)
