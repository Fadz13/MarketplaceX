-- =============================================================================
-- Migration: Fix search_products() RPC — ambiguous column reference
--
-- Bug: ORDER BY contains correlated subquery with unqualified `id`:
--   SELECT created_at FROM products WHERE id = base.id
-- PostgreSQL resolves `id` ambiguously between the subquery's `products`
-- and the outer `base` CTE, causing:
--   "column reference 'id' is ambiguous"
--
-- Fix: Alias subquery table as `p2` and qualify all references:
--   SELECT p2.created_at FROM products p2 WHERE p2.id = base.id
--
-- Signature preserved exactly: same arg types, defaults, return types.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_products(
    p_query       TEXT    DEFAULT NULL,
    p_category_id UUID    DEFAULT NULL,
    p_brand_id    UUID    DEFAULT NULL,
    p_min_price   NUMERIC DEFAULT NULL,
    p_max_price   NUMERIC DEFAULT NULL,
    p_min_rating  NUMERIC DEFAULT NULL,
    p_condition   TEXT    DEFAULT NULL,
    p_sort        TEXT    DEFAULT 'relevance',
    p_limit       INT     DEFAULT 20,
    p_offset      INT     DEFAULT 0
)
RETURNS TABLE (
    id                UUID,
    name              VARCHAR,
    slug              VARCHAR,
    price             NUMERIC,
    discount_price    NUMERIC,
    stock             INT,
    rating            NUMERIC,
    review_count      INT,
    sold_count        INT,
    condition         product_condition,
    store_id          UUID,
    store_name        VARCHAR,
    store_slug        VARCHAR,
    category_id       UUID,
    category_name     VARCHAR,
    brand_id          UUID,
    brand_name        VARCHAR,
    primary_image_url TEXT,
    relevance_score   REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_ts_query TSQUERY;
BEGIN
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
        RAISE EXCEPTION 'search_products: p_limit must be between 1 and 100, got %', p_limit
            USING ERRCODE = 'P0090';
    END IF;
    IF p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION 'search_products: p_offset must be >= 0, got %', p_offset
            USING ERRCODE = 'P0090';
    END IF;
    IF p_min_price IS NOT NULL AND p_min_price < 0 THEN
        RAISE EXCEPTION 'search_products: p_min_price must be >= 0'
            USING ERRCODE = 'P0090';
    END IF;
    IF p_max_price IS NOT NULL AND p_min_price IS NOT NULL AND p_max_price < p_min_price THEN
        RAISE EXCEPTION 'search_products: p_max_price (%) must be >= p_min_price (%)', p_max_price, p_min_price
            USING ERRCODE = 'P0090';
    END IF;
    IF p_min_rating IS NOT NULL AND (p_min_rating < 0 OR p_min_rating > 5) THEN
        RAISE EXCEPTION 'search_products: p_min_rating must be 0–5, got %', p_min_rating
            USING ERRCODE = 'P0090';
    END IF;
    IF p_sort NOT IN ('relevance','price_asc','price_desc','rating','newest','sold') THEN
        RAISE EXCEPTION 'search_products: invalid sort "%" – valid: relevance|price_asc|price_desc|rating|newest|sold', p_sort
            USING ERRCODE = 'P0090';
    END IF;

    IF p_query IS NOT NULL AND trim(p_query) != '' THEN
        BEGIN
            v_ts_query := plainto_tsquery('english', p_query);
        EXCEPTION WHEN OTHERS THEN
            v_ts_query := NULL;
        END;
    END IF;

    RETURN QUERY
    WITH base AS (
        SELECT
            p.id,
            p.name,
            p.slug,
            COALESCE(p.discount_price, p.price)          AS effective_price,
            p.price,
            p.discount_price,
            p.stock,
            p.rating,
            p.review_count,
            p.sold_count,
            p.condition,
            p.store_id,
            p.category_id,
            p.brand_id,
            s.store_name,
            s.slug                                        AS store_slug,
            c.name                                        AS category_name,
            b.name                                        AS brand_name,
            (
                SELECT pi.image_url FROM product_images pi
                WHERE  pi.product_id = p.id AND pi.is_primary = TRUE
                ORDER  BY pi.sort_order LIMIT 1
            )                                             AS primary_image_url,
            CASE
                WHEN v_ts_query IS NOT NULL THEN
                    ts_rank_cd(
                        to_tsvector('english',
                            coalesce(p.name, '') || ' ' || coalesce(p.description, '')),
                        v_ts_query
                    )
                ELSE 0.0
            END                                           AS relevance_score
        FROM  products    p
        JOIN  stores      s ON s.id = p.store_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN brands     b ON b.id = p.brand_id
        WHERE p.status   = 'active'
          AND s.status   = 'active'
          AND (
              v_ts_query IS NULL
              OR to_tsvector('english',
                     coalesce(p.name, '') || ' ' || coalesce(p.description, ''))
                 @@ v_ts_query
              OR p.name ILIKE '%' || p_query || '%'
          )
          AND (p_category_id IS NULL OR p.category_id = p_category_id
               OR p.category_id IN (
                   SELECT c2.id FROM categories c2
                   WHERE c2.parent_id = p_category_id
               ))
          AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
          AND (p_min_price IS NULL OR COALESCE(p.discount_price, p.price) >= p_min_price)
          AND (p_max_price IS NULL OR COALESCE(p.discount_price, p.price) <= p_max_price)
          AND (p_min_rating IS NULL OR p.rating >= p_min_rating)
          AND (p_condition IS NULL OR p.condition::TEXT = p_condition)
    )
    SELECT
        base.id,
        base.name,
        base.slug,
        base.price,
        base.discount_price,
        base.stock,
        base.rating,
        base.review_count,
        base.sold_count,
        base.condition,
        base.store_id,
        base.store_name,
        base.store_slug,
        base.category_id,
        base.category_name,
        base.brand_id,
        base.brand_name,
        base.primary_image_url,
        base.relevance_score
    FROM base
    ORDER BY
        CASE p_sort
            WHEN 'price_asc'  THEN base.effective_price END ASC,
        CASE p_sort
            WHEN 'price_desc' THEN base.effective_price END DESC,
        CASE p_sort
            WHEN 'rating'     THEN base.rating END DESC,
        CASE p_sort
            WHEN 'newest'     THEN EXTRACT(EPOCH FROM (SELECT p2.created_at FROM products p2 WHERE p2.id = base.id)) END DESC,
        CASE p_sort
            WHEN 'sold'       THEN base.sold_count END DESC,
        CASE WHEN p_sort = 'relevance' AND v_ts_query IS NOT NULL
             THEN base.relevance_score END DESC,
        CASE WHEN p_sort = 'relevance' AND v_ts_query IS NULL
             THEN base.sold_count END DESC,
        base.id
    LIMIT  p_limit
    OFFSET p_offset;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'search_products failed: %', SQLERRM
            USING ERRCODE = SQLSTATE;
END;
$$;
