-- Add fn_current_commission (mirrors fn_current_pricing) for M7 cash-trip
-- completion: "which commission rule applies to this category/city, right
-- now?" — with commission_rules' city_id-NULL-means-countrywide fallback.
BEGIN;

CREATE FUNCTION fn_current_commission(p_category_id SMALLINT, p_city_id SMALLINT, p_at TIMESTAMPTZ DEFAULT now())
RETURNS SETOF commission_rules AS $$
    SELECT *
    FROM commission_rules
    WHERE category_id = p_category_id
      AND (city_id = p_city_id OR city_id IS NULL)
      AND effective_from <= p_at
      AND (effective_to IS NULL OR effective_to > p_at)
    ORDER BY city_id NULLS LAST, effective_from DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE;

COMMIT;
