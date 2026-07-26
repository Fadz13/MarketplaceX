# MARKETPLACEX PROJECT RULES

Version: 1.0

---

# 1. GENERAL DEVELOPMENT RULES

MarketplaceX harus dikembangkan menggunakan standar software engineering profesional.

Semua keputusan teknis harus mempertimbangkan:

- Maintainability
- Scalability
- Security
- Performance
- Readability
- Reliability

Kode harus dibuat agar mudah dikembangkan dalam jangka panjang.

---

# 2. DEVELOPMENT PRINCIPLES

Wajib mengikuti prinsip:

- Clean Code
- SOLID Principle
- DRY (Don't Repeat Yourself)
- Separation of Concerns
- Single Responsibility Principle
- Reusable Architecture

Hindari:

- Duplikasi kode
- Hardcoded value
- Temporary solution
- Kode yang sulit dipelihara

---

# 3. PROJECT STRUCTURE RULES

Gunakan struktur berbasis fitur (Feature Based Architecture).

Setiap fitur harus memiliki pemisahan:


feature/

components/

services/

hooks/

schemas/

types/

utils/


Contoh:


products/

components/
services/
schemas/
types/
utils/


Jangan membuat semua kode berada dalam satu folder besar.

---

# 4. FILE NAMING RULES

## Folder

Gunakan:

lowercase

Contoh:


products
users
orders
payments


---

## React Component

Gunakan:

PascalCase

Contoh:


ProductCard.tsx

Navbar.tsx

CheckoutForm.tsx


---

## Function

Gunakan:

camelCase

Contoh:


getProducts()

createOrder()

updateProfile()


---

## Database

Gunakan:

snake_case

Contoh:


user_profiles

order_items

product_images


---

# 5. TYPESCRIPT RULES

Semua kode wajib menggunakan TypeScript.

Rules:

- Strict mode aktif.
- Tidak menggunakan `any`.
- Semua function memiliki return type.
- Semua API memiliki interface response.
- Semua data memiliki type definition.

Contoh yang benar:

```typescript
```interface Product {
 id: string;
 name: string;
 price: number;
}

Tidak diperbolehkan:

const product:any = {}
6. COMPONENT RULES

React component harus:

Kecil
Fokus pada satu tugas
Reusable
Mudah diuji

Jangan membuat file besar seperti:

page.tsx

dengan ribuan baris kode.

Pisahkan:

UI
Business logic
Data fetching
Validation
7. BACKEND RULES

Backend harus menggunakan pemisahan:

Controller

↓

Service

↓

Repository

↓

Database

Business logic tidak boleh langsung berada di UI.

8. DATABASE RULES

Semua tabel harus memiliki:

id

created_at

updated_at

Gunakan:

Primary Key
Foreign Key
Index
Constraint
Transaction

Database harus dirancang berdasarkan kebutuhan bisnis, bukan asal membuat tabel.

9. API RULES

Semua API wajib memiliki:

Authentication check
Authorization check
Input validation
Error handling
Response format konsisten

Format response:

Success:

{
 "success": true,
 "data": {}
}

Error:

{
 "success": false,
 "error": "message"
}
10. VALIDATION RULES

Semua input pengguna harus divalidasi.

Validasi diperlukan untuk:

Form
API
Database operation
Upload file

Gunakan schema validation.

11. SECURITY RULES

Sistem wajib memiliki:

Authentication
Authorization
Role Based Access Control
Input sanitization
Rate limiting
Secure session
Environment variable protection

Tidak boleh:

Menyimpan password plaintext.
Menaruh secret key di frontend.
Menyimpan credential dalam repository.
12. USER EXPERIENCE RULES

Semua halaman wajib memiliki:

Loading State

Ketika data sedang dimuat.

Empty State

Ketika data kosong.

Error State

Ketika terjadi masalah.

Responsive Design

Harus berjalan baik pada:

Mobile
Tablet
Desktop
13. UI DESIGN RULES

Gunakan prinsip:

Modern
Minimal
Professional
Consistent

Semua komponen harus menggunakan design system.

Hindari:

Warna berlebihan.
Layout tidak konsisten.
Komponen duplikat.
14. PERFORMANCE RULES

Optimalkan:

Image loading
Database query
Bundle size
Rendering
API response

Gunakan:

Pagination
Cache
Lazy loading
Server component bila sesuai
15. TESTING RULES

Setiap fitur penting harus diuji.

Testing meliputi:

Unit Test
Integration Test
End-to-End Test

Test harus mencakup:

Normal case
Error case
Edge case
16. DOCUMENTATION RULES

Setiap fitur selesai wajib memperbarui:

README
API documentation
Database documentation
Changelog

Dokumentasi harus selalu mengikuti perkembangan kode.

17. GIT RULES

Gunakan Git secara profesional.

Commit harus jelas.

Contoh:

feat: add product management

fix: repair checkout validation

docs: update database documentation

Jangan menggunakan commit:

fix
update
baru
test
18. FEATURE DEVELOPMENT FLOW

Setiap fitur harus melalui:

Requirement analysis
Database design
Backend implementation
API implementation
Frontend implementation
Testing
Documentation
19. QUALITY CONTROL

Fitur tidak dianggap selesai jika:

Tidak responsive.
Tidak ada validation.
Memiliki bug kritis.
Security lemah.
Tidak terdokumentasi.
END OF PROJECT RULES