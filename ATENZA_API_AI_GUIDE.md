# 🤖 ATENZA WORKSHOP REST API & DATABASE INTEGRATION SPECIFICATION
> **System Prompt for AI Assistants & Senior React Native Expo Developer Guide**
> **Application:** Atenza App (مركزأتينزا - فرع كيلو14)
> **Framework:** React Native Expo (SDK 51/52+, TypeScript, Axios, TanStack Query, Expo SQLite)
> **Engine:** RESTful JSON API v1.0 & Bidirectional Sync Engine v2.0
> **Platforms:** Cross-Platform (Android & iOS via React Native Expo)
> **Developer & Programmer:** م. عمر
> **Generated At:** 2026-10-03T09:57:58.730Z

---

## 🧭 ROLE & OBJECTIVE FOR THE AI ASSISTANT (تعليمات النظام للذكاء الاصطناعي)

You are acting as an expert Senior Mobile Architect & React Native Expo (TypeScript) Specialist. You are provided with the complete, ground-truth schema, RESTful API specifications, and database dictionary for the **Atenza App** workshop management system.

### Guiding Rules When Assisting the Developer:
1. **Target Stack**: Develop strictly using **React Native with Expo** (Managed Workflow with TypeScript, Axios for networking, TanStack Query / React Query for state management, and Expo SQLite or AsyncStorage for offline local storage).
2. **Strict Data Accuracy**: When generating TypeScript interfaces, API service calls, and form components, adhere strictly to the exact column names, data types, and primary keys provided in the **Database Tables Dictionary** below. Never invent arbitrary columns.
3. **Offline-First Resilience**: Mobile devices inside automotive workshops frequently lose Wi-Fi. Always prioritize an offline-first architecture where the React Native app caches data locally using `expo-sqlite` or `AsyncStorage`, and syncs changes using the batch sync endpoints (`GET /api/v1/sync/pull` and `POST /api/v1/sync/push`).
4. **API Key Transmission**: Always pass the `x-api-key` header in Axios default headers or interceptors.
5. **Clean UI & RTL**: Automotive technicians operate with Arabic-first RTL interfaces. Use clean React Native components with responsive styling, status badges, and pull-to-refresh.

---

## 🌐 1. NETWORK & CONNECTION MATRIX FOR REACT NATIVE EXPO

When running with Expo (`npx expo start`), choose the correct base URL depending on your development environment:

| Development Target | Base URL | How to Connect |
|---|---|---|
| **Physical Phone (Expo Go via Wi-Fi)** | `http://192.168.8.112:8080/api/v1/` | Phone & PC on same Wi-Fi. Scan Expo QR code with Expo Go app |
| **Android Studio Emulator** | `http://10.0.2.2:8080/api/v1/` | Android emulator loopback resolving to host machine's `127.0.0.1` |
| **iOS Simulator / Expo Web** | `http://localhost:8080/api/v1/` | Runs directly on macOS host loopback |
| **Production Server / VPS** | `https://<your-domain>/api/v1/` | Production cloud deployment over HTTPS |

> 💡 **Expo Configuration (`app.json` / `app.config.js`):**
> For Android builds over local HTTP, ensure cleartext traffic is enabled in your `app.json`:
```json
{
  "expo": {
    "name": "Atenza App",
    "slug": "atenza-workshop-app",
    "version": "1.0.0",
    "android": {
      "package": "com.atenza.workshop",
      "usesCleartextTraffic": true
    }
  }
}
```

---

## 🔐 2. AUTHENTICATION & SECURITY (المصادقة والأمان)

- **Active Workshop Mobile API Key**: `atenza_apk_35d4210d094cffa26e26835938901b8f`
- **API Status**: `Enabled (نشط ومفعل)`

### How to Configure Axios for React Native:
```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://192.168.8.112:8080/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-api-key': 'atenza_apk_35d4210d094cffa26e26835938901b8f',
  },
});
```

---

## 🚀 3. RESTFUL API ENDPOINTS SPECIFICATION (المسارات والعمليات)

### 3.1 System Discovery & Health Check

#### `GET /api/v1/ping`
- **Purpose**: Verifies server connection, returns server timestamp, active workshop details, and local network IPs.

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

#### B. [PULL ONE] Get Single Record: `GET /api/v1/db/:table/:id`
- **Purpose**: Fetches a single record by primary key (ID or key).
- **Example Request**: `GET /api/v1/db/clients/5`

#### C. [PUSH] Create New Record: `POST /api/v1/db/:table`
- **Purpose**: Inserts a new record (or array of records for batch insertion).

#### D. [EDIT] Update Record: `PUT /api/v1/db/:table/:id`
- **Purpose**: Updates specific fields of an existing record.

#### E. [DELETE] Delete Record: `DELETE /api/v1/db/:table/:id`
- **Purpose**: Permanently removes a record by ID.

### 3.3 Bidirectional Synchronization Endpoints (Offline-First Sync Engine)

#### A. [SYNC PULL] Pull Changes: `GET /api/v1/sync/pull`
- **Purpose**: Pulls complete or incremental updates across multiple tables simultaneously for offline caching in Expo SQLite or AsyncStorage.
- **Query Parameters**:
  - `since` (string, optional): ISO timestamp (e.g. `2026-03-01T00:00:00Z`). When supplied, only records created/updated after this date are returned.
  - `tables` (string, optional): Comma-separated list of tables to pull (e.g. `inspections,clients,services,cash_box_entries`).

#### B. [SYNC PUSH] Batch Push Changes: `POST /api/v1/sync/push`
- **Purpose**: Pushes an object containing modified or created records from React Native cache to the server in a single atomic transaction.

---

## 📊 4. DATABASE TABLES DICTIONARY (قاموس الجداول الـ 27 بالتفصيل)

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
- **عدد السجلات الحالي**: 71 سجل

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
- **المفتاح الأساسي (Primary Key)**: `day_of_week`
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

## 📱 5. PRODUCTION REACT NATIVE EXPO CODE SAMPLES (نماذج الأكواد الجاهزة لـ REACT NATIVE EXPO)

### 5.1 Project Dependencies (`package.json`)
```bash
# Initialize an Expo project (if starting new)
npx create-expo-app@latest atenza-mobile-app --template tabs
cd atenza-mobile-app

# Install required networking and offline storage libraries
npx expo install axios @tanstack/react-query @react-native-async-storage/async-storage expo-sqlite expo-network
```

### 5.2 TypeScript Interfaces for Database Entities (`src/types/database.ts`)
```typescript
// TypeScript Definitions matching Atenza Workshop Database

export interface Inspection {
  id: number;
  inspection_number?: string;
  plate_number: string;
  car_model?: string;
  chassis_number?: string;
  odometer?: number;
  client_id?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  total_amount?: number;
  paid_amount?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  national_id?: string;
  email?: string;
  notes?: string;
  created_at?: string;
}

export interface CashBoxEntry {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description?: string;
  date: string;
  bank_id?: number;
  receipt_no?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  table?: string;
  count?: number;
  total?: number;
  data: T;
  message?: string;
  error?: string;
}
```

### 5.3 Complete API Client Service (`src/api/workshopApi.ts`)
```typescript
import axios from 'axios';
import { ApiResponse, Inspection, Client, CashBoxEntry } from '../types/database';

// Configure baseURL (Physical phone Wi-Fi or emulator)
const BASE_URL = 'http://192.168.8.112:8080/api/v1';
const API_KEY = 'atenza_apk_35d4210d094cffa26e26835938901b8f';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-api-key': API_KEY,
  },
});

export const WorkshopApi = {
  // 1. Health Ping
  ping: () => api.get('/ping'),

  // 2. Generic PULL List
  getRecords: <T>(table: string, params?: Record<string, any>) =>
    api.get<ApiResponse<T[]>>(`/db/${table}`, { params }).then(r => r.data),

  // 3. Generic PULL ONE
  getRecordById: <T>(table: string, id: number | string) =>
    api.get<ApiResponse<T>>(`/db/${table}/${id}`).then(r => r.data),

  // 4. Generic PUSH Create
  createRecord: <T>(table: string, payload: Partial<T> | Partial<T>[]) =>
    api.post<ApiResponse<T>>(`/db/${table}`, payload).then(r => r.data),

  // 5. Generic EDIT Update
  updateRecord: <T>(table: string, id: number | string, updates: Partial<T>) =>
    api.put<ApiResponse<T>>(`/db/${table}/${id}`, updates).then(r => r.data),

  // 6. Generic DELETE
  deleteRecord: (table: string, id: number | string) =>
    api.delete(`/db/${table}/${id}`).then(r => r.data),

  // 7. Full Offline SYNC PULL
  syncPull: (since?: string, tables?: string) =>
    api.get('/sync/pull', { params: { since, tables } }).then(r => r.data),

  // 8. Batch Offline SYNC PUSH
  syncPush: (tablesData: Record<string, any[]>) =>
    api.post('/sync/push', { tables: tablesData }).then(r => r.data),
};
```

### 5.4 Functional Screen Example (`src/screens/InspectionsScreen.tsx`)
```tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput
} from 'react-native';
import { WorkshopApi } from '../api/workshopApi';
import { Inspection } from '../types/database';

export default function InspectionsScreen() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = async (query = '') => {
    try {
      const res = await WorkshopApi.getRecords<Inspection>('inspections', {
        limit: 50,
        sort: 'id',
        order: 'DESC',
        search: query || undefined,
      });
      if (res.success && res.data) {
        setInspections(res.data);
      }
    } catch (e: any) {
      console.error('Error fetching inspections:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(search);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="بحث برقم اللوحة أو السيارة..."
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          loadData(text);
        }}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={inspections}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.plate}>{item.plate_number}</Text>
                <Text style={[styles.badge, item.status === 'completed' ? styles.badgeSuccess : styles.badgePending]}>
                  {item.status === 'completed' ? 'مكتمل' : 'قيد الفحص'}
                </Text>
              </View>
              <Text style={styles.model}>{item.car_model || 'سيارة غير محددة'}</Text>
              <Text style={styles.price}>المبلغ: {item.total_amount || 0} ر.س</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  searchInput: { backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 12, textAlign: 'right' },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  plate: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  model: { fontSize: 13, color: '#64748b', marginTop: 4, textAlign: 'right' },
  price: { fontSize: 13, color: '#4f46e5', fontWeight: 'bold', marginTop: 6, textAlign: 'right' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 11, fontWeight: 'bold' },
  badgeSuccess: { backgroundColor: '#dcfce7', color: '#15803d' },
  badgePending: { backgroundColor: '#fef3c7', color: '#b45309' },
});
```

---

**Atenza Workshop Management System** — Automotive Management Architecture for React Native Expo. (برمجة وتطوير: م. عمر)
