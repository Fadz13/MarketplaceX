# MARKETPLACEX DATABASE DESIGN

Version: 1.0

---

# 1. DATABASE OVERVIEW

MarketplaceX menggunakan database relational PostgreSQL melalui Supabase.

Database harus dirancang untuk mendukung:

- Multi user
- Multi seller
- Multi store
- Multi product
- Multi transaction
- Scalability
- Data consistency
- Security

---

# 2. DATABASE PRINCIPLES

Semua tabel wajib memiliki:

- Primary Key
- created_at
- updated_at

Gunakan:

- UUID sebagai primary key.
- Foreign key untuk relasi.
- Index pada pencarian yang sering digunakan.
- Constraint untuk menjaga integritas data.

---

# 3. USER MANAGEMENT

## Table: users

Menyimpan data akun pengguna.

Column:

id
uuid primary key

email
varchar

password_hash
varchar

role
enum

status
enum

created_at
timestamp

updated_at
timestamp


Role:

- buyer
- seller
- admin
- moderator
- finance


---

## Table: user_profiles

Data tambahan pengguna.

Column:

id

user_id

full_name

phone

avatar_url

birth_date

gender

created_at

updated_at


Relationship:

users

1 : 1

user_profiles

---

# 4. ADDRESS MANAGEMENT

## Table: addresses

Menyimpan alamat pengguna.

Column:

id

user_id

label

recipient_name

phone

province

city

district

postal_code

address_detail

is_default

created_at

updated_at


Relationship:

users

1 : many

addresses


---

# 5. SELLER SYSTEM

## Table: stores

Data toko seller.

Column:

id

seller_id

store_name

slug

description

logo_url

banner_url

status

rating

created_at

updated_at


Relationship:

users

1 : many

stores


---

# 6. CATEGORY SYSTEM

## Table: categories

Kategori produk.

Column:

id

parent_id

name

slug

image_url

status

created_at

updated_at


Support:

- Main category
- Sub category


Relationship:

categories

1 : many

categories


(Self relationship)

---

# 7. PRODUCT SYSTEM

## Table: products

Data produk utama.

Column:

id

store_id

category_id

name

slug

description

price

discount_price

stock

weight

status

rating

sold_count

created_at

updated_at


Relationship:

stores

1 : many

products


categories

1 : many

products


---

## Table: product_images

Foto produk.

Column:

id

product_id

image_url

sort_order

created_at


Relationship:

products

1 : many

product_images


---

## Table: product_variants

Variasi produk.

Contoh:

Warna

Ukuran


Column:

id

product_id

name

value

additional_price

stock

created_at


---

# 8. CART SYSTEM

## Table: carts

Keranjang pengguna.

Column:

id

user_id

created_at

updated_at


Relationship:

users

1 : 1

carts


---

## Table: cart_items

Item dalam keranjang.

Column:

id

cart_id

product_id

quantity

price

created_at


Relationship:

cart

1 : many

cart_items


---

# 9. ORDER SYSTEM

## Table: orders

Data pesanan.

Column:

id

buyer_id

order_number

status

subtotal

shipping_cost

discount_amount

total_amount

payment_status

created_at

updated_at


Status:

- pending
- paid
- processing
- shipped
- completed
- cancelled


---

## Table: order_items

Detail produk dalam pesanan.

Column:

id

order_id

product_id

seller_id

product_name

price

quantity

subtotal


Relationship:

orders

1 : many

order_items


---

# 10. PAYMENT SYSTEM

## Table: payments

Data pembayaran.

Column:

id

order_id

payment_method

transaction_id

amount

status

paid_at

created_at


Status:

- pending
- success
- failed
- refunded


---

# 11. SHIPPING SYSTEM

## Table: shipments

Data pengiriman.

Column:

id

order_id

courier

tracking_number

shipping_status

shipped_at

received_at

created_at


---

# 12. REVIEW SYSTEM

## Table: reviews

Review produk.

Column:

id

user_id

product_id

order_item_id

rating

comment

created_at

updated_at


Rating:

1-5


---

## Table: review_images

Foto review.

Column:

id

review_id

image_url

created_at


---

# 13. WISHLIST SYSTEM

## Table: wishlists

Wishlist user.

Column:

id

user_id

created_at


---

## Table: wishlist_items

Produk favorit.

Column:

id

wishlist_id

product_id

created_at


---

# 14. VOUCHER SYSTEM

## Table: vouchers

Data voucher.

Column:

id

code

type

value

minimum_purchase

max_discount

start_date

end_date

quota

status

created_at


---

## Table: user_vouchers

Voucher pengguna.

Column:

id

user_id

voucher_id

used

created_at


---

# 15. CHAT SYSTEM

## Table: conversations

Percakapan user.

Column:

id

buyer_id

seller_id

created_at


---

## Table: messages

Pesan chat.

Column:

id

conversation_id

sender_id

message

is_read

created_at


---

# 16. NOTIFICATION SYSTEM

## Table: notifications

Notifikasi pengguna.

Column:

id

user_id

title

message

type

is_read

created_at


---

# 17. ADMIN SYSTEM

## Table: reports

Laporan pengguna.

Column:

id

reporter_id

target_type

target_id

reason

status

created_at


---

## Table: audit_logs

Log aktivitas sistem.

Column:

id

user_id

action

target

metadata

created_at


---

# 18. ANALYTICS SYSTEM

## Table: sales_analytics

Data statistik penjualan.

Column:

id

store_id

date

total_sales

total_orders

created_at


---

# 19. DATABASE RELATION SUMMARY

users

|

├── profiles

├── addresses

├── stores

├── carts

├── orders

├── reviews

├── wishlist

└── notifications


stores

|

├── products

├── analytics

└── orders


products

|

├── images

├── variants

├── reviews

└── cart_items


orders

|

├── order_items

├── payments

└── shipments


---

# 20. SECURITY RULES

Database wajib menggunakan:

- Row Level Security (RLS)
- Permission berdasarkan role
- Secure query
- Restricted access

Buyer tidak boleh:

- Mengubah produk seller lain.
- Melihat data pribadi user lain.

Seller tidak boleh:

- Mengakses toko seller lain.
- Mengubah transaksi orang lain.

---

# 21. DATABASE OPTIMIZATION

Gunakan index untuk:

- Product search
- Category filter
- User lookup
- Order lookup
- Transaction lookup


Gunakan pagination untuk data besar.

---

# END OF DATABASE DESIGN