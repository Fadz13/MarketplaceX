-- =============================================================================
-- MARKETPLACEX DATABASE SCHEMA
-- Version: 2.0 (Enterprise Upgrade)
-- Database: PostgreSQL 15+ (Supabase compatible)
-- Normalization: Third Normal Form (3NF)
-- =============================================================================

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_status AS ENUM (
    'active', 'inactive', 'suspended', 'banned', 'pending_verification'
);
CREATE TYPE gender_type AS ENUM ('male', 'female', 'prefer_not_to_say');
CREATE TYPE store_status AS ENUM ('active', 'inactive', 'suspended', 'pending_review');
CREATE TYPE category_status AS ENUM ('active', 'inactive');
CREATE TYPE product_status AS ENUM ('active', 'inactive', 'draft', 'suspended', 'out_of_stock');
CREATE TYPE product_condition AS ENUM ('new', 'used', 'refurbished');
CREATE TYPE stock_movement_type AS ENUM (
    'purchase', 'sale', 'return', 'adjustment',
    'flash_sale_reserve', 'flash_sale_release', 'damage'
);
CREATE TYPE order_status AS ENUM (
    'pending', 'awaiting_payment', 'paid', 'processing',
    'shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'disputed'
);
CREATE TYPE payment_status AS ENUM (
    'pending', 'success', 'failed', 'expired', 'refunded', 'chargeback'
);
CREATE TYPE payment_method AS ENUM (
    'bank_transfer', 'virtual_account', 'e_wallet',
    'credit_card', 'debit_card', 'cod', 'marketplace_credit'
);
CREATE TYPE payment_log_event AS ENUM (
    'created', 'pending', 'callback_received', 'verified',
    'success', 'failed', 'expired', 'refund_requested', 'refunded', 'chargeback'
);
CREATE TYPE shipping_status AS ENUM (
    'pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'failed'
);
CREATE TYPE voucher_type AS ENUM ('percentage', 'fixed_amount', 'free_shipping');
CREATE TYPE voucher_status AS ENUM ('active', 'inactive', 'expired');
CREATE TYPE voucher_scope AS ENUM ('platform', 'store', 'product');
CREATE TYPE notification_type AS ENUM (
    'order_created', 'order_paid', 'order_shipped', 'order_delivered',
    'order_completed', 'order_cancelled', 'order_disputed',
    'payment_success', 'payment_failed', 'new_message', 'new_review', 'review_replied',
    'flash_sale_start', 'flash_sale_end', 'store_followed',
    'withdrawal_approved', 'withdrawal_rejected', 'promo', 'system'
);
CREATE TYPE report_status AS ENUM ('pending', 'under_review', 'resolved', 'dismissed');
CREATE TYPE activity_type AS ENUM (
    'auth_login', 'auth_logout', 'auth_register',
    'auth_password_changed', 'auth_password_reset',
    'user_created', 'user_updated', 'user_suspended', 'user_banned', 'user_activated',
    'store_created', 'store_updated', 'store_suspended', 'store_activated',
    'product_created', 'product_updated', 'product_deleted', 'product_suspended',
    'order_created', 'order_cancelled', 'order_refunded', 'order_status_changed',
    'payment_created', 'payment_success', 'payment_failed', 'payment_refunded',
    'withdrawal_requested', 'withdrawal_approved', 'withdrawal_rejected', 'withdrawal_completed',
    'admin_action', 'permission_granted', 'permission_revoked', 'content_moderated'
);
CREATE TYPE balance_transaction_type AS ENUM ('credit', 'debit');
CREATE TYPE withdrawal_status AS ENUM (
    'pending', 'approved', 'processing', 'completed', 'failed', 'cancelled'
);
CREATE TYPE flash_sale_status AS ENUM ('draft', 'scheduled', 'active', 'ended', 'cancelled');
CREATE TYPE banner_type AS ENUM ('hero', 'category', 'popup', 'sidebar', 'inline');
CREATE TYPE banner_status AS ENUM ('active', 'inactive', 'scheduled');

-- =============================================================================
-- HELPER: updated_at auto-trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =============================================================================
-- DOMAIN 1: RBAC
-- roles, permissions, role_permissions  (declared before users table so the
-- deferred FK on role_permissions.granted_by can be added after users exists)
-- =============================================================================

CREATE TABLE roles (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(50)  NOT NULL UNIQUE,
    label       VARCHAR(100) NOT NULL,
    description TEXT,
    is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT roles_name_format CHECK (name ~ '^[a-z0-9_]+$')
);
CREATE INDEX idx_roles_name ON roles (name);
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE permissions (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    label       VARCHAR(150) NOT NULL,
    description TEXT,
    resource    VARCHAR(50)  NOT NULL,
    action      VARCHAR(50)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT permissions_name_format CHECK (name ~ '^[a-z0-9_]+:[a-z0-9_]+$'),
    UNIQUE (resource, action)
);
CREATE INDEX idx_permissions_resource ON permissions (resource);

CREATE TABLE role_permissions (
    role_id       UUID        NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission_id UUID        NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
    granted_by    UUID,       -- FK to users added after users table is created
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);
CREATE INDEX idx_role_permissions_role_id       ON role_permissions (role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions (permission_id);

-- =============================================================================
-- DOMAIN 2: USER MANAGEMENT
-- =============================================================================

-- users.role is a VARCHAR denorm-cache for fast RLS; authoritative RBAC is user_roles.
-- Kept as VARCHAR (not enum) so new roles can be added without ALTER TYPE.
CREATE TABLE users (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id        UUID         UNIQUE,
    email          VARCHAR(255) NOT NULL UNIQUE,
    role           VARCHAR(50)  NOT NULL DEFAULT 'buyer',
    status         user_status  NOT NULL DEFAULT 'pending_verification',
    email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT users_email_format CHECK (
        email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
    )
);
CREATE INDEX idx_users_email      ON users (email);
CREATE INDEX idx_users_auth_id    ON users (auth_id);
CREATE INDEX idx_users_role       ON users (role);
CREATE INDEX idx_users_status     ON users (status);
CREATE INDEX idx_users_created_at ON users (created_at DESC);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Now that users table exists, add the deferred FK
ALTER TABLE role_permissions
    ADD CONSTRAINT fk_role_permissions_granted_by
    FOREIGN KEY (granted_by) REFERENCES users (id) ON DELETE SET NULL;

-- Many-to-many: user <-> role (authoritative)
CREATE TABLE user_roles (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_id    UUID        NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    granted_by UUID        REFERENCES users (id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE (user_id, role_id)
);
CREATE INDEX idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles (role_id);
CREATE INDEX idx_user_roles_expires ON user_roles (expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE user_profiles (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    full_name    VARCHAR(150),
    phone        VARCHAR(20),
    avatar_url   TEXT,
    birth_date   DATE,
    gender       gender_type,
    bio          TEXT,
    website      VARCHAR(255),
    social_links JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_profiles_phone_format     CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{7,20}$'),
    CONSTRAINT user_profiles_birth_date_check CHECK (birth_date IS NULL OR birth_date <= CURRENT_DATE),
    CONSTRAINT user_profiles_website_format   CHECK (website IS NULL OR website ~* '^https?://')
);
CREATE INDEX idx_user_profiles_user_id   ON user_profiles (user_id);
CREATE INDEX idx_user_profiles_full_name ON user_profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_user_profiles_phone     ON user_profiles (phone) WHERE phone IS NOT NULL;
CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE addresses (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    label          VARCHAR(50)  NOT NULL DEFAULT 'Home',
    recipient_name VARCHAR(150) NOT NULL,
    phone          VARCHAR(20)  NOT NULL,
    province       VARCHAR(100) NOT NULL,
    city           VARCHAR(100) NOT NULL,
    district       VARCHAR(100) NOT NULL,
    postal_code    VARCHAR(10)  NOT NULL,
    address_detail TEXT         NOT NULL,
    latitude       NUMERIC(10, 7),
    longitude      NUMERIC(10, 7),
    is_default     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT addresses_postal_code_format CHECK (postal_code ~ '^[0-9]{5,10}$'),
    CONSTRAINT addresses_phone_format       CHECK (phone ~ '^\+?[0-9]{7,20}$'),
    CONSTRAINT addresses_lat_range          CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
    CONSTRAINT addresses_lng_range          CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX idx_addresses_user_id    ON addresses (user_id);
CREATE INDEX idx_addresses_is_default ON addresses (user_id, is_default);
CREATE INDEX idx_addresses_geo        ON addresses (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE TRIGGER trg_addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- DOMAIN 3: BRANDS
-- =============================================================================

CREATE TABLE brands (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    slug        VARCHAR(110) NOT NULL UNIQUE,
    description TEXT,
    logo_url    TEXT,
    website     VARCHAR(255),
    is_verified BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT brands_slug_format    CHECK (slug ~ '^[a-z0-9\-]+$'),
    CONSTRAINT brands_website_format CHECK (website IS NULL OR website ~* '^https?://')
);
CREATE INDEX idx_brands_slug      ON brands (slug);
CREATE INDEX idx_brands_is_active ON brands (is_active);
CREATE INDEX idx_brands_name_trgm ON brands USING gin (name gin_trgm_ops);
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- DOMAIN 4: STORE SYSTEM
-- =============================================================================

CREATE TABLE stores (
    id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id        UUID          NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    store_name       VARCHAR(100)  NOT NULL,
    slug             VARCHAR(110)  NOT NULL UNIQUE,
    description      TEXT,
    logo_url         TEXT,
    banner_url       TEXT,
    status           store_status  NOT NULL DEFAULT 'pending_review',
    rating           NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    review_count     INTEGER       NOT NULL DEFAULT 0,
    follower_count   INTEGER       NOT NULL DEFAULT 0,
    total_sales      INTEGER       NOT NULL DEFAULT 0,
    total_revenue    NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    province         VARCHAR(100),
    city             VARCHAR(100),
    latitude         NUMERIC(10, 7),
    longitude        NUMERIC(10, 7),
    meta_title       VARCHAR(160),
    meta_description VARCHAR(320),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT stores_rating_range      CHECK (rating >= 0 AND rating <= 5),
    CONSTRAINT stores_total_sales_nn    CHECK (total_sales >= 0),
    CONSTRAINT stores_total_revenue_nn  CHECK (total_revenue >= 0),
    CONSTRAINT stores_follower_count_nn CHECK (follower_count >= 0),
    CONSTRAINT stores_review_count_nn   CHECK (review_count >= 0),
    CONSTRAINT stores_slug_format       CHECK (slug ~ '^[a-z0-9\-]+$'),
    CONSTRAINT stores_lat_range         CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
    CONSTRAINT stores_lng_range         CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX idx_stores_seller_id ON stores (seller_id);
CREATE INDEX idx_stores_slug      ON stores (slug);
CREATE INDEX idx_stores_status    ON stores (status);
CREATE INDEX idx_stores_rating    ON stores (rating DESC);
CREATE INDEX idx_stores_city      ON stores (city) WHERE city IS NOT NULL;
CREATE INDEX idx_stores_name_trgm ON stores USING gin (store_name gin_trgm_ops);
CREATE TRIGGER trg_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- store_followers: counter-cache on stores.follower_count maintained by trigger
CREATE TABLE store_followers (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id   UUID        NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, user_id)
);
CREATE INDEX idx_store_followers_store_id ON store_followers (store_id);
CREATE INDEX idx_store_followers_user_id  ON store_followers (user_id);

-- =============================================================================
-- DOMAIN 5: CATEGORY SYSTEM
-- =============================================================================

-- depth: 0=root, 1=sub-category, 2=leaf  (cached, maintained by app layer)
CREATE TABLE categories (
    id               UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id        UUID            REFERENCES categories (id) ON DELETE SET NULL,
    name             VARCHAR(100)    NOT NULL,
    slug             VARCHAR(110)    NOT NULL UNIQUE,
    description      TEXT,
    image_url        TEXT,
    icon_url         TEXT,
    sort_order       INTEGER         NOT NULL DEFAULT 0,
    depth            SMALLINT        NOT NULL DEFAULT 0,
    status           category_status NOT NULL DEFAULT 'active',
    meta_title       VARCHAR(160),
    meta_description VARCHAR(320),
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT categories_slug_format  CHECK (slug ~ '^[a-z0-9\-]+$'),
    CONSTRAINT categories_depth_range  CHECK (depth BETWEEN 0 AND 5)
);
CREATE INDEX idx_categories_parent_id  ON categories (parent_id);
CREATE INDEX idx_categories_slug       ON categories (slug);
CREATE INDEX idx_categories_status     ON categories (status);
CREATE INDEX idx_categories_sort_order ON categories (parent_id, sort_order);
CREATE INDEX idx_categories_depth      ON categories (depth);
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- DOMAIN 6: PRODUCT SYSTEM  (3NF variant architecture)
-- products → variant_options → variant_values → product_skus
-- =============================================================================

CREATE TABLE products (
    id               UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id         UUID              NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
    category_id      UUID              REFERENCES categories (id) ON DELETE SET NULL,
    brand_id         UUID              REFERENCES brands (id) ON DELETE SET NULL,
    name             VARCHAR(255)      NOT NULL,
    slug             VARCHAR(270)      NOT NULL UNIQUE,
    description      TEXT,
    condition        product_condition NOT NULL DEFAULT 'new',
    price            NUMERIC(15, 2)    NOT NULL,
    discount_price   NUMERIC(15, 2),
    stock            INTEGER           NOT NULL DEFAULT 0,
    weight           NUMERIC(10, 2),
    length           NUMERIC(10, 2),
    width            NUMERIC(10, 2),
    height           NUMERIC(10, 2),
    has_variants     BOOLEAN           NOT NULL DEFAULT FALSE,
    status           product_status    NOT NULL DEFAULT 'draft',
    rating           NUMERIC(3, 2)     NOT NULL DEFAULT 0.00,
    review_count     INTEGER           NOT NULL DEFAULT 0,
    sold_count       INTEGER           NOT NULL DEFAULT 0,
    view_count       INTEGER           NOT NULL DEFAULT 0,
    meta_title       VARCHAR(160),
    meta_description VARCHAR(320),
    tags             TEXT[],
    created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    CONSTRAINT products_price_positive        CHECK (price > 0),
    CONSTRAINT products_discount_price_check  CHECK (discount_price IS NULL OR (discount_price > 0 AND discount_price < price)),
    CONSTRAINT products_stock_nn              CHECK (stock >= 0),
    CONSTRAINT products_weight_positive       CHECK (weight IS NULL OR weight > 0),
    CONSTRAINT products_dims_positive         CHECK ((length IS NULL OR length > 0) AND (width IS NULL OR width > 0) AND (height IS NULL OR height > 0)),
    CONSTRAINT products_rating_range          CHECK (rating >= 0 AND rating <= 5),
    CONSTRAINT products_sold_count_nn         CHECK (sold_count >= 0),
    CONSTRAINT products_review_count_nn       CHECK (review_count >= 0),
    CONSTRAINT products_slug_format           CHECK (slug ~ '^[a-z0-9\-]+$')
);
CREATE INDEX idx_products_store_id       ON products (store_id);
CREATE INDEX idx_products_category_id    ON products (category_id);
CREATE INDEX idx_products_brand_id       ON products (brand_id);
CREATE INDEX idx_products_status         ON products (status);
CREATE INDEX idx_products_condition      ON products (condition);
CREATE INDEX idx_products_has_variants   ON products (has_variants);
CREATE INDEX idx_products_price          ON products (price);
CREATE INDEX idx_products_discount_price ON products (discount_price) WHERE discount_price IS NOT NULL;
CREATE INDEX idx_products_rating         ON products (rating DESC);
CREATE INDEX idx_products_sold_count     ON products (sold_count DESC);
CREATE INDEX idx_products_created_at     ON products (created_at DESC);
CREATE INDEX idx_products_slug           ON products (slug);
CREATE INDEX idx_products_tags           ON products USING gin (tags);
CREATE INDEX idx_products_fts            ON products USING gin (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
);
CREATE INDEX idx_products_name_trgm      ON products USING gin (name gin_trgm_ops);
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE product_images (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    image_url  TEXT        NOT NULL,
    alt_text   VARCHAR(255),
    sort_order INTEGER     NOT NULL DEFAULT 0,
    is_primary BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT product_images_sort_order_nn CHECK (sort_order >= 0)
);
CREATE INDEX idx_product_images_product_id ON product_images (product_id);
CREATE INDEX idx_product_images_sort       ON product_images (product_id, sort_order);

-- variant_options: defines a variant axis per product, e.g. "Color", "Size"
CREATE TABLE variant_options (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    name       VARCHAR(80) NOT NULL,
    sort_order INTEGER     NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, name),
    CONSTRAINT variant_options_sort_order_nn CHECK (sort_order >= 0)
);
CREATE INDEX idx_variant_options_product_id ON variant_options (product_id);

-- variant_values: individual choices per option, e.g. "Red", "XL"
CREATE TABLE variant_values (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_option_id UUID        NOT NULL REFERENCES variant_options (id) ON DELETE CASCADE,
    value             VARCHAR(100) NOT NULL,
    display_value     VARCHAR(100),
    color_hex         CHAR(7),
    image_url         TEXT,
    sort_order        INTEGER     NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (variant_option_id, value),
    CONSTRAINT variant_values_sort_order_nn CHECK (sort_order >= 0),
    CONSTRAINT variant_values_color_hex     CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$')
);
CREATE INDEX idx_variant_values_option_id ON variant_values (variant_option_id);

-- product_skus: each purchasable combination of variant values
-- variant_value_ids is a sorted UUID[] of the combination
CREATE TABLE product_skus (
    id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id        UUID           NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    sku_code          VARCHAR(100)   UNIQUE,
    variant_value_ids UUID[]         NOT NULL DEFAULT '{}',
    price             NUMERIC(15, 2) NOT NULL,
    discount_price    NUMERIC(15, 2),
    stock             INTEGER        NOT NULL DEFAULT 0,
    weight            NUMERIC(10, 2),
    image_url         TEXT,
    is_active         BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT product_skus_price_positive CHECK (price > 0),
    CONSTRAINT product_skus_discount_check CHECK (discount_price IS NULL OR (discount_price > 0 AND discount_price < price)),
    CONSTRAINT product_skus_stock_nn       CHECK (stock >= 0),
    CONSTRAINT product_skus_weight_pos     CHECK (weight IS NULL OR weight > 0)
);
CREATE INDEX idx_product_skus_product_id        ON product_skus (product_id);
CREATE INDEX idx_product_skus_sku_code          ON product_skus (sku_code) WHERE sku_code IS NOT NULL;
CREATE INDEX idx_product_skus_variant_value_ids ON product_skus USING gin (variant_value_ids);
CREATE INDEX idx_product_skus_is_active         ON product_skus (product_id, is_active);
CREATE TRIGGER trg_product_skus_updated_at BEFORE UPDATE ON product_skus FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- stock_movements: immutable append-only audit trail for every stock delta
CREATE TABLE stock_movements (
    id             UUID                NOT NULL DEFAULT uuid_generate_v4(),
    product_id     UUID                NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    product_sku_id UUID                REFERENCES product_skus (id) ON DELETE RESTRICT,
    movement_type  stock_movement_type NOT NULL,
    quantity_delta INTEGER             NOT NULL,
    stock_before   INTEGER             NOT NULL,
    stock_after    INTEGER             NOT NULL,
    reference_type VARCHAR(50),
    reference_id   UUID,
    note           TEXT,
    created_by     UUID                REFERENCES users (id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    CONSTRAINT stock_movements_delta_nonzero  CHECK (quantity_delta != 0),
    CONSTRAINT stock_movements_stock_after_nn CHECK (stock_after >= 0),
    CONSTRAINT stock_movements_consistency    CHECK (stock_after = stock_before + quantity_delta)
) PARTITION BY RANGE (created_at);

-- Default (non-partitioned) fallback — swap for monthly partitions in production
CREATE TABLE stock_movements_default PARTITION OF stock_movements DEFAULT;

ALTER TABLE stock_movements ADD PRIMARY KEY (id, created_at);

CREATE INDEX idx_stock_movements_product_id ON stock_movements (product_id);
CREATE INDEX idx_stock_movements_sku_id     ON stock_movements (product_sku_id);
CREATE INDEX idx_stock_movements_type       ON stock_movements (movement_type);
CREATE INDEX idx_stock_movements_reference  ON stock_movements (reference_type, reference_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements (created_at DESC);

-- =============================================================================
-- DOMAIN 7: CART SYSTEM
-- =============================================================================

CREATE TABLE carts (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_carts_user_id ON carts (user_id);
CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- cart_items now references product_skus instead of the flat product_variants
CREATE TABLE cart_items (
    id             UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id        UUID           NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
    product_id     UUID           NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    product_sku_id UUID           REFERENCES product_skus (id) ON DELETE SET NULL,
    quantity       INTEGER        NOT NULL DEFAULT 1,
    unit_price     NUMERIC(15, 2) NOT NULL,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT cart_items_quantity_positive   CHECK (quantity > 0),
    CONSTRAINT cart_items_unit_price_positive CHECK (unit_price > 0),
    UNIQUE (cart_id, product_id, product_sku_id)
);
CREATE INDEX idx_cart_items_cart_id    ON cart_items (cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items (product_id);
CREATE INDEX idx_cart_items_sku_id     ON cart_items (product_sku_id);
CREATE TRIGGER trg_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- DOMAIN 8: WISHLIST
-- =============================================================================

CREATE TABLE wishlists (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wishlists_user_id ON wishlists (user_id);

CREATE TABLE wishlist_items (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    wishlist_id UUID        NOT NULL REFERENCES wishlists (id) ON DELETE CASCADE,
    product_id  UUID        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (wishlist_id, product_id)
);
CREATE INDEX idx_wishlist_items_wishlist_id ON wishlist_items (wishlist_id);
CREATE INDEX idx_wishlist_items_product_id  ON wishlist_items (product_id);

-- =============================================================================
-- DOMAIN 9: VOUCHER SYSTEM  (declared before orders so orders can FK vouchers)
-- =============================================================================

CREATE TABLE vouchers (
    id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id         UUID           REFERENCES stores (id) ON DELETE CASCADE,
    created_by       UUID           REFERENCES users (id) ON DELETE SET NULL,
    code             VARCHAR(50)    NOT NULL UNIQUE,
    scope            voucher_scope  NOT NULL DEFAULT 'platform',
    type             voucher_type   NOT NULL,
    value            NUMERIC(15, 2) NOT NULL,
    minimum_purchase NUMERIC(15, 2) NOT NULL DEFAULT 0,
    max_discount     NUMERIC(15, 2),
    quota            INTEGER,
    used_count       INTEGER        NOT NULL DEFAULT 0,
    start_date       TIMESTAMPTZ    NOT NULL,
    end_date         TIMESTAMPTZ    NOT NULL,
    status           voucher_status NOT NULL DEFAULT 'active',
    description      TEXT,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT vouchers_value_positive        CHECK (value > 0),
    CONSTRAINT vouchers_minimum_purchase_nn   CHECK (minimum_purchase >= 0),
    CONSTRAINT vouchers_max_discount_positive CHECK (max_discount IS NULL OR max_discount > 0),
    CONSTRAINT vouchers_quota_positive        CHECK (quota IS NULL OR quota > 0),
    CONSTRAINT vouchers_date_range            CHECK (end_date > start_date),
    CONSTRAINT vouchers_percentage_cap        CHECK (type != 'percentage' OR value <= 100),
    CONSTRAINT vouchers_used_count_nn         CHECK (used_count >= 0),
    CONSTRAINT vouchers_store_scope_match     CHECK ((scope = 'store' AND store_id IS NOT NULL) OR scope IN ('platform','product'))
);
CREATE INDEX idx_vouchers_code     ON vouchers (code);
CREATE INDEX idx_vouchers_store_id ON vouchers (store_id);
CREATE INDEX idx_vouchers_status   ON vouchers (status);
CREATE INDEX idx_vouchers_end_date ON vouchers (end_date);
CREATE INDEX idx_vouchers_scope    ON vouchers (scope);
CREATE TRIGGER trg_vouchers_updated_at BEFORE UPDATE ON vouchers FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- DOMAIN 10: ORDER SYSTEM
-- =============================================================================

CREATE TABLE orders (
    id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id          UUID           NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    address_id        UUID           REFERENCES addresses (id) ON DELETE SET NULL,
    voucher_id        UUID           REFERENCES vouchers (id) ON DELETE SET NULL,
    order_number      VARCHAR(30)    NOT NULL UNIQUE,
    status            order_status   NOT NULL DEFAULT 'pending',
    subtotal          NUMERIC(15, 2) NOT NULL,
    shipping_cost     NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0,
    platform_fee      NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount      NUMERIC(15, 2) NOT NULL,
    payment_status    payment_status NOT NULL DEFAULT 'pending',
    payment_due_at    TIMESTAMPTZ,
    shipping_snapshot JSONB          NOT NULL DEFAULT '{}',
    buyer_notes       TEXT,
    cancelled_at      TIMESTAMPTZ,
    cancelled_reason  TEXT,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT orders_subtotal_positive   CHECK (subtotal > 0),
    CONSTRAINT orders_shipping_cost_nn    CHECK (shipping_cost >= 0),
    CONSTRAINT orders_discount_nn         CHECK (discount_amount >= 0),
    CONSTRAINT orders_platform_fee_nn     CHECK (platform_fee >= 0),
    CONSTRAINT orders_total_positive      CHECK (total_amount > 0),
    CONSTRAINT orders_total_consistency   CHECK (total_amount = subtotal + shipping_cost - discount_amount + platform_fee)
);
CREATE INDEX idx_orders_buyer_id       ON orders (buyer_id);
CREATE INDEX idx_orders_order_number   ON orders (order_number);
CREATE INDEX idx_orders_status         ON orders (status);
CREATE INDEX idx_orders_payment_status ON orders (payment_status);
CREATE INDEX idx_orders_voucher_id     ON orders (voucher_id);
CREATE INDEX idx_orders_created_at     ON orders (created_at DESC);
CREATE INDEX idx_orders_payment_due    ON orders (payment_due_at) WHERE payment_due_at IS NOT NULL;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- order_items: snapshot of product data at purchase time (intentionally denormalised)
CREATE TABLE order_items (
    id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id          UUID           NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
    product_id        UUID           REFERENCES products (id) ON DELETE SET NULL,
    product_sku_id    UUID           REFERENCES product_skus (id) ON DELETE SET NULL,
    seller_id         UUID           NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    store_id          UUID           NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
    product_name      VARCHAR(255)   NOT NULL,
    product_image_url TEXT,
    variant_label     VARCHAR(255),
    sku_code          VARCHAR(100),
    unit_price        NUMERIC(15, 2) NOT NULL,
    quantity          INTEGER        NOT NULL,
    subtotal          NUMERIC(15, 2) NOT NULL,
    status            order_status   NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT order_items_quantity_positive    CHECK (quantity > 0),
    CONSTRAINT order_items_unit_price_positive  CHECK (unit_price > 0),
    CONSTRAINT order_items_subtotal_consistency CHECK (subtotal = unit_price * quantity)
);
CREATE INDEX idx_order_items_order_id   ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);
CREATE INDEX idx_order_items_sku_id     ON order_items (product_sku_id);
CREATE INDEX idx_order_items_seller_id  ON order_items (seller_id);
CREATE INDEX idx_order_items_store_id   ON order_items (store_id);
CREATE INDEX idx_order_items_status     ON order_items (status);
CREATE TRIGGER trg_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- user_vouchers (depends on orders existing)
CREATE TABLE user_vouchers (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    voucher_id UUID        NOT NULL REFERENCES vouchers (id) ON DELETE CASCADE,
    order_id   UUID        REFERENCES orders (id) ON DELETE SET NULL,
    used       BOOLEAN     NOT NULL DEFAULT FALSE,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, voucher_id)
);
CREATE INDEX idx_user_vouchers_user_id    ON user_vouchers (user_id);
CREATE INDEX idx_user_vouchers_voucher_id ON user_vouchers (voucher_id);

-- =============================================================================
-- DOMAIN 11: PAYMENT SYSTEM
-- =============================================================================

CREATE TABLE payments (
    id               UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id         UUID            NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
    payment_method   payment_method  NOT NULL,
    payment_channel  VARCHAR(80),
    transaction_id   VARCHAR(255)    UNIQUE,
    gateway_response JSONB,
    amount           NUMERIC(15, 2)  NOT NULL,
    fee_amount       NUMERIC(15, 2)  NOT NULL DEFAULT 0,
    net_amount       NUMERIC(15, 2)  GENERATED ALWAYS AS (amount - fee_amount) STORED,
    status           payment_status  NOT NULL DEFAULT 'pending',
    paid_at          TIMESTAMPTZ,
    expired_at       TIMESTAMPTZ,
    refunded_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT payments_amount_positive CHECK (amount > 0),
    CONSTRAINT payments_fee_nn          CHECK (fee_amount >= 0)
);
CREATE INDEX idx_payments_order_id       ON payments (order_id);
CREATE INDEX idx_payments_transaction_id ON payments (transaction_id);
CREATE INDEX idx_payments_status         ON payments (status);
CREATE INDEX idx_payments_method         ON payments (payment_method);
CREATE INDEX idx_payments_created_at     ON payments (created_at DESC);
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- payment_logs: immutable event log per payment — never updated, only inserted
CREATE TABLE payment_logs (
    id         UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID              NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
    event      payment_log_event NOT NULL,
    payload    JSONB             NOT NULL DEFAULT '{}',
    note       TEXT,
    created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payment_logs_payment_id ON payment_logs (payment_id, created_at DESC);
CREATE INDEX idx_payment_logs_event      ON payment_logs (event);

-- =============================================================================
-- DOMAIN 12: SHIPPING SYSTEM
-- =============================================================================

CREATE TABLE shipments (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID            NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
    courier         VARCHAR(100)    NOT NULL,
    service_type    VARCHAR(100),
    tracking_number VARCHAR(100),
    shipping_status shipping_status NOT NULL DEFAULT 'pending',
    shipping_cost   NUMERIC(15, 2)  NOT NULL DEFAULT 0,
    estimated_days  INTEGER,
    origin_address  JSONB           NOT NULL DEFAULT '{}',
    shipped_at      TIMESTAMPTZ,
    received_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT shipments_shipping_cost_nn   CHECK (shipping_cost >= 0),
    CONSTRAINT shipments_estimated_days_pos CHECK (estimated_days IS NULL OR estimated_days > 0)
);
CREATE INDEX idx_shipments_order_id        ON shipments (order_id);
CREATE INDEX idx_shipments_tracking_number ON shipments (tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX idx_shipments_shipping_status ON shipments (shipping_status);
CREATE TRIGGER trg_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- shipment_tracking: append-only courier webhook event timeline
CREATE TABLE shipment_tracking (
    id          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID            NOT NULL REFERENCES shipments (id) ON DELETE CASCADE,
    status      shipping_status NOT NULL,
    location    VARCHAR(255),
    description TEXT,
    event_time  TIMESTAMPTZ     NOT NULL,
    raw_payload JSONB           NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shipment_tracking_shipment_id ON shipment_tracking (shipment_id, event_time DESC);

-- =============================================================================
-- DOMAIN 13: SELLER FINANCE
-- =============================================================================

-- One row per seller; running balance maintained by triggers.
CREATE TABLE seller_balances (
    id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id         UUID           NOT NULL UNIQUE REFERENCES users (id) ON DELETE RESTRICT,
    available_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    pending_balance   NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_earned      NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_withdrawn   NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT seller_balances_available_nn CHECK (available_balance >= 0),
    CONSTRAINT seller_balances_pending_nn   CHECK (pending_balance >= 0),
    CONSTRAINT seller_balances_earned_nn    CHECK (total_earned >= 0),
    CONSTRAINT seller_balances_withdrawn_nn CHECK (total_withdrawn >= 0)
);
CREATE INDEX idx_seller_balances_seller_id ON seller_balances (seller_id);
CREATE TRIGGER trg_seller_balances_updated_at BEFORE UPDATE ON seller_balances FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Immutable double-entry ledger per seller
CREATE TABLE seller_balance_transactions (
    id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id        UUID                     NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    transaction_type balance_transaction_type NOT NULL,
    amount           NUMERIC(15, 2)           NOT NULL,
    balance_before   NUMERIC(15, 2)           NOT NULL,
    balance_after    NUMERIC(15, 2)           NOT NULL,
    reference_type   VARCHAR(50),
    reference_id     UUID,
    description      TEXT,
    created_at       TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
    CONSTRAINT sbt_amount_positive  CHECK (amount > 0),
    CONSTRAINT sbt_balance_after_nn CHECK (balance_after >= 0)
);
CREATE INDEX idx_sbt_seller_id  ON seller_balance_transactions (seller_id);
CREATE INDEX idx_sbt_created_at ON seller_balance_transactions (created_at DESC);
CREATE INDEX idx_sbt_reference  ON seller_balance_transactions (reference_type, reference_id);

CREATE TABLE seller_withdrawals (
    id                UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id         UUID              NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    amount            NUMERIC(15, 2)    NOT NULL,
    fee_amount        NUMERIC(15, 2)    NOT NULL DEFAULT 0,
    net_amount        NUMERIC(15, 2)    GENERATED ALWAYS AS (amount - fee_amount) STORED,
    bank_name         VARCHAR(100)      NOT NULL,
    bank_account_no   VARCHAR(50)       NOT NULL,
    bank_account_name VARCHAR(150)      NOT NULL,
    status            withdrawal_status NOT NULL DEFAULT 'pending',
    reference_no      VARCHAR(100)      UNIQUE,
    admin_note        TEXT,
    processed_by      UUID              REFERENCES users (id) ON DELETE SET NULL,
    processed_at      TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    CONSTRAINT seller_withdrawals_amount_positive CHECK (amount > 0),
    CONSTRAINT seller_withdrawals_fee_nn          CHECK (fee_amount >= 0)
);
CREATE INDEX idx_seller_withdrawals_seller_id ON seller_withdrawals (seller_id);
CREATE INDEX idx_seller_withdrawals_status    ON seller_withdrawals (status);
CREATE INDEX idx_seller_withdrawals_created   ON seller_withdrawals (created_at DESC);
CREATE TRIGGER trg_seller_withdrawals_updated_at BEFORE UPDATE ON seller_withdrawals FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- DOMAIN 14: REVIEW SYSTEM
-- =============================================================================

CREATE TABLE reviews (
    id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    product_id           UUID        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    order_item_id        UUID        NOT NULL UNIQUE REFERENCES order_items (id) ON DELETE RESTRICT,
    rating               SMALLINT    NOT NULL,
    comment              TEXT,
    seller_response      TEXT,
    seller_response_at   TIMESTAMPTZ,
    is_anonymous         BOOLEAN     NOT NULL DEFAULT FALSE,
    is_verified_purchase BOOLEAN     NOT NULL DEFAULT TRUE,
    helpful_count        INTEGER     NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reviews_rating_range     CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT reviews_helpful_count_nn CHECK (helpful_count >= 0),
    UNIQUE (user_id, product_id, order_item_id)
);
CREATE INDEX idx_reviews_product_id ON reviews (product_id);
CREATE INDEX idx_reviews_user_id    ON reviews (user_id);
CREATE INDEX idx_reviews_rating     ON reviews (rating);
CREATE INDEX idx_reviews_created_at ON reviews (created_at DESC);
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE review_images (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id  UUID        NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
    image_url  TEXT        NOT NULL,
    sort_order INTEGER     NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT review_images_sort_order_nn CHECK (sort_order >= 0)
);
CREATE INDEX idx_review_images_review_id ON review_images (review_id);

-- =============================================================================
-- DOMAIN 15: FLASH SALE SYSTEM
-- =============================================================================

CREATE TABLE flash_sales (
    id          UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       VARCHAR(255)      NOT NULL,
    slug        VARCHAR(270)      NOT NULL UNIQUE,
    description TEXT,
    banner_url  TEXT,
    status      flash_sale_status NOT NULL DEFAULT 'draft',
    starts_at   TIMESTAMPTZ       NOT NULL,
    ends_at     TIMESTAMPTZ       NOT NULL,
    created_by  UUID              REFERENCES users (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    CONSTRAINT flash_sales_dates_check CHECK (ends_at > starts_at),
    CONSTRAINT flash_sales_slug_format CHECK (slug ~ '^[a-z0-9\-]+$')
);
CREATE INDEX idx_flash_sales_status    ON flash_sales (status);
CREATE INDEX idx_flash_sales_starts_at ON flash_sales (starts_at);
CREATE INDEX idx_flash_sales_ends_at   ON flash_sales (ends_at);
CREATE TRIGGER trg_flash_sales_updated_at BEFORE UPDATE ON flash_sales FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE flash_sale_items (
    id             UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id  UUID           NOT NULL REFERENCES flash_sales (id) ON DELETE CASCADE,
    product_id     UUID           NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    product_sku_id UUID           REFERENCES product_skus (id) ON DELETE CASCADE,
    original_price NUMERIC(15, 2) NOT NULL,
    sale_price     NUMERIC(15, 2) NOT NULL,
    quota          INTEGER        NOT NULL,
    sold_count     INTEGER        NOT NULL DEFAULT 0,
    is_active      BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    UNIQUE (flash_sale_id, product_id, product_sku_id),
    CONSTRAINT flash_sale_items_orig_price_pos    CHECK (original_price > 0),
    CONSTRAINT flash_sale_items_sale_price_pos    CHECK (sale_price > 0),
    CONSTRAINT flash_sale_items_sale_below_orig   CHECK (sale_price < original_price),
    CONSTRAINT flash_sale_items_quota_pos         CHECK (quota > 0),
    CONSTRAINT flash_sale_items_sold_count_nn     CHECK (sold_count >= 0),
    CONSTRAINT flash_sale_items_sold_le_quota     CHECK (sold_count <= quota)
);
CREATE INDEX idx_flash_sale_items_flash_sale_id ON flash_sale_items (flash_sale_id);
CREATE INDEX idx_flash_sale_items_product_id    ON flash_sale_items (product_id);
CREATE INDEX idx_flash_sale_items_is_active     ON flash_sale_items (flash_sale_id, is_active);
CREATE TRIGGER trg_flash_sale_items_updated_at BEFORE UPDATE ON flash_sale_items FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- DOMAIN 16: BANNERS / MARKETING
-- =============================================================================

CREATE TABLE banners (
    id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    title            VARCHAR(255)  NOT NULL,
    subtitle         VARCHAR(255),
    image_url        TEXT          NOT NULL,
    mobile_image_url TEXT,
    link_url         TEXT,
    link_target      VARCHAR(10)   NOT NULL DEFAULT '_self',
    type             banner_type   NOT NULL DEFAULT 'hero',
    status           banner_status NOT NULL DEFAULT 'active',
    sort_order       INTEGER       NOT NULL DEFAULT 0,
    target_page      VARCHAR(100),
    category_id      UUID          REFERENCES categories (id) ON DELETE SET NULL,
    starts_at        TIMESTAMPTZ,
    ends_at          TIMESTAMPTZ,
    created_by       UUID          REFERENCES users (id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT banners_link_target_valid CHECK (link_target IN ('_self', '_blank')),
    CONSTRAINT banners_sort_order_nn     CHECK (sort_order >= 0),
    CONSTRAINT banners_date_range        CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX idx_banners_type       ON banners (type);
CREATE INDEX idx_banners_status     ON banners (status);
CREATE INDEX idx_banners_sort_order ON banners (type, sort_order);
CREATE INDEX idx_banners_schedule   ON banners (starts_at, ends_at) WHERE starts_at IS NOT NULL OR ends_at IS NOT NULL;
CREATE INDEX idx_banners_category   ON banners (category_id) WHERE category_id IS NOT NULL;
CREATE TRIGGER trg_banners_updated_at BEFORE UPDATE ON banners FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- DOMAIN 17: CHAT SYSTEM
-- =============================================================================

CREATE TABLE conversations (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id        UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    seller_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    store_id        UUID        NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (buyer_id, store_id),
    CONSTRAINT conversations_buyer_seller_diff CHECK (buyer_id != seller_id)
);
CREATE INDEX idx_conversations_buyer_id        ON conversations (buyer_id);
CREATE INDEX idx_conversations_seller_id       ON conversations (seller_id);
CREATE INDEX idx_conversations_store_id        ON conversations (store_id);
CREATE INDEX idx_conversations_last_message_at ON conversations (last_message_at DESC);

CREATE TABLE messages (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID        NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    sender_id       UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    message         TEXT        NOT NULL,
    attachment_url  TEXT,
    is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT messages_content_not_empty CHECK (trim(message) != '')
);
CREATE INDEX idx_messages_conversation_id ON messages (conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender_id       ON messages (sender_id);
CREATE INDEX idx_messages_unread          ON messages (conversation_id, is_read) WHERE is_read = FALSE;

-- =============================================================================
-- DOMAIN 18: NOTIFICATION SYSTEM
-- =============================================================================

CREATE TABLE notifications (
    id             UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type           notification_type NOT NULL,
    title          VARCHAR(255)      NOT NULL,
    message        TEXT              NOT NULL,
    reference_id   UUID,
    reference_type VARCHAR(50),
    action_url     TEXT,
    is_read        BOOLEAN           NOT NULL DEFAULT FALSE,
    read_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_id   ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_is_read   ON notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type      ON notifications (type);
CREATE INDEX idx_notifications_reference ON notifications (reference_type, reference_id);

-- =============================================================================
-- DOMAIN 19: REPORTS / MODERATION
-- =============================================================================

-- report_categories: structured taxonomy for report reasons
CREATE TABLE report_categories (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id   UUID        REFERENCES report_categories (id) ON DELETE SET NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    applies_to  TEXT[]      NOT NULL DEFAULT '{}',
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, parent_id)
);
CREATE INDEX idx_report_categories_parent_id ON report_categories (parent_id);
CREATE INDEX idx_report_categories_active    ON report_categories (is_active);

CREATE TABLE reports (
    id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id        UUID          NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    report_category_id UUID          NOT NULL REFERENCES report_categories (id) ON DELETE RESTRICT,
    target_type        VARCHAR(50)   NOT NULL,
    target_id          UUID          NOT NULL,
    reason             TEXT          NOT NULL,
    evidence_urls      TEXT[]        NOT NULL DEFAULT '{}',
    status             report_status NOT NULL DEFAULT 'pending',
    reviewer_id        UUID          REFERENCES users (id) ON DELETE SET NULL,
    reviewed_at        TIMESTAMPTZ,
    resolution_note    TEXT,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT reports_reason_not_empty CHECK (trim(reason) != '')
);
CREATE INDEX idx_reports_reporter_id  ON reports (reporter_id);
CREATE INDEX idx_reports_target       ON reports (target_type, target_id);
CREATE INDEX idx_reports_status       ON reports (status);
CREATE INDEX idx_reports_category_id  ON reports (report_category_id);
CREATE INDEX idx_reports_created_at   ON reports (created_at DESC);
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- DOMAIN 20: ACTIVITY LOG  (replaces and supersedes audit_logs from v1)
-- Immutable, append-only. Partitioned by month in production.
-- =============================================================================

CREATE TABLE activity_logs (
    id          UUID          NOT NULL DEFAULT uuid_generate_v4(),
    user_id     UUID          REFERENCES users (id) ON DELETE SET NULL,
    activity    activity_type NOT NULL,
    target_type VARCHAR(100),
    target_id   UUID,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    user_agent  TEXT,
    session_id  VARCHAR(255),
    metadata    JSONB         NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE activity_logs_default PARTITION OF activity_logs DEFAULT;

ALTER TABLE activity_logs ADD PRIMARY KEY (id, created_at);

CREATE INDEX idx_activity_logs_user_id    ON activity_logs (user_id);
CREATE INDEX idx_activity_logs_activity   ON activity_logs (activity);
CREATE INDEX idx_activity_logs_target     ON activity_logs (target_type, target_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs (created_at DESC);
CREATE INDEX idx_activity_logs_session    ON activity_logs (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_activity_logs_auth       ON activity_logs (user_id, created_at DESC)
    WHERE activity IN ('auth_login', 'auth_logout', 'auth_password_changed');

-- =============================================================================
-- DOMAIN 21: ANALYTICS
-- =============================================================================

CREATE TABLE sales_analytics (
    id                  UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id            UUID           NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
    date                DATE           NOT NULL,
    total_revenue       NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_orders        INTEGER        NOT NULL DEFAULT 0,
    total_items         INTEGER        NOT NULL DEFAULT 0,
    new_customers       INTEGER        NOT NULL DEFAULT 0,
    returning_customers INTEGER        NOT NULL DEFAULT 0,
    total_visitors      INTEGER        NOT NULL DEFAULT 0,
    conversion_rate     NUMERIC(5, 4)  NOT NULL DEFAULT 0,
    avg_order_value     NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, date),
    CONSTRAINT sales_analytics_revenue_nn        CHECK (total_revenue >= 0),
    CONSTRAINT sales_analytics_orders_nn         CHECK (total_orders >= 0),
    CONSTRAINT sales_analytics_items_nn          CHECK (total_items >= 0),
    CONSTRAINT sales_analytics_visitors_nn       CHECK (total_visitors >= 0),
    CONSTRAINT sales_analytics_conversion_range  CHECK (conversion_rate BETWEEN 0 AND 1)
);
CREATE INDEX idx_sales_analytics_store_id ON sales_analytics (store_id);
CREATE INDEX idx_sales_analytics_date     ON sales_analytics (date DESC);
CREATE TRIGGER trg_sales_analytics_updated_at BEFORE UPDATE ON sales_analytics FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY — enable on all tables
-- =============================================================================

DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'roles','permissions','role_permissions',
        'users','user_roles','user_profiles','addresses',
        'brands',
        'stores','store_followers',
        'categories',
        'products','product_images','variant_options','variant_values','product_skus',
        'carts','cart_items',
        'wishlists','wishlist_items',
        'vouchers','user_vouchers',
        'orders','order_items',
        'payments','payment_logs',
        'shipments','shipment_tracking',
        'seller_balances','seller_balance_transactions','seller_withdrawals',
        'reviews','review_images',
        'flash_sales','flash_sale_items',
        'banners',
        'conversations','messages',
        'notifications',
        'report_categories','reports',
        'sales_analytics'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END;
$$;

-- activity_logs is partitioned; enable on parent + default partition
ALTER TABLE activity_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs_default ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements_default ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE(
        (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) IN ('admin','super_admin'),
        FALSE
    );
$$;

CREATE OR REPLACE FUNCTION is_seller()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE(
        (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) IN ('seller','admin','super_admin'),
        FALSE
    );
$$;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- ── RBAC tables ──────────────────────────────────────────────────────────────
CREATE POLICY roles_select ON roles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY roles_write  ON roles FOR ALL    USING (is_admin());

CREATE POLICY permissions_select ON permissions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY permissions_write  ON permissions FOR ALL    USING (is_admin());

CREATE POLICY role_permissions_select ON role_permissions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY role_permissions_write  ON role_permissions FOR ALL    USING (is_admin());

CREATE POLICY user_roles_select ON user_roles FOR SELECT USING (
    user_id = current_user_id() OR is_admin()
);
CREATE POLICY user_roles_write ON user_roles FOR ALL USING (is_admin());

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE POLICY users_select ON users FOR SELECT USING (
    auth_id = auth.uid()
    OR current_user_role() IN ('admin','super_admin','moderator','finance')
);
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (TRUE);   -- via trigger / service role
CREATE POLICY users_update ON users FOR UPDATE USING (
    auth_id = auth.uid() OR is_admin()
);

-- ── user_profiles ─────────────────────────────────────────────────────────────
CREATE POLICY user_profiles_select ON user_profiles FOR SELECT USING (
    user_id = current_user_id() OR current_user_role() IN ('admin','super_admin','moderator')
);
CREATE POLICY user_profiles_insert ON user_profiles FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY user_profiles_update ON user_profiles FOR UPDATE USING (user_id = current_user_id());

-- ── addresses ─────────────────────────────────────────────────────────────────
CREATE POLICY addresses_select ON addresses FOR SELECT USING (
    user_id = current_user_id() OR is_admin()
);
CREATE POLICY addresses_insert ON addresses FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY addresses_update ON addresses FOR UPDATE USING (user_id = current_user_id());
CREATE POLICY addresses_delete ON addresses FOR DELETE USING (user_id = current_user_id());

-- ── brands (public read, admin write) ─────────────────────────────────────────
CREATE POLICY brands_select ON brands FOR SELECT USING (is_active = TRUE OR is_admin());
CREATE POLICY brands_write  ON brands FOR ALL    USING (is_admin());

-- ── stores ────────────────────────────────────────────────────────────────────
CREATE POLICY stores_select ON stores FOR SELECT USING (
    status = 'active'
    OR seller_id = current_user_id()
    OR current_user_role() IN ('admin','super_admin','moderator')
);
CREATE POLICY stores_insert ON stores FOR INSERT WITH CHECK (
    seller_id = current_user_id() AND is_seller()
);
CREATE POLICY stores_update ON stores FOR UPDATE USING (
    seller_id = current_user_id() OR is_admin()
);

-- ── store_followers ───────────────────────────────────────────────────────────
CREATE POLICY store_followers_select ON store_followers FOR SELECT USING (
    user_id = current_user_id()
    OR store_id IN (SELECT id FROM stores WHERE seller_id = current_user_id())
    OR is_admin()
);
CREATE POLICY store_followers_insert ON store_followers FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY store_followers_delete ON store_followers FOR DELETE USING  (user_id = current_user_id());

-- ── categories (public read, admin write) ─────────────────────────────────────
CREATE POLICY categories_select ON categories FOR SELECT USING (status = 'active' OR is_admin());
CREATE POLICY categories_write  ON categories FOR ALL    USING (is_admin());

-- ── products ──────────────────────────────────────────────────────────────────
CREATE POLICY products_select ON products FOR SELECT USING (
    status = 'active'
    OR store_id IN (SELECT id FROM stores WHERE seller_id = current_user_id())
    OR current_user_role() IN ('admin','super_admin','moderator')
);
CREATE POLICY products_insert ON products FOR INSERT WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE seller_id = current_user_id()) AND is_seller()
);
CREATE POLICY products_update ON products FOR UPDATE USING (
    store_id IN (SELECT id FROM stores WHERE seller_id = current_user_id()) OR is_admin()
);
CREATE POLICY products_delete ON products FOR DELETE USING (
    store_id IN (SELECT id FROM stores WHERE seller_id = current_user_id()) OR is_admin()
);

-- ── product_images ────────────────────────────────────────────────────────────
CREATE POLICY product_images_select ON product_images FOR SELECT USING (TRUE);
CREATE POLICY product_images_write  ON product_images FOR ALL USING (
    product_id IN (
        SELECT p.id FROM products p JOIN stores s ON s.id = p.store_id WHERE s.seller_id = current_user_id()
    ) OR is_admin()
);

-- ── variant_options / variant_values / product_skus ──────────────────────────
CREATE POLICY variant_options_select ON variant_options FOR SELECT USING (TRUE);
CREATE POLICY variant_options_write  ON variant_options FOR ALL USING (
    product_id IN (
        SELECT p.id FROM products p JOIN stores s ON s.id = p.store_id WHERE s.seller_id = current_user_id()
    ) OR is_admin()
);

CREATE POLICY variant_values_select ON variant_values FOR SELECT USING (TRUE);
CREATE POLICY variant_values_write  ON variant_values FOR ALL USING (
    variant_option_id IN (
        SELECT vo.id FROM variant_options vo
        JOIN products p ON p.id = vo.product_id
        JOIN stores s ON s.id = p.store_id
        WHERE s.seller_id = current_user_id()
    ) OR is_admin()
);

CREATE POLICY product_skus_select ON product_skus FOR SELECT USING (
    is_active = TRUE
    OR product_id IN (
        SELECT p.id FROM products p JOIN stores s ON s.id = p.store_id WHERE s.seller_id = current_user_id()
    ) OR is_admin()
);
CREATE POLICY product_skus_write ON product_skus FOR ALL USING (
    product_id IN (
        SELECT p.id FROM products p JOIN stores s ON s.id = p.store_id WHERE s.seller_id = current_user_id()
    ) OR is_admin()
);

-- ── stock_movements ───────────────────────────────────────────────────────────
CREATE POLICY stock_movements_select ON stock_movements FOR SELECT USING (
    product_id IN (
        SELECT p.id FROM products p JOIN stores s ON s.id = p.store_id WHERE s.seller_id = current_user_id()
    ) OR is_admin() OR current_user_role() = 'finance'
);
CREATE POLICY stock_movements_insert ON stock_movements FOR INSERT WITH CHECK (
    product_id IN (
        SELECT p.id FROM products p JOIN stores s ON s.id = p.store_id WHERE s.seller_id = current_user_id()
    ) OR is_admin()
);

-- ── carts / cart_items ────────────────────────────────────────────────────────
CREATE POLICY carts_all      ON carts      FOR ALL USING (user_id = current_user_id());
CREATE POLICY cart_items_all ON cart_items FOR ALL USING (
    cart_id IN (SELECT id FROM carts WHERE user_id = current_user_id())
);

-- ── wishlists / wishlist_items ────────────────────────────────────────────────
CREATE POLICY wishlists_all      ON wishlists      FOR ALL USING (user_id = current_user_id());
CREATE POLICY wishlist_items_all ON wishlist_items FOR ALL USING (
    wishlist_id IN (SELECT id FROM wishlists WHERE user_id = current_user_id())
);

-- ── vouchers / user_vouchers ──────────────────────────────────────────────────
CREATE POLICY vouchers_select ON vouchers FOR SELECT USING (
    status = 'active'
    OR store_id IN (SELECT id FROM stores WHERE seller_id = current_user_id())
    OR is_admin()
);
CREATE POLICY vouchers_write ON vouchers FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE seller_id = current_user_id()) OR is_admin()
);
CREATE POLICY user_vouchers_all ON user_vouchers FOR ALL USING (
    user_id = current_user_id() OR is_admin()
);

-- ── orders ────────────────────────────────────────────────────────────────────
CREATE POLICY orders_select ON orders FOR SELECT USING (
    buyer_id = current_user_id()
    OR id IN (
        SELECT DISTINCT order_id FROM order_items oi
        JOIN stores s ON s.id = oi.store_id WHERE s.seller_id = current_user_id()
    )
    OR current_user_role() IN ('admin','super_admin','finance','moderator')
);
CREATE POLICY orders_insert ON orders FOR INSERT WITH CHECK (buyer_id = current_user_id());
CREATE POLICY orders_update ON orders FOR UPDATE USING (
    buyer_id = current_user_id() OR is_admin()
);

-- ── order_items ───────────────────────────────────────────────────────────────
CREATE POLICY order_items_select ON order_items FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE buyer_id = current_user_id())
    OR store_id IN (SELECT id FROM stores WHERE seller_id = current_user_id())
    OR current_user_role() IN ('admin','super_admin','finance')
);
CREATE POLICY order_items_insert ON order_items FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE buyer_id = current_user_id())
);
CREATE POLICY order_items_update ON order_items FOR UPDATE USING (
    store_id IN (SELECT id FROM stores WHERE seller_id = current_user_id()) OR is_admin()
);

-- ── payments / payment_logs ───────────────────────────────────────────────────
CREATE POLICY payments_select ON payments FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE buyer_id = current_user_id())
    OR current_user_role() IN ('admin','super_admin','finance')
);
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE buyer_id = current_user_id()) OR is_admin()
);
CREATE POLICY payment_logs_select ON payment_logs FOR SELECT USING (
    payment_id IN (
        SELECT p.id FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE o.buyer_id = current_user_id()
    ) OR current_user_role() IN ('admin','super_admin','finance')
);
CREATE POLICY payment_logs_insert ON payment_logs FOR INSERT WITH CHECK (TRUE);

-- ── shipments / shipment_tracking ────────────────────────────────────────────
CREATE POLICY shipments_select ON shipments FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE buyer_id = current_user_id())
    OR order_id IN (
        SELECT DISTINCT oi.order_id FROM order_items oi
        JOIN stores s ON s.id = oi.store_id WHERE s.seller_id = current_user_id()
    ) OR is_admin()
);
CREATE POLICY shipment_tracking_select ON shipment_tracking FOR SELECT USING (
    shipment_id IN (
        SELECT sh.id FROM shipments sh
        JOIN orders o ON o.id = sh.order_id WHERE o.buyer_id = current_user_id()
    ) OR is_admin()
);
CREATE POLICY shipment_tracking_insert ON shipment_tracking FOR INSERT WITH CHECK (TRUE); -- via service role

-- ── seller finance ────────────────────────────────────────────────────────────
CREATE POLICY seller_balances_select ON seller_balances FOR SELECT USING (
    seller_id = current_user_id() OR current_user_role() IN ('admin','super_admin','finance')
);
CREATE POLICY seller_balance_transactions_select ON seller_balance_transactions FOR SELECT USING (
    seller_id = current_user_id() OR current_user_role() IN ('admin','super_admin','finance')
);
CREATE POLICY seller_withdrawals_select ON seller_withdrawals FOR SELECT USING (
    seller_id = current_user_id() OR current_user_role() IN ('admin','super_admin','finance')
);
CREATE POLICY seller_withdrawals_insert ON seller_withdrawals FOR INSERT WITH CHECK (
    seller_id = current_user_id() AND is_seller()
);
CREATE POLICY seller_withdrawals_update ON seller_withdrawals FOR UPDATE USING (
    current_user_role() IN ('admin','super_admin','finance')
);

-- ── reviews / review_images ───────────────────────────────────────────────────
CREATE POLICY reviews_select ON reviews FOR SELECT USING (TRUE);
CREATE POLICY reviews_insert ON reviews FOR INSERT WITH CHECK (
    user_id = current_user_id()
    AND order_item_id IN (
        SELECT oi.id FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.buyer_id = current_user_id() AND o.status = 'completed'
    )
);
CREATE POLICY reviews_update ON reviews FOR UPDATE USING (
    user_id = current_user_id()
    OR EXISTS (
        SELECT 1 FROM order_items oi
        JOIN stores s ON s.id = oi.store_id
        WHERE oi.id = reviews.order_item_id AND s.seller_id = current_user_id()
    )
    OR is_admin()
);
CREATE POLICY reviews_delete ON reviews FOR DELETE USING (
    user_id = current_user_id() OR is_admin() OR current_user_role() = 'moderator'
);
CREATE POLICY review_images_select ON review_images FOR SELECT USING (TRUE);
CREATE POLICY review_images_write  ON review_images FOR ALL USING (
    review_id IN (SELECT id FROM reviews WHERE user_id = current_user_id()) OR is_admin()
);

-- ── flash sales ───────────────────────────────────────────────────────────────
CREATE POLICY flash_sales_select      ON flash_sales      FOR SELECT USING (status IN ('active','scheduled','ended') OR is_admin());
CREATE POLICY flash_sales_write       ON flash_sales      FOR ALL    USING (is_admin());
CREATE POLICY flash_sale_items_select ON flash_sale_items FOR SELECT USING (TRUE);
CREATE POLICY flash_sale_items_write  ON flash_sale_items FOR ALL    USING (is_admin());

-- ── banners (public read, admin write) ────────────────────────────────────────
CREATE POLICY banners_select ON banners FOR SELECT USING (status = 'active' OR is_admin());
CREATE POLICY banners_write  ON banners FOR ALL    USING (is_admin());

-- ── chat ──────────────────────────────────────────────────────────────────────
CREATE POLICY conversations_all ON conversations FOR ALL USING (
    buyer_id = current_user_id() OR seller_id = current_user_id()
    OR current_user_role() IN ('admin','super_admin','moderator')
);
CREATE POLICY messages_select ON messages FOR SELECT USING (
    conversation_id IN (
        SELECT id FROM conversations WHERE buyer_id = current_user_id() OR seller_id = current_user_id()
    ) OR current_user_role() IN ('admin','super_admin','moderator')
);
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (
    sender_id = current_user_id()
    AND conversation_id IN (
        SELECT id FROM conversations WHERE buyer_id = current_user_id() OR seller_id = current_user_id()
    )
);

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE POLICY notifications_all ON notifications FOR ALL USING (
    user_id = current_user_id() OR is_admin()
);

-- ── report_categories / reports ───────────────────────────────────────────────
CREATE POLICY report_categories_select ON report_categories FOR SELECT USING (is_active = TRUE OR is_admin());
CREATE POLICY report_categories_write  ON report_categories FOR ALL    USING (is_admin());
CREATE POLICY reports_select ON reports FOR SELECT USING (
    reporter_id = current_user_id() OR current_user_role() IN ('admin','super_admin','moderator')
);
CREATE POLICY reports_insert ON reports FOR INSERT WITH CHECK (reporter_id = current_user_id());
CREATE POLICY reports_update ON reports FOR UPDATE USING (
    current_user_role() IN ('admin','super_admin','moderator')
);

-- ── activity_logs (admin / finance / moderator read; any insert via service role) ──
CREATE POLICY activity_logs_select ON activity_logs FOR SELECT USING (
    current_user_role() IN ('admin','super_admin','moderator','finance')
);
CREATE POLICY activity_logs_insert ON activity_logs FOR INSERT WITH CHECK (TRUE);

-- ── sales_analytics ───────────────────────────────────────────────────────────
CREATE POLICY sales_analytics_select ON sales_analytics FOR SELECT USING (
    store_id IN (SELECT id FROM stores WHERE seller_id = current_user_id())
    OR current_user_role() IN ('admin','super_admin','finance')
);

-- =============================================================================
-- TRIGGERS — BUSINESS LOGIC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Bootstrap: auto-create profile, cart, wishlist, seller_balance on user insert
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bootstrap_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO user_profiles  (user_id) VALUES (NEW.id);
    INSERT INTO carts          (user_id) VALUES (NEW.id);
    INSERT INTO wishlists      (user_id) VALUES (NEW.id);
    INSERT INTO seller_balances(seller_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bootstrap_new_user
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION fn_bootstrap_new_user();

-- -----------------------------------------------------------------------------
-- Sync users.role (denorm cache) whenever user_roles changes
-- Priority order: super_admin > admin > finance > moderator > seller > buyer
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_user_role_cache()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_uid  UUID;
    v_role TEXT;
BEGIN
    v_uid := COALESCE(NEW.user_id, OLD.user_id);

    SELECT r.name INTO v_role
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_uid
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    ORDER BY CASE r.name
        WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1
        WHEN 'finance'     THEN 2 WHEN 'moderator' THEN 3
        WHEN 'seller'      THEN 4 WHEN 'buyer' THEN 5 ELSE 9
    END
    LIMIT 1;

    UPDATE users SET role = COALESCE(v_role, 'buyer') WHERE id = v_uid;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_user_role_cache
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION fn_sync_user_role_cache();

-- -----------------------------------------------------------------------------
-- Enforce single default address per user
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_enforce_single_default_address()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE addresses SET is_default = FALSE
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_default_address
    AFTER INSERT OR UPDATE ON addresses
    FOR EACH ROW WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION fn_enforce_single_default_address();

-- -----------------------------------------------------------------------------
-- Aggregate product stock from SKUs when product has_variants = TRUE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_product_stock_from_skus()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_pid UUID;
BEGIN
    v_pid := COALESCE(NEW.product_id, OLD.product_id);
    UPDATE products
    SET stock = (
        SELECT COALESCE(SUM(stock), 0) FROM product_skus
        WHERE product_id = v_pid AND is_active = TRUE
    )
    WHERE id = v_pid AND has_variants = TRUE;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_product_stock_from_skus
    AFTER INSERT OR UPDATE OF stock OR DELETE ON product_skus
    FOR EACH ROW EXECUTE FUNCTION fn_sync_product_stock_from_skus();

-- -----------------------------------------------------------------------------
-- Refresh product rating + review_count on review insert/update/delete
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_refresh_product_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_pid   UUID;
    v_avg   NUMERIC(3, 2);
    v_count INTEGER;
BEGIN
    v_pid := COALESCE(NEW.product_id, OLD.product_id);
    SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0.00), COUNT(*)
    INTO v_avg, v_count FROM reviews WHERE product_id = v_pid;
    UPDATE products SET rating = v_avg, review_count = v_count WHERE id = v_pid;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_refresh_product_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION fn_refresh_product_rating();

-- -----------------------------------------------------------------------------
-- Refresh store rating when product rating changes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_refresh_store_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_sid UUID;
BEGIN
    SELECT store_id INTO v_sid FROM products WHERE id = COALESCE(NEW.id, OLD.id);
    IF v_sid IS NOT NULL THEN
        UPDATE stores
        SET rating = COALESCE((
                SELECT ROUND(AVG(p.rating)::NUMERIC, 2)
                FROM products p
                WHERE p.store_id = v_sid AND p.status = 'active' AND p.rating > 0
            ), 0.00),
            review_count = COALESCE((
                SELECT SUM(p.review_count) FROM products p WHERE p.store_id = v_sid
            ), 0)
        WHERE id = v_sid;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_refresh_store_rating
    AFTER UPDATE OF rating, review_count ON products
    FOR EACH ROW EXECUTE FUNCTION fn_refresh_store_rating();

-- -----------------------------------------------------------------------------
-- Reserve stock on order_item insert (writes stock_movements record)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_reserve_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_before_product INTEGER;
    v_before_sku     INTEGER;
BEGIN
    -- Lock & check product stock
    SELECT stock INTO v_before_product FROM products WHERE id = NEW.product_id FOR UPDATE;
    IF v_before_product IS NULL THEN
        RAISE EXCEPTION 'Product % not found', NEW.product_id USING ERRCODE = 'P0001';
    END IF;
    IF v_before_product < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient stock: product % has %, need %',
            NEW.product_id, v_before_product, NEW.quantity USING ERRCODE = 'P0001';
    END IF;

    UPDATE products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;

    INSERT INTO stock_movements (
        product_id, product_sku_id, movement_type,
        quantity_delta, stock_before, stock_after, reference_type, reference_id
    ) VALUES (
        NEW.product_id, NEW.product_sku_id, 'sale',
        -NEW.quantity, v_before_product, v_before_product - NEW.quantity,
        'order', NEW.order_id
    );

    -- SKU stock if specified
    IF NEW.product_sku_id IS NOT NULL THEN
        SELECT stock INTO v_before_sku FROM product_skus WHERE id = NEW.product_sku_id FOR UPDATE;
        IF v_before_sku < NEW.quantity THEN
            RAISE EXCEPTION 'Insufficient SKU stock: sku % has %, need %',
                NEW.product_sku_id, v_before_sku, NEW.quantity USING ERRCODE = 'P0001';
        END IF;
        UPDATE product_skus SET stock = stock - NEW.quantity WHERE id = NEW.product_sku_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reserve_product_stock
    AFTER INSERT ON order_items
    FOR EACH ROW EXECUTE FUNCTION fn_reserve_product_stock();

-- -----------------------------------------------------------------------------
-- Restore stock on order cancellation / refund (writes stock_movements records)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_restore_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IN ('cancelled','refunded')
       AND OLD.status NOT IN ('cancelled','refunded') THEN

        -- Restore product stock
        UPDATE products p
        SET stock = p.stock + oi.quantity
        FROM order_items oi WHERE oi.order_id = NEW.id AND p.id = oi.product_id;

        -- Restore SKU stock
        UPDATE product_skus sk
        SET stock = sk.stock + oi.quantity
        FROM order_items oi
        WHERE oi.order_id = NEW.id AND sk.id = oi.product_sku_id AND oi.product_sku_id IS NOT NULL;

        -- Audit trail
        INSERT INTO stock_movements (
            product_id, product_sku_id, movement_type,
            quantity_delta, stock_before, stock_after, reference_type, reference_id
        )
        SELECT oi.product_id, oi.product_sku_id, 'return',
               oi.quantity, p.stock - oi.quantity, p.stock, 'order', NEW.id
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restore_product_stock
    AFTER UPDATE OF status ON orders
    FOR EACH ROW EXECUTE FUNCTION fn_restore_product_stock();

-- -----------------------------------------------------------------------------
-- On order completion: update sold_count, store revenue, seller balances
-- Platform fee rate: 2% (move to a config table for production)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_complete_order_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_fee_rate NUMERIC := 0.02;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- sold_count
        UPDATE products p SET sold_count = p.sold_count + oi.quantity
        FROM order_items oi WHERE oi.order_id = NEW.id AND p.id = oi.product_id;

        -- store aggregates
        UPDATE stores s
        SET total_sales   = s.total_sales + agg.item_count,
            total_revenue = s.total_revenue + agg.revenue
        FROM (
            SELECT store_id, COUNT(*) AS item_count, SUM(subtotal) AS revenue
            FROM order_items WHERE order_id = NEW.id GROUP BY store_id
        ) agg WHERE s.id = agg.store_id;

        -- seller balance credit
        UPDATE seller_balances sb
        SET available_balance = sb.available_balance + agg.net,
            total_earned      = sb.total_earned      + agg.net
        FROM (
            SELECT seller_id, SUM(subtotal) * (1 - v_fee_rate) AS net
            FROM order_items WHERE order_id = NEW.id GROUP BY seller_id
        ) agg WHERE sb.seller_id = agg.seller_id;

        -- balance ledger
        INSERT INTO seller_balance_transactions (
            seller_id, transaction_type, amount,
            balance_before, balance_after, reference_type, reference_id, description
        )
        SELECT agg.seller_id, 'credit', agg.net,
               sb.available_balance - agg.net, sb.available_balance,
               'order', NEW.id, 'Order completed: ' || NEW.order_number
        FROM (
            SELECT seller_id, SUM(subtotal) * (1 - v_fee_rate) AS net
            FROM order_items WHERE order_id = NEW.id GROUP BY seller_id
        ) agg
        JOIN seller_balances sb ON sb.seller_id = agg.seller_id;

        UPDATE orders SET completed_at = NOW() WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_complete_order_stats
    AFTER UPDATE OF status ON orders
    FOR EACH ROW EXECUTE FUNCTION fn_complete_order_stats();

-- -----------------------------------------------------------------------------
-- Update conversations.last_message_at on new message
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_last_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION fn_update_conversation_last_message();

-- -----------------------------------------------------------------------------
-- Voucher: validate + decrement quota on use
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_decrement_voucher_quota()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v vouchers%ROWTYPE;
BEGIN
    IF NEW.used = TRUE AND (OLD.used = FALSE OR OLD.used IS NULL) THEN
        SELECT * INTO v FROM vouchers WHERE id = NEW.voucher_id FOR UPDATE;
        IF v.status != 'active'             THEN RAISE EXCEPTION 'Voucher % not active', NEW.voucher_id USING ERRCODE = 'P0002'; END IF;
        IF v.end_date < NOW()               THEN RAISE EXCEPTION 'Voucher % expired',    NEW.voucher_id USING ERRCODE = 'P0002'; END IF;
        IF v.quota IS NOT NULL AND v.used_count >= v.quota
                                            THEN RAISE EXCEPTION 'Voucher % exhausted',  NEW.voucher_id USING ERRCODE = 'P0002'; END IF;
        UPDATE vouchers SET used_count = used_count + 1 WHERE id = NEW.voucher_id;
        NEW.used_at := NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_decrement_voucher_quota
    BEFORE UPDATE OF used ON user_vouchers
    FOR EACH ROW EXECUTE FUNCTION fn_decrement_voucher_quota();

-- -----------------------------------------------------------------------------
-- Flash sale: guard quota ceiling and auto-deactivate when sold out
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_flash_sale_item_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.sold_count > NEW.quota THEN
        RAISE EXCEPTION 'Flash sale item % quota exceeded', NEW.id USING ERRCODE = 'P0003';
    END IF;
    IF NEW.sold_count = NEW.quota THEN NEW.is_active := FALSE; END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_flash_sale_item_guard
    BEFORE UPDATE OF sold_count ON flash_sale_items
    FOR EACH ROW EXECUTE FUNCTION fn_flash_sale_item_guard();

-- -----------------------------------------------------------------------------
-- store_followers: maintain stores.follower_count counter-cache
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_follower_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF    TG_OP = 'INSERT' THEN UPDATE stores SET follower_count = follower_count + 1           WHERE id = NEW.store_id;
    ELSIF TG_OP = 'DELETE' THEN UPDATE stores SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.store_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_follower_count
    AFTER INSERT OR DELETE ON store_followers
    FOR EACH ROW EXECUTE FUNCTION fn_update_follower_count();

-- -----------------------------------------------------------------------------
-- Seller withdrawal approval: debit available_balance + write ledger entry
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_process_withdrawal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_balance NUMERIC(15, 2);
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        SELECT available_balance INTO v_balance
        FROM seller_balances WHERE seller_id = NEW.seller_id FOR UPDATE;

        IF v_balance < NEW.amount THEN
            RAISE EXCEPTION 'Insufficient balance: available %, requested %',
                v_balance, NEW.amount USING ERRCODE = 'P0004';
        END IF;

        UPDATE seller_balances
        SET available_balance = available_balance - NEW.amount,
            total_withdrawn   = total_withdrawn   + NEW.amount
        WHERE seller_id = NEW.seller_id;

        INSERT INTO seller_balance_transactions (
            seller_id, transaction_type, amount,
            balance_before, balance_after, reference_type, reference_id, description
        ) VALUES (
            NEW.seller_id, 'debit', NEW.amount,
            v_balance, v_balance - NEW.amount,
            'withdrawal', NEW.id, 'Withdrawal: ' || COALESCE(NEW.reference_no, NEW.id::TEXT)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_process_withdrawal
    AFTER UPDATE OF status ON seller_withdrawals
    FOR EACH ROW EXECUTE FUNCTION fn_process_withdrawal();

-- -----------------------------------------------------------------------------
-- shipment_tracking: sync shipments.shipping_status from latest event
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_shipment_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE shipments
    SET shipping_status = NEW.status,
        shipped_at  = CASE WHEN NEW.status = 'picked_up' THEN COALESCE(shipped_at,  NEW.event_time) ELSE shipped_at  END,
        received_at = CASE WHEN NEW.status = 'delivered' THEN COALESCE(received_at, NEW.event_time) ELSE received_at END
    WHERE id = NEW.shipment_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_shipment_status
    AFTER INSERT ON shipment_tracking
    FOR EACH ROW EXECUTE FUNCTION fn_sync_shipment_status();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Active products with full denormalised context for listing pages
CREATE VIEW vw_active_products AS
SELECT
    p.id,
    p.name,
    p.slug,
    p.description,
    p.condition,
    p.price,
    p.discount_price,
    p.stock,
    p.weight,
    p.has_variants,
    p.rating,
    p.review_count,
    p.sold_count,
    p.view_count,
    p.tags,
    p.meta_title,
    p.meta_description,
    p.created_at,
    -- store
    s.id             AS store_id,
    s.store_name,
    s.slug           AS store_slug,
    s.logo_url       AS store_logo_url,
    s.rating         AS store_rating,
    s.city           AS store_city,
    -- category
    c.id             AS category_id,
    c.name           AS category_name,
    c.slug           AS category_slug,
    -- brand
    b.id             AS brand_id,
    b.name           AS brand_name,
    b.slug           AS brand_slug,
    b.is_verified    AS brand_is_verified,
    -- primary image (subquery; one round-trip, no join fan-out)
    (
        SELECT pi.image_url FROM product_images pi
        WHERE pi.product_id = p.id AND pi.is_primary = TRUE
        ORDER BY pi.sort_order LIMIT 1
    )                AS primary_image_url,
    -- cheapest active SKU price (for has_variants products)
    (
        SELECT MIN(ps.price) FROM product_skus ps
        WHERE ps.product_id = p.id AND ps.is_active = TRUE
    )                AS min_sku_price,
    (
        SELECT MIN(ps.discount_price) FROM product_skus ps
        WHERE ps.product_id = p.id AND ps.is_active = TRUE
          AND ps.discount_price IS NOT NULL
    )                AS min_sku_discount_price
FROM  products   p
JOIN  stores     s ON s.id = p.store_id
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN brands     b ON b.id = p.brand_id
WHERE p.status = 'active'
  AND s.status = 'active';

-- -----------------------------------------------------------------------------
-- Order summary (buyer dashboard + seller dashboard)
-- -----------------------------------------------------------------------------
CREATE VIEW vw_order_summary AS
SELECT
    o.id,
    o.order_number,
    o.status,
    o.payment_status,
    o.subtotal,
    o.shipping_cost,
    o.discount_amount,
    o.platform_fee,
    o.total_amount,
    o.created_at,
    o.completed_at,
    o.buyer_id,
    COUNT(oi.id)      AS item_count,
    SUM(oi.quantity)  AS total_quantity
FROM  orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id;

-- -----------------------------------------------------------------------------
-- Seller revenue snapshot
-- -----------------------------------------------------------------------------
CREATE VIEW vw_seller_revenue AS
SELECT
    s.id                   AS store_id,
    s.store_name,
    s.seller_id,
    s.status               AS store_status,
    s.rating               AS store_rating,
    s.review_count,
    s.total_sales,
    s.total_revenue,
    sb.available_balance,
    sb.pending_balance,
    sb.total_earned,
    sb.total_withdrawn
FROM  stores          s
JOIN  seller_balances sb ON sb.seller_id = s.seller_id;

-- -----------------------------------------------------------------------------
-- Active flash sale items with product info and remaining quota
-- -----------------------------------------------------------------------------
CREATE VIEW vw_active_flash_sale_items AS
SELECT
    fsi.id,
    fsi.flash_sale_id,
    fs.title                                                          AS flash_sale_title,
    fs.ends_at                                                        AS flash_sale_ends_at,
    fsi.product_id,
    p.name                                                            AS product_name,
    p.slug                                                            AS product_slug,
    fsi.product_sku_id,
    fsi.original_price,
    fsi.sale_price,
    ROUND(((fsi.original_price - fsi.sale_price)
           / fsi.original_price * 100)::NUMERIC, 0)                  AS discount_pct,
    fsi.quota,
    fsi.sold_count,
    fsi.quota - fsi.sold_count                                        AS remaining_quota,
    (
        SELECT pi.image_url FROM product_images pi
        WHERE pi.product_id = fsi.product_id AND pi.is_primary = TRUE
        ORDER BY pi.sort_order LIMIT 1
    )                                                                 AS product_image_url
FROM  flash_sale_items fsi
JOIN  flash_sales      fs ON fs.id  = fsi.flash_sale_id
JOIN  products         p  ON p.id   = fsi.product_id
WHERE fs.status    = 'active'
  AND fsi.is_active = TRUE
  AND fs.ends_at    > NOW();

-- -----------------------------------------------------------------------------
-- Pending seller withdrawals (finance dashboard)
-- -----------------------------------------------------------------------------
CREATE VIEW vw_pending_withdrawals AS
SELECT
    sw.id,
    sw.seller_id,
    up.full_name                AS seller_name,
    u.email                     AS seller_email,
    sw.amount,
    sw.fee_amount,
    sw.net_amount,
    sw.bank_name,
    sw.bank_account_no,
    sw.bank_account_name,
    sw.status,
    sw.created_at,
    sb.available_balance        AS current_available_balance
FROM  seller_withdrawals  sw
JOIN  users               u  ON u.id  = sw.seller_id
LEFT JOIN user_profiles   up ON up.user_id = sw.seller_id
JOIN  seller_balances     sb ON sb.seller_id = sw.seller_id
WHERE sw.status = 'pending'
ORDER BY sw.created_at;

-- -----------------------------------------------------------------------------
-- Unread message counts per conversation participant
-- -----------------------------------------------------------------------------
CREATE VIEW vw_unread_message_counts AS
SELECT
    m.conversation_id,
    c.buyer_id,
    c.seller_id,
    COUNT(*) FILTER (WHERE m.is_read = FALSE AND m.sender_id != c.buyer_id)  AS buyer_unread,
    COUNT(*) FILTER (WHERE m.is_read = FALSE AND m.sender_id != c.seller_id) AS seller_unread
FROM  messages      m
JOIN  conversations c ON c.id = m.conversation_id
GROUP BY m.conversation_id, c.buyer_id, c.seller_id;

-- -----------------------------------------------------------------------------
-- Store follower list with profile info
-- -----------------------------------------------------------------------------
CREATE VIEW vw_store_followers AS
SELECT
    sf.store_id,
    sf.user_id,
    up.full_name,
    up.avatar_url,
    sf.created_at AS followed_at
FROM  store_followers sf
LEFT JOIN user_profiles up ON up.user_id = sf.user_id;

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- ── System roles ──────────────────────────────────────────────────────────────
INSERT INTO roles (name, label, description, is_system) VALUES
    ('super_admin', 'Super Administrator', 'Full platform access; cannot be restricted or deleted', TRUE),
    ('admin',       'Administrator',       'Platform management, moderation, configuration',        TRUE),
    ('finance',     'Finance',             'Financial reports and withdrawal management',            TRUE),
    ('moderator',   'Moderator',           'Content moderation and user report resolution',         TRUE),
    ('seller',      'Seller',              'Store and product management',                          TRUE),
    ('buyer',       'Buyer',               'Purchasing products and writing reviews',               TRUE)
ON CONFLICT (name) DO NOTHING;

-- ── Core permissions ──────────────────────────────────────────────────────────
INSERT INTO permissions (name, label, resource, action) VALUES
    -- product
    ('product:create',       'Create Product',       'product',    'create'),
    ('product:read',         'Read Product',         'product',    'read'),
    ('product:update',       'Update Product',       'product',    'update'),
    ('product:delete',       'Delete Product',       'product',    'delete'),
    ('product:approve',      'Approve Product',      'product',    'approve'),
    ('product:suspend',      'Suspend Product',      'product',    'suspend'),
    -- order
    ('order:read',           'Read Order',           'order',      'read'),
    ('order:update',         'Update Order',         'order',      'update'),
    ('order:cancel',         'Cancel Order',         'order',      'cancel'),
    ('order:refund',         'Refund Order',         'order',      'refund'),
    -- user
    ('user:read',            'Read User',            'user',       'read'),
    ('user:update',          'Update User',          'user',       'update'),
    ('user:suspend',         'Suspend User',         'user',       'suspend'),
    ('user:ban',             'Ban User',             'user',       'ban'),
    -- store
    ('store:create',         'Create Store',         'store',      'create'),
    ('store:read',           'Read Store',           'store',      'read'),
    ('store:update',         'Update Store',         'store',      'update'),
    ('store:suspend',        'Suspend Store',        'store',      'suspend'),
    ('store:approve',        'Approve Store',        'store',      'approve'),
    -- finance
    ('finance:read',         'Read Finance Data',    'finance',    'read'),
    ('finance:withdrawal',   'Approve Withdrawal',   'finance',    'withdrawal'),
    -- report
    ('report:read',          'Read Report',          'report',     'read'),
    ('report:resolve',       'Resolve Report',       'report',     'resolve'),
    -- category
    ('category:create',      'Create Category',      'category',   'create'),
    ('category:update',      'Update Category',      'category',   'update'),
    ('category:delete',      'Delete Category',      'category',   'delete'),
    -- brand
    ('brand:create',         'Create Brand',         'brand',      'create'),
    ('brand:update',         'Update Brand',         'brand',      'update'),
    ('brand:delete',         'Delete Brand',         'brand',      'delete'),
    -- flash sale
    ('flash_sale:create',    'Create Flash Sale',    'flash_sale', 'create'),
    ('flash_sale:update',    'Update Flash Sale',    'flash_sale', 'update'),
    -- banner
    ('banner:create',        'Create Banner',        'banner',     'create'),
    ('banner:update',        'Update Banner',        'banner',     'update'),
    ('banner:delete',        'Delete Banner',        'banner',     'delete'),
    -- analytics
    ('analytics:read',       'Read Analytics',       'analytics',  'read'),
    -- voucher
    ('voucher:create',       'Create Voucher',       'voucher',    'create'),
    ('voucher:update',       'Update Voucher',       'voucher',    'update'),
    ('voucher:delete',       'Delete Voucher',       'voucher',    'delete')
ON CONFLICT (resource, action) DO NOTHING;

-- ── Role → permission assignments ─────────────────────────────────────────────

-- buyer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'buyer'
  AND p.name IN (
    'product:read', 'store:read', 'order:read', 'order:cancel', 'report:read'
  )
ON CONFLICT DO NOTHING;

-- seller
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'seller'
  AND p.name IN (
    'product:create', 'product:read', 'product:update', 'product:delete',
    'order:read', 'order:update',
    'store:create', 'store:read', 'store:update',
    'finance:read', 'analytics:read',
    'voucher:create', 'voucher:update', 'voucher:delete',
    'report:read'
  )
ON CONFLICT DO NOTHING;

-- moderator
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'moderator'
  AND p.name IN (
    'product:read', 'product:suspend',
    'store:read',   'store:suspend',
    'user:read',    'user:suspend',
    'order:read',
    'report:read',  'report:resolve'
  )
ON CONFLICT DO NOTHING;

-- finance
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'finance'
  AND p.name IN (
    'finance:read', 'finance:withdrawal',
    'order:read',
    'user:read',
    'analytics:read',
    'report:read'
  )
ON CONFLICT DO NOTHING;

-- admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- super_admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- ── Root categories ───────────────────────────────────────────────────────────
INSERT INTO categories (name, slug, sort_order, depth, status) VALUES
    ('Electronics',       'electronics',     1,  0, 'active'),
    ('Fashion',           'fashion',         2,  0, 'active'),
    ('Home & Living',     'home-living',     3,  0, 'active'),
    ('Sports & Outdoors', 'sports-outdoors', 4,  0, 'active'),
    ('Books',             'books',           5,  0, 'active'),
    ('Beauty & Health',   'beauty-health',   6,  0, 'active'),
    ('Automotive',        'automotive',      7,  0, 'active'),
    ('Groceries',         'groceries',       8,  0, 'active'),
    ('Toys & Kids',       'toys-kids',       9,  0, 'active'),
    ('Office Supplies',   'office-supplies', 10, 0, 'active')
ON CONFLICT (slug) DO NOTHING;

-- Electronics sub-categories (depth = 1)
INSERT INTO categories (parent_id, name, slug, sort_order, depth, status)
SELECT c.id, sub.name, sub.slug, sub.sort_order, 1, 'active'
FROM   categories c,
       (VALUES
           ('Smartphones',            'smartphones',              1),
           ('Laptops',                'laptops',                  2),
           ('Tablets',                'tablets',                  3),
           ('Audio',                  'audio',                    4),
           ('Cameras',                'cameras',                  5),
           ('Gaming',                 'gaming',                   6),
           ('Smart Home',             'smart-home',               7),
           ('Wearables',              'wearables',                8),
           ('Networking',             'networking',               9),
           ('Accessories',            'electronics-accessories',  10)
       ) AS sub(name, slug, sort_order)
WHERE c.slug = 'electronics'
ON CONFLICT (slug) DO NOTHING;

-- Fashion sub-categories (depth = 1)
INSERT INTO categories (parent_id, name, slug, sort_order, depth, status)
SELECT c.id, sub.name, sub.slug, sub.sort_order, 1, 'active'
FROM   categories c,
       (VALUES
           ('Men''s Clothing',   'mens-clothing',   1),
           ('Women''s Clothing', 'womens-clothing', 2),
           ('Kids'' Clothing',   'kids-clothing',   3),
           ('Shoes',             'shoes',           4),
           ('Bags',              'bags',            5),
           ('Watches',           'watches',         6),
           ('Jewelry',           'jewelry',         7),
           ('Sunglasses',        'sunglasses',      8)
       ) AS sub(name, slug, sort_order)
WHERE c.slug = 'fashion'
ON CONFLICT (slug) DO NOTHING;

-- Home & Living sub-categories (depth = 1)
INSERT INTO categories (parent_id, name, slug, sort_order, depth, status)
SELECT c.id, sub.name, sub.slug, sub.sort_order, 1, 'active'
FROM   categories c,
       (VALUES
           ('Furniture',  'furniture',  1),
           ('Kitchen',    'kitchen',    2),
           ('Bedding',    'bedding',    3),
           ('Lighting',   'lighting',   4),
           ('Decor',      'decor',      5),
           ('Cleaning',   'cleaning',   6),
           ('Garden',     'garden',     7)
       ) AS sub(name, slug, sort_order)
WHERE c.slug = 'home-living'
ON CONFLICT (slug) DO NOTHING;

-- Sports & Outdoors sub-categories (depth = 1)
INSERT INTO categories (parent_id, name, slug, sort_order, depth, status)
SELECT c.id, sub.name, sub.slug, sub.sort_order, 1, 'active'
FROM   categories c,
       (VALUES
           ('Fitness Equipment', 'fitness-equipment', 1),
           ('Outdoor Gear',      'outdoor-gear',      2),
           ('Team Sports',       'team-sports',       3),
           ('Cycling',           'cycling',           4),
           ('Swimming',          'swimming',          5)
       ) AS sub(name, slug, sort_order)
WHERE c.slug = 'sports-outdoors'
ON CONFLICT (slug) DO NOTHING;

-- Beauty & Health sub-categories (depth = 1)
INSERT INTO categories (parent_id, name, slug, sort_order, depth, status)
SELECT c.id, sub.name, sub.slug, sub.sort_order, 1, 'active'
FROM   categories c,
       (VALUES
           ('Skincare',      'skincare',      1),
           ('Haircare',      'haircare',      2),
           ('Makeup',        'makeup',        3),
           ('Fragrances',    'fragrances',    4),
           ('Vitamins',      'vitamins',      5),
           ('Medical Aids',  'medical-aids',  6)
       ) AS sub(name, slug, sort_order)
WHERE c.slug = 'beauty-health'
ON CONFLICT (slug) DO NOTHING;

-- ── Report categories ─────────────────────────────────────────────────────────
INSERT INTO report_categories (name, description, applies_to, sort_order) VALUES
    ('Spam',          'Spam or unsolicited content',               ARRAY['product','store','review','user'], 1),
    ('Fake Product',  'Counterfeit or misleading product listing', ARRAY['product'],                        2),
    ('Inappropriate', 'Offensive or inappropriate content',        ARRAY['product','review','user'],         3),
    ('Fraud',         'Scam or fraudulent activity',               ARRAY['store','user'],                   4),
    ('IP Violation',  'Copyright or trademark infringement',       ARRAY['product','store'],                 5),
    ('Harassment',    'Harassment or abusive behaviour',           ARRAY['user','review'],                  6),
    ('Other',         'Other reason not listed above',             ARRAY['product','store','review','user'], 99)
ON CONFLICT DO NOTHING;

-- ── Verified brands (seed) ────────────────────────────────────────────────────
INSERT INTO brands (name, slug, is_verified, is_active) VALUES
    ('Samsung',   'samsung',   TRUE,  TRUE),
    ('Apple',     'apple',     TRUE,  TRUE),
    ('Nike',      'nike',      TRUE,  TRUE),
    ('Adidas',    'adidas',    TRUE,  TRUE),
    ('Sony',      'sony',      TRUE,  TRUE),
    ('LG',        'lg',        TRUE,  TRUE),
    ('Xiaomi',    'xiaomi',    TRUE,  TRUE),
    ('ASUS',      'asus',      TRUE,  TRUE),
    ('Lenovo',    'lenovo',    TRUE,  TRUE),
    ('Unbranded', 'unbranded', FALSE, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ── Platform voucher example (inactive — activate when ready) ─────────────────
INSERT INTO vouchers (
    code, scope, type, value, minimum_purchase,
    max_discount, quota, start_date, end_date,
    status, description
) VALUES (
    'WELCOME10', 'platform', 'percentage', 10, 50000,
    25000, 1000,
    NOW(), NOW() + INTERVAL '30 days',
    'inactive',
    'Welcome voucher: 10% off (max Rp 25.000) for orders above Rp 50.000'
)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Generate a unique order number: MX-YYYYMMDD-XXXXXXXX (e.g. MX-20250101-A3F9B2C1)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_generate_order_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_number TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        v_number := 'MX-' ||
                    TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                    UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        SELECT EXISTS (SELECT 1 FROM orders WHERE order_number = v_number) INTO v_exists;
        EXIT WHEN NOT v_exists;
    END LOOP;
    RETURN v_number;
END;
$$;

-- -----------------------------------------------------------------------------
-- Materialise monthly activity_log partitions (call from a scheduler or migration)
-- Creates partitions for the next N months if they do not already exist.
-- Usage: SELECT fn_create_activity_log_partitions(3);
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_create_activity_log_partitions(p_months INTEGER DEFAULT 3)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_start DATE;
    v_end   DATE;
    v_name  TEXT;
    i       INTEGER;
BEGIN
    FOR i IN 0 .. p_months - 1 LOOP
        v_start := DATE_TRUNC('month', NOW()) + (i || ' months')::INTERVAL;
        v_end   := v_start + INTERVAL '1 month';
        v_name  := 'activity_logs_' || TO_CHAR(v_start, 'YYYY_MM');

        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = v_name AND n.nspname = 'public'
        ) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF activity_logs FOR VALUES FROM (%L) TO (%L)',
                v_name, v_start, v_end
            );
            RAISE NOTICE 'Created partition: %', v_name;
        END IF;
    END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- Materialise monthly stock_movement partitions
-- Usage: SELECT fn_create_stock_movement_partitions(3);
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_create_stock_movement_partitions(p_months INTEGER DEFAULT 3)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_start DATE;
    v_end   DATE;
    v_name  TEXT;
    i       INTEGER;
BEGIN
    FOR i IN 0 .. p_months - 1 LOOP
        v_start := DATE_TRUNC('month', NOW()) + (i || ' months')::INTERVAL;
        v_end   := v_start + INTERVAL '1 month';
        v_name  := 'stock_movements_' || TO_CHAR(v_start, 'YYYY_MM');

        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = v_name AND n.nspname = 'public'
        ) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF stock_movements FOR VALUES FROM (%L) TO (%L)',
                v_name, v_start, v_end
            );
            RAISE NOTICE 'Created partition: %', v_name;
        END IF;
    END LOOP;
END;
$$;

-- Initialise first 3 months of partitions immediately
SELECT fn_create_activity_log_partitions(3);
SELECT fn_create_stock_movement_partitions(3);

-- -----------------------------------------------------------------------------
-- Recalculate a store's rating and review_count on demand (admin utility)
-- Usage: SELECT fn_recalculate_store_rating('store-uuid-here');
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_recalculate_store_rating(p_store_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    UPDATE stores
    SET rating = COALESCE((
            SELECT ROUND(AVG(p.rating)::NUMERIC, 2)
            FROM products p
            WHERE p.store_id = p_store_id AND p.status = 'active' AND p.rating > 0
        ), 0.00),
        review_count = COALESCE((
            SELECT SUM(p.review_count) FROM products p WHERE p.store_id = p_store_id
        ), 0)
    WHERE id = p_store_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Expire overdue vouchers (run via pg_cron: '0 * * * *')
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_expire_vouchers()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
    UPDATE vouchers
    SET status = 'expired'
    WHERE status = 'active' AND end_date < NOW();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- Expire flash sales whose end time has passed (run via pg_cron: '* * * * *')
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_expire_flash_sales()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
    UPDATE flash_sales
    SET status = 'ended'
    WHERE status = 'active' AND ends_at < NOW();
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Deactivate their items too
    UPDATE flash_sale_items fsi
    SET is_active = FALSE
    FROM flash_sales fs
    WHERE fsi.flash_sale_id = fs.id AND fs.status = 'ended' AND fsi.is_active = TRUE;

    RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- Activate scheduled flash sales whose start time has arrived
-- (run via pg_cron: '* * * * *')
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_activate_flash_sales()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
    UPDATE flash_sales
    SET status = 'active'
    WHERE status = 'scheduled' AND starts_at <= NOW() AND ends_at > NOW();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- Expire payment records that have passed their due time
-- (run via pg_cron: '*/5 * * * *')
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_expire_payments()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
    UPDATE payments
    SET status = 'expired'
    WHERE status = 'pending'
      AND expired_at IS NOT NULL
      AND expired_at < NOW();
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Cascade to orders that have no successful payment
    UPDATE orders o
    SET status         = 'cancelled',
        cancelled_at   = NOW(),
        cancelled_reason = 'Payment expired'
    WHERE o.status         = 'awaiting_payment'
      AND o.payment_due_at < NOW()
      AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.order_id = o.id AND p.status = 'success'
      );

    RETURN v_count;
END;
$$;

-- =============================================================================
-- COMMENTS (pg_description for schema documentation)
-- =============================================================================

COMMENT ON TABLE roles                        IS 'Dynamic RBAC role registry; is_system roles cannot be deleted';
COMMENT ON TABLE permissions                  IS 'Granular permission tokens in resource:action format';
COMMENT ON TABLE role_permissions             IS 'Junction: roles ↔ permissions';
COMMENT ON TABLE user_roles                   IS 'Authoritative many-to-many user ↔ role assignments';
COMMENT ON TABLE users                        IS 'Core identity linked to Supabase Auth; role column is a denorm cache';
COMMENT ON TABLE user_profiles                IS '1:1 extended profile, auto-created on user insert';
COMMENT ON TABLE addresses                    IS 'User shipping/billing addresses; one default per user enforced by trigger';
COMMENT ON TABLE brands                       IS 'Admin-managed brand master list; products FK here';
COMMENT ON TABLE stores                       IS 'Seller store profiles; rating/follower_count maintained by triggers';
COMMENT ON TABLE store_followers              IS 'Users following a store; follower_count counter-cache on stores';
COMMENT ON TABLE categories                   IS 'Self-referencing product category hierarchy; depth cached';
COMMENT ON TABLE products                     IS 'Core product record; stock aggregated from product_skus when has_variants=true';
COMMENT ON TABLE product_images               IS 'Multiple images per product with sort order; is_primary flags hero image';
COMMENT ON TABLE variant_options              IS '3NF variant dimension per product, e.g. "Color", "Size"';
COMMENT ON TABLE variant_values               IS 'Individual choices per variant_option, e.g. "Red", "XL"';
COMMENT ON TABLE product_skus                 IS 'Each purchasable combination of variant values; composite key via variant_value_ids[]';
COMMENT ON TABLE stock_movements              IS 'Immutable append-only stock audit trail; partitioned by month';
COMMENT ON TABLE carts                        IS 'One cart per user; auto-created on registration';
COMMENT ON TABLE cart_items                   IS 'Cart line items referencing product_skus for variant-aware purchasing';
COMMENT ON TABLE wishlists                    IS 'One wishlist per user; auto-created on registration';
COMMENT ON TABLE wishlist_items               IS 'Products saved to a user wishlist';
COMMENT ON TABLE vouchers                     IS 'Platform-wide or store-scoped discount codes';
COMMENT ON TABLE user_vouchers                IS 'Claimed vouchers per user; quota enforced by trigger';
COMMENT ON TABLE orders                       IS 'Master order record; shipping address snapshot prevents stale data';
COMMENT ON TABLE order_items                  IS 'Order line items with product snapshot for historical accuracy';
COMMENT ON TABLE payments                     IS 'Payment attempts per order; net_amount is generated column';
COMMENT ON TABLE payment_logs                 IS 'Immutable event log per payment; never updated, only inserted';
COMMENT ON TABLE shipments                    IS 'Shipping record per order; status synced from shipment_tracking';
COMMENT ON TABLE shipment_tracking            IS 'Append-only courier event timeline; trigger syncs parent shipment status';
COMMENT ON TABLE seller_balances              IS 'Running balance per seller; maintained by order completion and withdrawal triggers';
COMMENT ON TABLE seller_balance_transactions  IS 'Immutable double-entry ledger for every seller balance change';
COMMENT ON TABLE seller_withdrawals           IS 'Withdrawal requests; approval trigger debits seller_balances';
COMMENT ON TABLE reviews                      IS 'Product reviews; one per order_item; seller_response stored inline';
COMMENT ON TABLE review_images                IS 'Images attached to a review';
COMMENT ON TABLE flash_sales                  IS 'Time-boxed promotional campaigns; status managed by scheduler functions';
COMMENT ON TABLE flash_sale_items             IS 'Products in a flash sale with dedicated quota and sale price';
COMMENT ON TABLE banners                      IS 'Promotional banners across platform pages; schedule via starts_at/ends_at';
COMMENT ON TABLE conversations                IS 'Buyer ↔ seller chat threads; one per (buyer, store) pair';
COMMENT ON TABLE messages                     IS 'Individual chat messages; last_message_at on conversations updated by trigger';
COMMENT ON TABLE notifications                IS 'In-app notifications per user; reference_id/type for polymorphic linking';
COMMENT ON TABLE report_categories            IS 'Structured taxonomy of report reasons; self-referencing for sub-reasons';
COMMENT ON TABLE reports                      IS 'User-submitted content reports with structured categorisation';
COMMENT ON TABLE activity_logs                IS 'Immutable audit trail for all meaningful platform events; partitioned by month';
COMMENT ON TABLE sales_analytics              IS 'Daily aggregated sales data per store; upserted by background job';

-- =============================================================================
-- END OF SCHEMA v2.0
-- =============================================================================
