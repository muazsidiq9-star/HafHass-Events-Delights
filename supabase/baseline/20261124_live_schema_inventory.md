# HAFHASS live database schema inventory

> Captured from the live Supabase project on 2026-11-24. This is a descriptive inventory and generated client type snapshot, **not a replayable SQL dump** and not a reconstruction of historical migrations.

## Scope

- Project ref: `gbsvwizlplzoantvkese`
- Schemas inspected: `public`, `private`
- Tables inspected: 36
- Applied migrations recorded by Supabase: 21
- Row counts are intentionally omitted; this is schema documentation, not a data backup.
- Auth/Storage internal schemas, secrets, Edge Function deployment configuration, bucket objects, and project-level settings are outside this inventory.

## Tables

### `public.profiles`

- RLS enabled: yes
- Columns:
  - `id` — uuid
  - `full_name` — text; nullable
  - `email` — text; nullable
  - `phone` — text; nullable
  - `role` — USER-DEFINED; default `'customer'::user_role`; enum: customer, admin, staff
  - `avatar_url` — text; nullable
  - `is_active` — boolean; default `true`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `profiles_id_fkey`: `id` → `auth.users` (`id`)

### `public.addresses`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `user_id` — uuid
  - `label` — text; nullable
  - `recipient_name` — text; check `length(TRIM(BOTH FROM recipient_name)) > 0`
  - `phone` — text; check `length(TRIM(BOTH FROM phone)) > 0`
  - `address_line_1` — text; nullable; check `length(TRIM(BOTH FROM address_line_1)) > 0`
  - `address_line_2` — text; nullable
  - `city` — text; check `length(TRIM(BOTH FROM city)) > 0`
  - `state` — text; check `length(TRIM(BOTH FROM state)) > 0`
  - `postal_code` — text; nullable
  - `country` — text; default `'Nigeria'::text`
  - `delivery_instructions` — text; nullable
  - `is_default` — boolean; default `false`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
  - `lga_id` — uuid; nullable
  - `city_id` — uuid; nullable
  - `area_id` — uuid; nullable
  - `custom_lga` — text; nullable
  - `custom_city` — text; nullable
  - `custom_area` — text; nullable
  - `location_node_id` — uuid; nullable
  - `is_custom_location` — boolean; default `false`
  - `custom_location_text` — text; nullable
- Primary key: `id`
- Foreign keys:
  - `addresses_location_node_id_fkey`: `location_node_id` → `public.delivery_location_nodes` (`id`)
  - `addresses_area_id_fkey`: `area_id` → `public.delivery_areas` (`id`)
  - `addresses_city_id_fkey`: `city_id` → `public.delivery_cities` (`id`)
  - `addresses_lga_id_fkey`: `lga_id` → `public.delivery_lgas` (`id`)
  - `addresses_user_id_fkey`: `user_id` → `public.profiles` (`id`)

### `public.categories`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `parent_id` — uuid; nullable
  - `name` — text; check `length(TRIM(BOTH FROM name)) > 0`
  - `slug` — text; unique; check `length(TRIM(BOTH FROM slug)) > 0`
  - `description` — text; nullable
  - `image_url` — text; nullable
  - `display_order` — integer; default `0`
  - `is_active` — boolean; default `true`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `categories_parent_id_fkey`: `parent_id` → `public.categories` (`id`)

### `public.products`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `category_id` — uuid; nullable
  - `sku` — text; nullable; unique
  - `name` — text; check `length(TRIM(BOTH FROM name)) > 0`
  - `slug` — text; unique; check `length(TRIM(BOTH FROM slug)) > 0`
  - `short_description` — text; nullable
  - `description` — text; nullable
  - `pricing_type` — USER-DEFINED; default `'fixed'::product_pricing_type`; enum: fixed, starting_from, quote
  - `price` — numeric; default `0`; check `price >= 0::numeric`
  - `compare_at_price` — numeric; nullable; check `compare_at_price IS NULL OR compare_at_price >= 0::numeric`
  - `currency` — character; default `'NGN'::bpchar`
  - `availability` — USER-DEFINED; default `'made_to_order'::product_availability`; enum: in_stock, out_of_stock, pre_order, made_to_order
  - `status` — USER-DEFINED; default `'draft'::product_status`; enum: draft, active, archived
  - `is_featured` — boolean; default `false`
  - `is_customizable` — boolean; default `false`
  - `stock_quantity` — integer; nullable; check `stock_quantity IS NULL OR stock_quantity >= 0`
  - `minimum_order_quantity` — integer; default `1`; check `minimum_order_quantity >= 1`
  - `maximum_order_quantity` — integer; nullable
  - `preparation_time_days` — integer; nullable; check `preparation_time_days IS NULL OR preparation_time_days >= 0`
  - `display_order` — integer; default `0`
  - `meta_title` — text; nullable
  - `meta_description` — text; nullable
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `products_category_id_fkey`: `category_id` → `public.categories` (`id`)

### `public.product_images`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `product_id` — uuid
  - `image_url` — text; check `length(TRIM(BOTH FROM image_url)) > 0`
  - `alt_text` — text; nullable
  - `display_order` — integer; default `0`
  - `is_primary` — boolean; default `false`
  - `created_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `product_images_product_id_fkey`: `product_id` → `public.products` (`id`)

### `public.product_options`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `product_id` — uuid
  - `name` — text; check `length(TRIM(BOTH FROM name)) > 0`
  - `display_name` — text; check `length(TRIM(BOTH FROM display_name)) > 0`
  - `description` — text; nullable
  - `input_type` — text; default `'single_select'::text`; check `input_type = ANY (ARRAY['single_select'::text, 'multi_select'::text, 'text'::text, 'number'::text, 'color'::text, 'date'::text, 'file'::text, 'checkbox'::text])`
  - `is_required` — boolean; default `false`
  - `display_style` — text; default `'select'::text`; check `display_style = ANY (ARRAY['select'::text, 'radio'::text, 'checkbox'::text, 'swatches'::text, 'buttons'::text])`
  - `minimum_selections` — integer; default `0`; check `minimum_selections >= 0`
  - `maximum_selections` — integer; nullable
  - `placeholder` — text; nullable
  - `help_text` — text; nullable
  - `display_order` — integer; default `0`
  - `is_active` — boolean; default `true`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `product_options_product_id_fkey`: `product_id` → `public.products` (`id`)

### `public.product_option_values`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `option_id` — uuid
  - `value` — text; check `length(TRIM(BOTH FROM value)) > 0`
  - `label` — text; check `length(TRIM(BOTH FROM label)) > 0`
  - `price_adjustment_type` — text; default `'none'::text`; check `price_adjustment_type = ANY (ARRAY['none'::text, 'fixed'::text, 'percentage'::text])`
  - `price_adjustment` — numeric; default `0`; check `price_adjustment >= 0::numeric`
  - `display_order` — integer; default `0`
  - `is_available` — boolean; default `true`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `product_option_values_option_id_fkey`: `option_id` → `public.product_options` (`id`)

### `public.carts`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `user_id` — uuid
  - `status` — text; default `'active'::text`; check `status = ANY (ARRAY['active'::text, 'converted'::text, 'abandoned'::text])`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `carts_user_id_fkey`: `user_id` → `public.profiles` (`id`)

### `public.cart_items`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `cart_id` — uuid
  - `product_id` — uuid
  - `quantity` — integer; default `1`; check `quantity >= 1`
  - `selected_options` — jsonb; default `'[]'::jsonb`; check `jsonb_typeof(selected_options) = 'array'::text`
  - `custom_text` — text; nullable
  - `customer_notes` — text; nullable
  - `reference_image_url` — text; nullable
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `cart_items_cart_id_fkey`: `cart_id` → `public.carts` (`id`)
  - `cart_items_product_id_fkey`: `product_id` → `public.products` (`id`)

### `public.favourites`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `user_id` — uuid
  - `product_id` — uuid
  - `created_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `favourites_user_id_fkey`: `user_id` → `public.profiles` (`id`)
  - `favourites_product_id_fkey`: `product_id` → `public.products` (`id`)

### `public.orders`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `order_number` — text; default `('HF-'::text || upper("substring"(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 12)))`; unique
  - `user_id` — uuid
  - `status` — USER-DEFINED; default `'pending'::order_status`; enum: pending, awaiting_payment, payment_confirmed, processing, ready_for_pickup, out_for_delivery, completed, cancelled
  - `fulfillment_method` — USER-DEFINED; enum: pickup, delivery
  - `customer_name` — text; check `length(TRIM(BOTH FROM customer_name)) > 0`
  - `customer_email` — text; check `length(TRIM(BOTH FROM customer_email)) > 0`
  - `customer_phone` — text; check `length(TRIM(BOTH FROM customer_phone)) > 0`
  - `delivery_address` — jsonb; nullable; check `delivery_address IS NULL OR jsonb_typeof(delivery_address) = 'object'::text`
  - `requested_date` — date; nullable
  - `requested_time` — text; nullable
  - `subtotal` — numeric; default `0`; check `subtotal >= 0::numeric`
  - `delivery_fee` — numeric; default `0`; check `delivery_fee >= 0::numeric`
  - `discount_amount` — numeric; default `0`; check `discount_amount >= 0::numeric`
  - `tax_amount` — numeric; default `0`; check `tax_amount >= 0::numeric`
  - `total_amount` — numeric; default `0`; check `total_amount >= 0::numeric`
  - `currency` — character; default `'NGN'::bpchar`
  - `customer_notes` — text; nullable
  - `cancellation_reason` — text; nullable
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
  - `initial_online_amount` — numeric; nullable; check `initial_online_amount IS NULL OR initial_online_amount >= 0::numeric`
  - `delivery_fee_status` — text; default `'not_required'::text`; check `delivery_fee_status = ANY (ARRAY['not_required'::text, 'included_online'::text, 'pending_review'::text, 'awaiting_manual_payment'::text, 'settled'::text])`
  - `delivery_fee_collection_method` — text; default `'none'::text`; check `delivery_fee_collection_method = ANY (ARRAY['none'::text, 'online'::text, 'manual'::text])`
  - `delivery_location_review_required` — boolean; default `false`
  - `delivery_location_review_note` — text; nullable
  - `delivery_zone_id` — uuid; nullable
  - `delivery_zone_matched_by` — text; nullable
  - `delivery_fee_confirmed_at` — timestamp with time zone; nullable
  - `delivery_fee_confirmed_by` — uuid; nullable
  - `delivery_fee_settled_at` — timestamp with time zone; nullable
  - `delivery_fee_settled_by` — uuid; nullable
  - `delivery_completed_at` — timestamp with time zone; nullable
  - `delivery_completed_by` — uuid; nullable
- Primary key: `id`
- Foreign keys:
  - `orders_delivery_completed_by_fkey`: `delivery_completed_by` → `public.profiles` (`id`)
  - `orders_delivery_fee_settled_by_fkey`: `delivery_fee_settled_by` → `public.profiles` (`id`)
  - `orders_delivery_fee_confirmed_by_fkey`: `delivery_fee_confirmed_by` → `public.profiles` (`id`)
  - `orders_delivery_zone_id_fkey`: `delivery_zone_id` → `public.delivery_zones` (`id`)
  - `orders_user_id_fkey`: `user_id` → `public.profiles` (`id`)

### `public.order_items`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `order_id` — uuid
  - `product_id` — uuid; nullable
  - `product_name` — text; check `length(TRIM(BOTH FROM product_name)) > 0`
  - `product_sku` — text; nullable
  - `product_image_url` — text; nullable
  - `product_description` — text; nullable
  - `quantity` — integer; check `quantity >= 1`
  - `unit_price` — numeric; check `unit_price >= 0::numeric`
  - `line_total` — numeric; check `line_total >= 0::numeric`
  - `currency` — character; default `'NGN'::bpchar`
  - `selected_options` — jsonb; default `'[]'::jsonb`; check `jsonb_typeof(selected_options) = 'array'::text`
  - `custom_text` — text; nullable
  - `customer_notes` — text; nullable
  - `reference_image_url` — text; nullable
  - `created_at` — timestamp with time zone; default `now()`
  - `item_type` — text; default `'product'::text`
  - `service_id` — uuid; nullable
  - `service_quote_id` — uuid; nullable
- Primary key: `id`
- Foreign keys:
  - `order_items_service_quote_id_fkey`: `service_quote_id` → `public.service_quotes` (`id`)
  - `order_items_order_id_fkey`: `order_id` → `public.orders` (`id`)
  - `order_items_product_id_fkey`: `product_id` → `public.products` (`id`)
  - `order_items_service_id_fkey`: `service_id` → `public.services` (`id`)

### `public.order_item_customizations`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `order_item_id` — uuid
  - `option_name` — text; check `length(TRIM(BOTH FROM option_name)) > 0`
  - `option_value` — text; check `length(TRIM(BOTH FROM option_value)) > 0`
  - `price_adjustment_type` — text; default `'none'::text`; check `price_adjustment_type = ANY (ARRAY['none'::text, 'fixed'::text, 'percentage'::text])`
  - `price_adjustment` — numeric; default `0`; check `price_adjustment >= 0::numeric`
  - `created_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `order_item_customizations_order_item_id_fkey`: `order_item_id` → `public.order_items` (`id`)

### `public.payments`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `order_id` — uuid
  - `user_id` — uuid
  - `payment_method` — USER-DEFINED; enum: paystack, bank_transfer
  - `status` — USER-DEFINED; default `'pending'::payment_status`; enum: pending, processing, successful, failed, refunded, partially_refunded
  - `amount` — numeric; check `amount > 0::numeric`
  - `currency` — character; default `'NGN'::bpchar`
  - `paystack_reference` — text; nullable; unique
  - `paystack_access_code` — text; nullable
  - `transfer_reference` — text; nullable
  - `receipt_url` — text; nullable; check `receipt_url IS NULL OR length(TRIM(BOTH FROM receipt_url)) > 0`
  - `verified_at` — timestamp with time zone; nullable
  - `provider_response` — jsonb; nullable
  - `failure_reason` — text; nullable
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
  - `auto_confirmed_by_order` — boolean; default `false`
  - `reversal_reason` — text; nullable
- Primary key: `id`
- Foreign keys:
  - `payments_order_id_fkey`: `order_id` → `public.orders` (`id`)
  - `payments_user_id_fkey`: `user_id` → `public.profiles` (`id`)

### `public.services`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `name` — text; check `length(TRIM(BOTH FROM name)) > 0`
  - `slug` — text; unique; check `length(TRIM(BOTH FROM slug)) > 0`
  - `short_description` — text; nullable
  - `description` — text; nullable
  - `image_url` — text; nullable
  - `pricing_type` — USER-DEFINED; default `'quote'::product_pricing_type`; enum: fixed, starting_from, quote
  - `price` — numeric; default `0`; check `price >= 0::numeric`
  - `currency` — character; default `'NGN'::bpchar`
  - `is_active` — boolean; default `true`
  - `is_featured` — boolean; default `false`
  - `display_order` — integer; default `0`
  - `preparation_time_days` — integer; nullable; check `preparation_time_days IS NULL OR preparation_time_days >= 0`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`

### `public.service_requests`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `request_number` — text; default `('SR-'::text || upper("substring"(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 12)))`; unique
  - `user_id` — uuid
  - `service_id` — uuid
  - `status` — USER-DEFINED; default `'pending'::service_request_status`; enum: pending, reviewing, quoted, accepted, declined, in_progress, completed, cancelled
  - `customer_name` — text; check `length(TRIM(BOTH FROM customer_name)) > 0`
  - `customer_email` — text; check `length(TRIM(BOTH FROM customer_email)) > 0`
  - `customer_phone` — text; check `length(TRIM(BOTH FROM customer_phone)) > 0`
  - `event_type` — text; nullable
  - `event_date` — date; nullable
  - `event_time` — text; nullable
  - `event_location` — text; nullable
  - `guest_count` — integer; nullable; check `guest_count IS NULL OR guest_count >= 1`
  - `budget_min` — numeric; nullable; check `budget_min IS NULL OR budget_min >= 0::numeric`
  - `budget_max` — numeric; nullable; check `budget_max IS NULL OR budget_max >= 0::numeric`
  - `currency` — character; default `'NGN'::bpchar`
  - `requirements` — text; check `length(TRIM(BOTH FROM requirements)) > 0`
  - `reference_images` — jsonb; default `'[]'::jsonb`; check `jsonb_typeof(reference_images) = 'array'::text`
  - `additional_notes` — text; nullable
  - `internal_notes` — text; nullable
  - `reviewed_at` — timestamp with time zone; nullable
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `service_requests_user_id_fkey`: `user_id` → `public.profiles` (`id`)
  - `service_requests_service_id_fkey`: `service_id` → `public.services` (`id`)

### `public.service_quotes`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `quote_number` — text; default `('SQ-'::text || upper("substring"(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 12)))`; unique
  - `request_id` — uuid
  - `amount` — numeric; check `amount >= 0::numeric`
  - `currency` — character; default `'NGN'::bpchar`
  - `status` — USER-DEFINED; default `'draft'::quote_status`; enum: draft, sent, accepted, rejected, expired
  - `description` — text; nullable
  - `terms_and_conditions` — text; nullable
  - `customer_message` — text; nullable
  - `valid_until` — timestamp with time zone; nullable
  - `sent_at` — timestamp with time zone; nullable
  - `accepted_at` — timestamp with time zone; nullable
  - `rejected_at` — timestamp with time zone; nullable
  - `created_by` — uuid; nullable
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
  - `converted_order_id` — uuid; nullable
  - `converted_at` — timestamp with time zone; nullable
- Primary key: `id`
- Foreign keys:
  - `service_quotes_created_by_fkey`: `created_by` → `public.profiles` (`id`)
  - `service_quotes_converted_order_fkey`: `converted_order_id` → `public.orders` (`id`)
  - `service_quotes_request_id_fkey`: `request_id` → `public.service_requests` (`id`)

### `public.gallery_images`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `title` — text; check `length(TRIM(BOTH FROM title)) > 0`
  - `description` — text; nullable
  - `image_url` — text; check `length(TRIM(BOTH FROM image_url)) > 0`
  - `alt_text` — text; nullable
  - `category` — text; nullable
  - `is_featured` — boolean; default `false`
  - `is_published` — boolean; default `false`
  - `display_order` — integer; default `0`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`

### `public.reviews`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `user_id` — uuid
  - `order_id` — uuid
  - `product_id` — uuid; nullable
  - `rating` — integer; check `rating >= 1 AND rating <= 5`
  - `title` — text; nullable
  - `comment` — text; nullable
  - `status` — USER-DEFINED; default `'pending'::review_status`; enum: pending, approved, rejected
  - `admin_response` — text; nullable
  - `responded_at` — timestamp with time zone; nullable
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `reviews_user_id_fkey`: `user_id` → `public.profiles` (`id`)
  - `reviews_order_id_fkey`: `order_id` → `public.orders` (`id`)
  - `reviews_product_id_fkey`: `product_id` → `public.products` (`id`)

### `public.notifications`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `user_id` — uuid
  - `type` — USER-DEFINED; default `'general'::notification_type`; enum: welcome, order_confirmation, payment_confirmation, order_update, delivery_update, service_update, promotion, general
  - `title` — text; check `length(TRIM(BOTH FROM title)) > 0`
  - `message` — text; check `length(TRIM(BOTH FROM message)) > 0`
  - `related_order_id` — uuid; nullable
  - `related_service_request_id` — uuid; nullable
  - `action_url` — text; nullable
  - `is_read` — boolean; default `false`
  - `read_at` — timestamp with time zone; nullable
  - `created_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `notifications_related_order_id_fkey`: `related_order_id` → `public.orders` (`id`)
  - `notifications_user_id_fkey`: `user_id` → `public.profiles` (`id`)
  - `notifications_related_service_request_id_fkey`: `related_service_request_id` → `public.service_requests` (`id`)

### `public.business_settings`

- RLS enabled: yes
- Columns:
  - `id` — smallint; default `1`; check `id = 1`
  - `business_name` — text; default `'HAFHASS EVENTS & DELIGHTS'::text`; check `length(TRIM(BOTH FROM business_name)) > 0`
  - `tagline` — text; default `'Where Taste Meets Creativity.'::text`; nullable
  - `owner_name` — text; nullable
  - `business_description` — text; nullable
  - `phone` — text; nullable
  - `whatsapp_number` — text; nullable
  - `email` — text; nullable
  - `address` — text; nullable
  - `city` — text; nullable
  - `state` — text; nullable
  - `country` — text; default `'Nigeria'::text`; nullable
  - `logo_url` — text; nullable
  - `favicon_url` — text; nullable
  - `brand_primary_color` — text; default `'#702D43'::text`; nullable
  - `brand_secondary_color` — text; default `'#E8B8C3'::text`; nullable
  - `brand_accent_color` — text; default `'#C6A46A'::text`; nullable
  - `currency` — text; default `'NGN'::text`; check `length(currency) = 3`
  - `timezone` — text; default `'Africa/Lagos'::text`
  - `minimum_order_amount` — numeric; default `0`; check `minimum_order_amount >= 0::numeric`
  - `pickup_enabled` — boolean; default `true`
  - `delivery_enabled` — boolean; default `true`
  - `delivery_fee` — numeric; default `0`; check `delivery_fee >= 0::numeric`
  - `free_delivery_enabled` — boolean; default `false`
  - `free_delivery_threshold` — numeric; nullable; check `free_delivery_threshold IS NULL OR free_delivery_threshold >= 0::numeric`
  - `delivery_information` — text; nullable
  - `pickup_information` — text; nullable
  - `estimated_delivery_days` — integer; nullable; check `estimated_delivery_days IS NULL OR estimated_delivery_days >= 0`
  - `estimated_preparation_days` — integer; nullable; check `estimated_preparation_days IS NULL OR estimated_preparation_days >= 0`
  - `opening_hours` — jsonb; default `'{}'::jsonb`
  - `bank_transfer_details` — jsonb; default `'{}'::jsonb`
  - `social_links` — jsonb; default `'{}'::jsonb`
  - `announcement_enabled` — boolean; default `false`
  - `announcement_text` — text; nullable
  - `announcement_link` — text; nullable
  - `terms_url` — text; nullable
  - `privacy_url` — text; nullable
  - `updated_by` — uuid; nullable
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
  - `business_subtitle` — text; nullable
  - `home_hero_image_url` — text; nullable
  - `shop_hero_image_url` — text; nullable
  - `services_hero_image_url` — text; nullable
  - `gallery_hero_image_url` — text; nullable
  - `founder_hero_image_url` — text; nullable
  - `custom_orders_hero_image_url` — text; nullable
  - `about_section_image_url` — text; nullable
  - `home_founder_image_url` — text; nullable
  - `founder_portrait_image_url` — text; nullable
  - `founder_story_image_url` — text; nullable
- Primary key: `id`
- Foreign keys:
  - `business_settings_updated_by_fkey`: `updated_by` → `public.profiles` (`id`)

### `public.order_status_history`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `order_id` — uuid
  - `old_status` — USER-DEFINED; nullable; enum: pending, awaiting_payment, payment_confirmed, processing, ready_for_pickup, out_for_delivery, completed, cancelled
  - `new_status` — USER-DEFINED; enum: pending, awaiting_payment, payment_confirmed, processing, ready_for_pickup, out_for_delivery, completed, cancelled
  - `changed_by` — uuid; nullable
  - `change_note` — text; nullable
  - `change_source` — text; default `'system'::text`; check `change_source = ANY (ARRAY['admin'::text, 'staff'::text, 'customer'::text, 'system'::text])`
  - `created_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `order_status_history_order_id_fkey`: `order_id` → `public.orders` (`id`)
  - `order_status_history_changed_by_fkey`: `changed_by` → `public.profiles` (`id`)

### `public.financial_audit_logs`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `record_type` — text; check `record_type = ANY (ARRAY['payment'::text, 'service_quote'::text])`
  - `record_id` — uuid
  - `operation` — text; check `operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])`
  - `old_values` — jsonb; nullable
  - `new_values` — jsonb; nullable
  - `changed_by` — uuid; nullable
  - `actor_role` — text; nullable
  - `created_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `financial_audit_logs_changed_by_fkey`: `changed_by` → `public.profiles` (`id`)

### `public.checkout_idempotency`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `user_id` — uuid
  - `idempotency_key` — uuid
  - `request_hash` — text; check `request_hash ~ '^[a-f0-9]{64}$'::text`
  - `status` — text; default `'processing'::text`; check `status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])`
  - `order_id` — uuid; nullable
  - `failure_message` — text; nullable
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `checkout_idempotency_order_id_fkey`: `order_id` → `public.orders` (`id`)
  - `checkout_idempotency_user_id_fkey`: `user_id` → `public.profiles` (`id`)

### `public.payment_webhook_events`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `provider` — text; default `'paystack'::text`; check `provider = 'paystack'::text`
  - `event_key` — text; unique
  - `event_type` — text
  - `payment_reference` — text; nullable
  - `transaction_id` — text; nullable
  - `processing_status` — text; default `'received'::text`; check `processing_status = ANY (ARRAY['received'::text, 'processing'::text, 'processed'::text, 'failed'::text, 'ignored'::text])`
  - `payload_summary` — jsonb; default `'{}'::jsonb`
  - `received_at` — timestamp with time zone; default `now()`
  - `processed_at` — timestamp with time zone; nullable
  - `last_error` — text; nullable
  - `created_at` — timestamp with time zone; default `now()`
- Primary key: `id`

### `public.delivery_zones`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `state` — text; check `length(TRIM(BOTH FROM state)) > 0`
  - `city` — text; check `length(TRIM(BOTH FROM city)) > 0`
  - `area` — text; nullable; check `area IS NULL OR length(TRIM(BOTH FROM area)) > 0`
  - `delivery_fee` — numeric; default `0`; check `delivery_fee >= 0::numeric`
  - `is_active` — boolean; default `true`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
  - `state_id` — uuid; nullable
  - `lga_id` — uuid; nullable
  - `city_id` — uuid; nullable
  - `area_id` — uuid; nullable
  - `location_node_id` — uuid; nullable
- Primary key: `id`
- Foreign keys:
  - `delivery_zones_state_id_fkey`: `state_id` → `public.delivery_states` (`id`)
  - `delivery_zones_lga_id_fkey`: `lga_id` → `public.delivery_lgas` (`id`)
  - `delivery_zones_location_node_id_fkey`: `location_node_id` → `public.delivery_location_nodes` (`id`)
  - `delivery_zones_city_id_fkey`: `city_id` → `public.delivery_cities` (`id`)
  - `delivery_zones_area_id_fkey`: `area_id` → `public.delivery_areas` (`id`)

### `public.delivery_states`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `country_code` — text; default `'NG'::text`; check `country_code = upper(country_code)`
  - `name` — text; check `length(btrim(name)) > 0`
  - `code` — text; nullable
  - `is_active` — boolean; default `true`
  - `sort_order` — integer; default `0`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`

### `public.delivery_lgas`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `state_id` — uuid
  - `name` — text; check `length(btrim(name)) > 0`
  - `slug` — text
  - `is_active` — boolean; default `true`
  - `sort_order` — integer; default `0`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `delivery_lgas_state_id_fkey`: `state_id` → `public.delivery_states` (`id`)

### `public.delivery_cities`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `lga_id` — uuid
  - `name` — text; check `length(btrim(name)) > 0`
  - `slug` — text
  - `is_active` — boolean; default `true`
  - `sort_order` — integer; default `0`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `delivery_cities_lga_id_fkey`: `lga_id` → `public.delivery_lgas` (`id`)

### `public.delivery_areas`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `city_id` — uuid
  - `name` — text; check `length(btrim(name)) > 0`
  - `slug` — text
  - `is_active` — boolean; default `true`
  - `sort_order` — integer; default `0`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `delivery_areas_city_id_fkey`: `city_id` → `public.delivery_cities` (`id`)

### `public.delivery_zone_aliases`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `delivery_zone_id` — uuid
  - `alias` — text; check `length(btrim(alias)) > 0`
  - `normalized_alias` — text; default `lower(regexp_replace(btrim(alias), '[[:space:][:punct:]]+'::text, ''::text, 'g'::text))`; nullable
  - `is_active` — boolean; default `true`
  - `created_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `delivery_zone_aliases_delivery_zone_id_fkey`: `delivery_zone_id` → `public.delivery_zones` (`id`)

### `public.delivery_location_nodes`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `settlement_id` — uuid
  - `parent_id` — uuid; nullable
  - `name` — text; check `length(btrim(name)) > 0`
  - `slug` — text; check `length(btrim(slug)) > 0`
  - `place_type` — text; default `'community'::text`; check `place_type = ANY (ARRAY['community'::text, 'quarter'::text, 'neighbourhood'::text, 'area'::text, 'street'::text, 'landmark'::text, 'market'::text, 'junction'::text, 'plaza'::text, 'school'::text, 'hospital'::text, 'mosque'::text, 'church'::text, 'palace'::text, 'bus_stop'::text, 'estate'::text, 'other'::text])`
  - `description` — text; nullable
  - `is_active` — boolean; default `true`
  - `sort_order` — integer; default `0`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `delivery_location_nodes_parent_id_fkey`: `parent_id` → `public.delivery_location_nodes` (`id`)
  - `delivery_location_nodes_settlement_id_fkey`: `settlement_id` → `public.delivery_cities` (`id`)

### `public.delivery_location_aliases`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `location_node_id` — uuid
  - `alias` — text; check `length(btrim(alias)) > 0`
  - `normalized_alias` — text; default `lower(regexp_replace(btrim(alias), '[[:space:][:punct:]]+'::text, ''::text, 'g'::text))`; nullable
  - `is_active` — boolean; default `true`
  - `created_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `delivery_location_aliases_location_node_id_fkey`: `location_node_id` → `public.delivery_location_nodes` (`id`)

### `public.push_subscriptions`

- RLS enabled: yes
- Columns:
  - `id` — uuid; default `gen_random_uuid()`
  - `user_id` — uuid
  - `token` — text; unique; check `length(btrim(token)) > 0`
  - `device_label` — text; nullable
  - `user_agent` — text; nullable
  - `is_active` — boolean; default `true`
  - `last_seen_at` — timestamp with time zone; default `now()`
  - `created_at` — timestamp with time zone; default `now()`
  - `updated_at` — timestamp with time zone; default `now()`
- Primary key: `id`
- Foreign keys:
  - `push_subscriptions_user_id_fkey`: `user_id` → `auth.users` (`id`)

### `public.push_notification_dispatches`

- RLS enabled: yes
- Columns:
  - `notification_id` — uuid
  - `status` — text; default `'processing'::text`; check `status = ANY (ARRAY['processing'::text, 'completed'::text, 'partial'::text, 'retrying'::text, 'failed'::text])`
  - `started_at` — timestamp with time zone; default `now()`
  - `completed_at` — timestamp with time zone; nullable
  - `sent_count` — integer; default `0`
  - `failed_count` — integer; default `0`
  - `device_count` — integer; default `0`
  - `attempt_count` — integer; default `0`
  - `next_attempt_at` — timestamp with time zone; nullable
  - `last_attempt_at` — timestamp with time zone; nullable
  - `last_error` — text; nullable
- Primary key: `notification_id`
- Foreign keys:
  - `push_notification_dispatches_notification_id_fkey`: `notification_id` → `public.notifications` (`id`)

### `private.admin_notification_requests`

- RLS enabled: yes
- Columns:
  - `request_id` — uuid
  - `admin_user_id` — uuid
  - `recipient_user_id` — uuid; nullable
  - `title` — text
  - `message` — text
  - `notification_type` — USER-DEFINED; enum: welcome, order_confirmation, payment_confirmation, order_update, delivery_update, service_update, promotion, general
  - `action_url` — text; nullable
  - `created_count` — integer; nullable; check `created_count IS NULL OR created_count >= 0`
  - `notification_id` — uuid; nullable
  - `created_at` — timestamp with time zone; default `now()`
- Primary key: `request_id`
- Foreign keys:
  - `admin_notification_requests_admin_user_id_fkey`: `admin_user_id` → `auth.users` (`id`)

## Applied migration ledger

These versions and names were returned by the live Supabase migration ledger. Only the Phase 3 SQL file is currently archived in `supabase/migrations/`; the other historical SQL bodies were not recovered during the repository/history investigation.

| Version | Migration | SQL file archived |
|---|---|---|
| `20261112115832` | `secure_admin_bank_transfer_verification` | No — original SQL unavailable |
| `20261112115844` | `use_existing_bank_transfer_review_rpc` | No — original SQL unavailable |
| `20261113170704` | `add_business_subtitle_to_business_settings` | No — original SQL unavailable |
| `20261115163046` | `create_delivery_location_directory` | No — original SQL unavailable |
| `20261117072708` | `make_address_line_1_optional` | No — original SQL unavailable |
| `20261117090812` | `make_checkout_address_line_1_optional` | No — original SQL unavailable |
| `20261119085929` | `enable_payments_realtime_updates` | No — original SQL unavailable |
| `20261119173535` | `add_store_image_settings_and_assets` | No — original SQL unavailable |
| `20261123103316` | `secure_admin_customer_notifications` | No — original SQL unavailable |
| `20261123160625` | `create_customer_push_subscriptions` | No — original SQL unavailable |
| `20261123171913` | `enable_automatic_firebase_push_dispatch` | No — original SQL unavailable |
| `20261123171953` | `trigger_automatic_push_for_notifications` | No — original SQL unavailable |
| `20261124072628` | `add_idempotent_admin_notifications` | No — original SQL unavailable |
| `20261124073502` | `tighten_push_subscription_and_dispatch_grants` | No — original SQL unavailable |
| `20261124075207` | `add_durable_push_dispatch_retries` | No — original SQL unavailable |
| `20261124075216` | `persist_push_dispatch_jobs_before_webhook` | No — original SQL unavailable |
| `20261124075238` | `add_admin_push_dispatch_monitor_and_correct_webhook` | No — original SQL unavailable |
| `20261124075256` | `index_push_dispatch_retry_schedule` | No — original SQL unavailable |
| `20261124080003` | `add_safe_partial_push_dispatch_marker` | No — original SQL unavailable |
| `20261124080043` | `avoid_automatic_replay_of_uncertain_push_claims` | No — original SQL unavailable |
| `20261124143038` | `notification_consistency_phase_3` | Yes |

## Baseline limitations and next steps

This inventory plus `supabase/types/database.types.ts` provides a useful reference for application table structures and generated client typing. It is **not a substitute for `supabase db dump`**. For a portable, replayable baseline, run the Supabase CLI against the linked project and archive the resulting schema-only SQL after review:

```bash
supabase db dump --linked --schema public,private --file supabase/baseline/20261124_live_application_schema.sql
```

Do not replay that baseline against the existing production database. Treat it as a starting schema snapshot for a fresh environment only, after reviewing roles, extensions, grants, policies, triggers, functions, and dependencies. Keep secrets and user data out of Git.
