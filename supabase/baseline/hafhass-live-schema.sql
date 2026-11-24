--
-- PostgreSQL database dump
--

\restrict UgHOz7zkVf5dCgIjNTV7RGwfdqnwXAwbKHdGUKa3XigQrHrd62DjW33sd3wRLll

-- Dumped from database version 17.11
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: fulfillment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fulfillment_method AS ENUM (
    'pickup',
    'delivery'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'welcome',
    'order_confirmation',
    'payment_confirmation',
    'order_update',
    'delivery_update',
    'service_update',
    'promotion',
    'general'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'awaiting_payment',
    'payment_confirmed',
    'processing',
    'ready_for_pickup',
    'out_for_delivery',
    'completed',
    'cancelled'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'paystack',
    'bank_transfer'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'processing',
    'successful',
    'failed',
    'refunded',
    'partially_refunded'
);


--
-- Name: product_availability; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_availability AS ENUM (
    'in_stock',
    'out_of_stock',
    'pre_order',
    'made_to_order'
);


--
-- Name: product_pricing_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_pricing_type AS ENUM (
    'fixed',
    'starting_from',
    'quote'
);


--
-- Name: product_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_status AS ENUM (
    'draft',
    'active',
    'archived'
);


--
-- Name: quote_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quote_status AS ENUM (
    'draft',
    'sent',
    'accepted',
    'rejected',
    'expired'
);


--
-- Name: review_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: service_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_request_status AS ENUM (
    'pending',
    'reviewing',
    'quoted',
    'accepted',
    'declined',
    'in_progress',
    'completed',
    'cancelled'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'customer',
    'admin',
    'staff'
);


--
-- Name: admin_confirm_manual_delivery_fee(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_confirm_manual_delivery_fee(p_order_id uuid, p_delivery_fee numeric, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  if p_delivery_fee is null or p_delivery_fee < 0 then
    raise exception 'Enter a valid delivery fee.';
  end if;

  update public.orders
  set delivery_fee=p_delivery_fee,
      total_amount=subtotal+p_delivery_fee,
      delivery_fee_status='awaiting_manual_payment',
      delivery_fee_collection_method='manual',
      delivery_fee_confirmed_at=now(),
      delivery_fee_confirmed_by=auth.uid(),
      delivery_location_review_required=false,
      delivery_location_review_note=nullif(btrim(p_note),''),
      updated_at=now()
  where id=p_order_id
    and fulfillment_method='delivery'
    and delivery_fee_status='pending_review'
    and delivery_fee_collection_method='manual'
  returning * into v_order;

  if not found then raise exception 'This order is not awaiting a manual delivery-fee confirmation.'; end if;
  return jsonb_build_object('success',true,'order_id',v_order.id,'delivery_fee',v_order.delivery_fee,
    'order_total',v_order.total_amount,'online_payment_amount',v_order.initial_online_amount,
    'delivery_fee_status',v_order.delivery_fee_status);
end;
$$;


--
-- Name: admin_get_push_dispatch_monitor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_push_dispatch_monitor() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  select jsonb_build_object(
    'summary', jsonb_build_object(
      'queued', count(*) filter (where d.status = 'retrying'),
      'processing', count(*) filter (where d.status = 'processing'),
      'completed', count(*) filter (where d.status = 'completed'),
      'partial', count(*) filter (where d.status = 'partial'),
      'failed', count(*) filter (where d.status = 'failed'),
      'total', count(*)
    ),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'notification_id', recent.notification_id,
        'title', recent.title,
        'status', recent.status,
        'attempt_count', recent.attempt_count,
        'next_attempt_at', recent.next_attempt_at,
        'last_attempt_at', recent.last_attempt_at,
        'completed_at', recent.completed_at,
        'sent_count', recent.sent_count,
        'failed_count', recent.failed_count,
        'device_count', recent.device_count,
        'last_error', recent.last_error
      ) order by recent.started_at desc)
      from (
        select d.notification_id, n.title, d.status, d.attempt_count,
          d.next_attempt_at, d.last_attempt_at, d.completed_at,
          d.sent_count, d.failed_count, d.device_count, d.last_error,
          d.started_at
        from public.push_notification_dispatches d
        join public.notifications n on n.id = d.notification_id
        order by d.started_at desc
        limit 50
      ) recent
    ), '[]'::jsonb)
  ) into v_result
  from public.push_notification_dispatches d;

  return coalesce(v_result, jsonb_build_object(
    'summary', jsonb_build_object('queued',0,'processing',0,'completed',0,'partial',0,'failed',0,'total',0),
    'recent','[]'::jsonb
  ));
end;
$$;


--
-- Name: admin_mark_delivery_completed(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_mark_delivery_completed(p_order_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  update public.orders o
  set delivery_completed_at=now(),
      delivery_completed_by=auth.uid(),
      status='completed',
      updated_at=now()
  where o.id=p_order_id
    and o.fulfillment_method='delivery'
    and o.delivery_completed_at is null
    and o.status in ('payment_confirmed','processing','out_for_delivery')
    and exists (
      select 1 from public.payments p
      where p.order_id=o.id and p.status='successful'
    )
    and (
      (o.delivery_fee_collection_method='online' and o.delivery_fee_status='included_online')
      or (o.delivery_fee_collection_method='manual' and o.delivery_fee_status='settled')
    )
  returning o.* into v_order;

  if not found then
    raise exception 'Delivery requires a verified product payment, an active delivery order, and a settled delivery fee before completion.';
  end if;

  return jsonb_build_object('success',true,'order_id',v_order.id,
    'order_status',v_order.status,'delivery_completed_at',v_order.delivery_completed_at);
end;
$$;


--
-- Name: admin_mark_delivery_fee_settled(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_mark_delivery_fee_settled(p_order_id uuid, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required.'; end if;
  update public.orders
  set delivery_fee_status='settled',
      delivery_fee_settled_at=now(),
      delivery_fee_settled_by=auth.uid(),
      delivery_location_review_note=coalesce(nullif(btrim(p_note),''),delivery_location_review_note),
      updated_at=now()
  where id=p_order_id and fulfillment_method='delivery'
    and delivery_fee_collection_method='manual'
    and delivery_fee_status='awaiting_manual_payment'
  returning * into v_order;
  if not found then raise exception 'This order is not awaiting manual delivery-fee settlement.'; end if;
  return jsonb_build_object('success',true,'order_id',v_order.id,'delivery_fee_status',v_order.delivery_fee_status);
end;
$$;


--
-- Name: admin_reopen_payment(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_reopen_payment(p_payment_id uuid, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_payment record;
  v_reason text;
  v_amount text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  v_reason := nullif(btrim(p_reason), '');
  if v_reason is null or char_length(v_reason) < 10 then
    raise exception 'Please provide a clear reversal reason of at least 10 characters.';
  end if;
  if char_length(v_reason) > 1000 then
    raise exception 'The reversal reason cannot exceed 1000 characters.';
  end if;

  select
    p.id,
    p.order_id,
    p.user_id,
    p.status,
    p.amount,
    p.currency,
    o.order_number,
    o.status as order_status
  into v_payment
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.id = p_payment_id
  for update of p, o;

  if not found then
    raise exception 'Payment record not found.';
  end if;

  if v_payment.status <> 'successful' then
    raise exception 'Only successful payments can be reopened.';
  end if;

  if v_payment.order_status not in ('pending', 'awaiting_payment', 'payment_confirmed') then
    raise exception 'This order has already progressed beyond payment confirmation. Review the order before attempting a payment reversal.';
  end if;

  update public.payments
  set
    status = 'pending',
    verified_at = null,
    failure_reason = null,
    reversal_reason = v_reason,
    auto_confirmed_by_order = false
  where id = p_payment_id;

  if v_payment.order_status = 'payment_confirmed' then
    update public.orders
    set status = 'awaiting_payment'
    where id = v_payment.order_id;
  end if;

  v_amount :=
    case
      when btrim(v_payment.currency) = 'NGN' then '₦'
      else btrim(v_payment.currency) || ' '
    end
    || to_char(v_payment.amount, 'FM999,999,999,990.00');

  perform public.create_notification(
    v_payment.user_id,
    'payment_confirmation'::public.notification_type,
    'Payment under review',
    format(
      'Your payment of %s for order %s has been reopened for review. Its confirmation is temporarily on hold while we verify the payment. Please do not make another payment unless our team contacts you.',
      v_amount,
      v_payment.order_number
    ),
    'order-details.html?id=' || v_payment.order_id,
    v_payment.order_id
  );

  return jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'payment_status', 'pending',
    'order_id', v_payment.order_id,
    'order_status',
      case
        when v_payment.order_status = 'payment_confirmed' then 'awaiting_payment'
        else v_payment.order_status::text
      end,
    'reason', v_reason
  );
end;
$$;


--
-- Name: admin_review_bank_transfer(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_review_bank_transfer(p_payment_id uuid, p_approve boolean, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_payment record;
  v_new_status public.payment_status;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  select
    p.id,
    p.order_id,
    p.user_id,
    p.payment_method,
    p.status,
    o.status as order_status
  into v_payment
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.id = p_payment_id
  for update of p;

  if not found then
    raise exception 'Payment record not found.';
  end if;

  if v_payment.payment_method <> 'bank_transfer' then
    raise exception 'This function only handles bank transfers.';
  end if;

  if v_payment.status not in ('pending', 'processing') then
    raise exception 'This payment has already been reviewed.';
  end if;

  if p_approve and v_payment.order_status = 'cancelled' then
    raise exception 'Payment cannot be confirmed for a cancelled order.';
  end if;

  if p_approve then
    v_new_status := 'successful';

    update public.payments
    set
      status = 'successful',
      verified_at = now(),
      failure_reason = null,
      reversal_reason = null,
      auto_confirmed_by_order = false
    where id = p_payment_id;

    if v_payment.order_status in ('pending', 'awaiting_payment') then
      update public.orders
      set status = 'payment_confirmed'
      where id = v_payment.order_id;
    end if;

  else
    v_new_status := 'failed';

    update public.payments
    set
      status = 'failed',
      verified_at = null,
      failure_reason = coalesce(
        nullif(btrim(p_reason), ''),
        'Bank transfer was not verified.'
      ),
      reversal_reason = null,
      auto_confirmed_by_order = false
    where id = p_payment_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'payment_status', v_new_status,
    'order_id', v_payment.order_id,
    'approved', p_approve
  );
end;
$$;


--
-- Name: admin_send_broadcast_notification(text, text, public.notification_type, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_send_broadcast_notification(p_title text, p_message text, p_type public.notification_type DEFAULT 'general'::public.notification_type, p_action_url text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_sent_count integer := 0;
  v_customer_id uuid;
  v_action_url text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
  IF NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_message), '') IS NULL THEN
    RAISE EXCEPTION 'A title and a message are required.';
  END IF;
  IF p_type IS NULL THEN RAISE EXCEPTION 'A notification category is required.'; END IF;
  v_action_url := public.normalize_notification_action_url(p_action_url);
  FOR v_customer_id IN
    SELECT profile.id FROM public.profiles profile
    WHERE profile.role = 'customer'::public.user_role AND profile.is_active = true
  LOOP
    PERFORM public.create_notification(v_customer_id, p_type, BTRIM(p_title),
      BTRIM(p_message), v_action_url, NULL, NULL);
    v_sent_count := v_sent_count + 1;
  END LOOP;
  RETURN v_sent_count;
END;
$$;


--
-- Name: admin_send_notification(uuid, text, text, public.notification_type, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_send_notification(p_user_id uuid, p_title text, p_message text, p_type public.notification_type DEFAULT 'general'::public.notification_type, p_action_url text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A customer recipient is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = p_user_id
      AND profile.role = 'customer'::public.user_role
      AND profile.is_active = true
  ) THEN
    RAISE EXCEPTION 'The selected customer account is unavailable.';
  END IF;

  IF NULLIF(BTRIM(p_title), '') IS NULL
     OR NULLIF(BTRIM(p_message), '') IS NULL THEN
    RAISE EXCEPTION 'A title and a message are required.';
  END IF;

  IF p_type IS NULL THEN
    RAISE EXCEPTION 'A notification category is required.';
  END IF;

  v_notification_id := public.create_notification(
    p_user_id,
    p_type,
    BTRIM(p_title),
    BTRIM(p_message),
    NULLIF(BTRIM(p_action_url), '')
  );

  RETURN v_notification_id;
END;
$$;


--
-- Name: admin_send_notification_idempotent(uuid, uuid, text, text, public.notification_type, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_send_notification_idempotent(p_request_id uuid, p_user_id uuid, p_title text, p_message text, p_type public.notification_type, p_action_url text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_admin_id uuid;
  v_existing private.admin_notification_requests%rowtype;
  v_inserted integer;
  v_notification_id uuid;
  v_created_count integer := 0;
  v_action_url text;
  v_customer_id uuid;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'A request identifier is required.'; END IF;
  IF NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_message), '') IS NULL THEN
    RAISE EXCEPTION 'A title and a message are required.';
  END IF;
  IF p_type IS NULL THEN RAISE EXCEPTION 'A notification category is required.'; END IF;
  v_action_url := public.normalize_notification_action_url(p_action_url);

  INSERT INTO private.admin_notification_requests (
    request_id, admin_user_id, recipient_user_id, title, message, notification_type, action_url
  ) VALUES (
    p_request_id, v_admin_id, p_user_id, BTRIM(p_title), BTRIM(p_message), p_type, v_action_url
  ) ON CONFLICT (request_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_existing FROM private.admin_notification_requests WHERE request_id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'The notification request could not be recovered. Please retry.'; END IF;
    IF v_existing.admin_user_id IS DISTINCT FROM v_admin_id
       OR v_existing.recipient_user_id IS DISTINCT FROM p_user_id
       OR v_existing.title IS DISTINCT FROM BTRIM(p_title)
       OR v_existing.message IS DISTINCT FROM BTRIM(p_message)
       OR v_existing.notification_type IS DISTINCT FROM p_type
       OR v_existing.action_url IS DISTINCT FROM v_action_url THEN
      RAISE EXCEPTION 'This request identifier has already been used for different notification details.';
    END IF;
    IF v_existing.created_count IS NULL THEN
      RAISE EXCEPTION 'The original notification request is not yet complete. Please retry shortly.';
    END IF;
    RETURN jsonb_build_object('created_count', v_existing.created_count,
      'notification_id', v_existing.notification_id, 'replayed', true);
  END IF;

  IF p_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles profile
      WHERE profile.id = p_user_id AND profile.role = 'customer'::public.user_role AND profile.is_active = true
    ) THEN RAISE EXCEPTION 'The selected customer account is unavailable.'; END IF;
    v_notification_id := public.create_notification(p_user_id, p_type, BTRIM(p_title),
      BTRIM(p_message), v_action_url, NULL, NULL);
    IF v_notification_id IS NULL THEN RAISE EXCEPTION 'The customer notification could not be created.'; END IF;
    v_created_count := 1;
  ELSE
    FOR v_customer_id IN
      SELECT profile.id FROM public.profiles profile
      WHERE profile.role = 'customer'::public.user_role AND profile.is_active = true
    LOOP
      PERFORM public.create_notification(v_customer_id, p_type, BTRIM(p_title),
        BTRIM(p_message), v_action_url, NULL, NULL);
      v_created_count := v_created_count + 1;
    END LOOP;
  END IF;

  UPDATE private.admin_notification_requests
  SET created_count = v_created_count, notification_id = v_notification_id
  WHERE request_id = p_request_id;
  RETURN jsonb_build_object('created_count', v_created_count,
    'notification_id', v_notification_id, 'replayed', false);
END;
$$;


--
-- Name: checkout_create_order(public.fulfillment_method, jsonb, date, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkout_create_order(p_fulfillment_method public.fulfillment_method, p_delivery_address jsonb DEFAULT NULL::jsonb, p_requested_date date DEFAULT NULL::date, p_requested_time text DEFAULT NULL::text, p_customer_notes text DEFAULT NULL::text, p_receipt_path text DEFAULT NULL::text, p_transfer_reference text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$

DECLARE

  v_user_id UUID;
  v_profile public.profiles%ROWTYPE;

  v_cart_id UUID;
  v_cart_item RECORD;
  v_product RECORD;
  v_option RECORD;
  v_option_value RECORD;

  v_selected JSONB;
  v_selected_options JSONB;
  v_normalized_options JSONB;

  v_option_id_text TEXT;
  v_option_value_id TEXT;
  v_raw_value TEXT;

  v_selected_count INTEGER;
  v_minimum INTEGER;
  v_maximum INTEGER;
  v_available_value_count INTEGER;

  v_option_adjustments NUMERIC(12,2);
  v_unit_price NUMERIC(12,2);
  v_line_total NUMERIC(12,2);

  v_quantity INTEGER;
  v_subtotal NUMERIC(12,2) := 0;
  v_delivery_fee NUMERIC(12,2) := 0;

  v_currency CHAR(3);
  v_item_currency CHAR(3);

  v_items JSONB := '[]'::JSONB;

  v_state TEXT;
  v_city TEXT;
  v_area TEXT;

  v_fee_result JSONB;
  v_manual_delivery_fee BOOLEAN := FALSE;
  v_delivery_zone_id UUID;
  v_delivery_zone_matched_by TEXT;

  v_reference_path TEXT;

  v_order_id UUID;
  v_order_number TEXT;
  v_payment_id UUID;

BEGIN

  /* =====================================================
     1. AUTHENTICATION
  ===================================================== */

  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Please sign in before checking out.';
  END IF;

  /* The receipt must be stored in the authenticated customer's folder. */
  IF p_receipt_path IS NULL
     OR BTRIM(p_receipt_path) = ''
     OR p_receipt_path !~ ('^' || v_user_id::TEXT || '/[^/][^/]*$')
     OR p_receipt_path LIKE '%..%'
     OR POSITION(chr(92) IN p_receipt_path) > 0 THEN
    RAISE EXCEPTION 'Please upload a valid payment receipt before placing your order.';
  END IF;

  IF p_transfer_reference IS NOT NULL
     AND LENGTH(BTRIM(p_transfer_reference)) > 200 THEN
    RAISE EXCEPTION 'The transfer reference is too long.';
  END IF;

  IF NULLIF(BTRIM(p_receipt_path), '') IS NULL THEN
    RAISE EXCEPTION 'Please upload your bank transfer receipt before placing the order.';
  END IF;

  IF p_receipt_path !~ ('^' || v_user_id::TEXT || '/[A-Za-z0-9._-]+$') THEN
    RAISE EXCEPTION 'The payment receipt path is invalid.';
  END IF;


  /* =====================================================
     2. CUSTOMER PROFILE
  ===================================================== */

  SELECT *
  INTO v_profile

  FROM public.profiles

  WHERE id = v_user_id
    AND is_active = TRUE
    AND role::TEXT = 'customer';


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'An active customer account is required to checkout.';
  END IF;


  IF NULLIF(BTRIM(v_profile.full_name), '') IS NULL THEN
    RAISE EXCEPTION
      'Please complete your profile name before checkout.';
  END IF;


  IF NULLIF(BTRIM(v_profile.email), '') IS NULL THEN
    RAISE EXCEPTION
      'Please complete your email address before checkout.';
  END IF;


  IF NULLIF(BTRIM(v_profile.phone), '') IS NULL THEN
    RAISE EXCEPTION
      'Please add your phone number before checkout.';
  END IF;


  /* =====================================================
     3. FULFILLMENT VALIDATION
  ===================================================== */

  IF p_fulfillment_method = 'delivery' THEN

    IF p_delivery_address IS NULL
       OR JSONB_TYPEOF(p_delivery_address) <> 'object' THEN

      RAISE EXCEPTION
        'Please provide a valid delivery address.';

    END IF;


    v_state :=
      NULLIF(BTRIM(p_delivery_address->>'state'), '');

    v_city :=
      NULLIF(BTRIM(p_delivery_address->>'city'), '');

    v_area :=
      NULLIF(BTRIM(p_delivery_address->>'area'), '');


    IF v_state IS NULL
       OR v_city IS NULL THEN

      RAISE EXCEPTION
        'State and settlement are required.';

    END IF;



    /* Resolve the selected hierarchy. Unknown specific places require manual review. */
    v_fee_result := public.get_delivery_fee(
      NULLIF(p_delivery_address->>'state_id', '')::UUID,
      NULLIF(p_delivery_address->>'lga_id', '')::UUID,
      NULLIF(p_delivery_address->>'city_id', '')::UUID,
      NULLIF(p_delivery_address->>'area_id', '')::UUID,
      NULLIF(p_delivery_address->>'location_node_id', '')::UUID,
      (COALESCE((p_delivery_address->>'is_custom_location')::BOOLEAN, FALSE)
        OR NULLIF(BTRIM(p_delivery_address->>'custom_location_text'), '') IS NOT NULL
        OR NULLIF(p_delivery_address->>'state_id', '') IS NULL
        OR NULLIF(p_delivery_address->>'lga_id', '') IS NULL
        OR NULLIF(p_delivery_address->>'city_id', '') IS NULL)
    );

    IF COALESCE((v_fee_result->>'success')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION '%', COALESCE(v_fee_result->>'message', 'Unable to validate the selected delivery location.');
    END IF;

    IF COALESCE((v_fee_result->>'available')::BOOLEAN, FALSE) THEN
      v_delivery_fee := COALESCE((v_fee_result->>'delivery_fee')::NUMERIC, 0);
      v_delivery_zone_id := NULLIF(v_fee_result->>'zone_id', '')::UUID;
      v_delivery_zone_matched_by := v_fee_result->>'matched_by';
    ELSE
      v_delivery_fee := 0;
      v_manual_delivery_fee := TRUE;
    END IF;

  ELSIF p_fulfillment_method = 'pickup' THEN

    v_delivery_fee := 0;

  ELSE

    RAISE EXCEPTION
      'Invalid fulfillment method.';

  END IF;


  /* =====================================================
     4. FIND AND LOCK ACTIVE CART
  ===================================================== */

  SELECT c.id
  INTO v_cart_id

  FROM public.carts c

  WHERE c.user_id = v_user_id
    AND c.status = 'active'

  ORDER BY c.created_at DESC

  LIMIT 1

  FOR UPDATE;


  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'Your shopping cart is empty.';
  END IF;


  IF NOT EXISTS (
    SELECT 1
    FROM public.cart_items ci
    WHERE ci.cart_id = v_cart_id
  ) THEN

    RAISE EXCEPTION 'Your shopping cart is empty.';

  END IF;


  /* =====================================================
     5. VALIDATE EACH CART ITEM
  ===================================================== */

  FOR v_cart_item IN

    SELECT ci.*

    FROM public.cart_items ci

    WHERE ci.cart_id = v_cart_id

    ORDER BY ci.created_at, ci.id

    FOR UPDATE

  LOOP

    v_selected_options :=
      COALESCE(
        v_cart_item.selected_options,
        '[]'::JSONB
      );


    IF JSONB_TYPEOF(v_selected_options) <> 'array' THEN

      RAISE EXCEPTION
        'Invalid product options in your cart.';

    END IF;


    /* -----------------------------------------------
       5A. LOAD AND LOCK PRODUCT
    ----------------------------------------------- */

    SELECT
      p.*,

      (
        SELECT pi.image_url

        FROM public.product_images pi

        WHERE pi.product_id = p.id

        ORDER BY
          pi.is_primary DESC,
          pi.display_order ASC

        LIMIT 1

      ) AS primary_image_url

    INTO v_product

    FROM public.products p

    WHERE p.id = v_cart_item.product_id
      AND p.status = 'active'

    FOR UPDATE OF p;


    IF NOT FOUND THEN

      RAISE EXCEPTION
        'A product in your cart is no longer available.';

    END IF;


    /* -----------------------------------------------
       5B. PRICING TYPE
    ----------------------------------------------- */

    IF v_product.pricing_type::TEXT <> 'fixed' THEN

      RAISE EXCEPTION
        'The product "%" requires a quotation before checkout.',
        v_product.name;

    END IF;


    IF v_product.price IS NULL
       OR v_product.price < 0 THEN

      RAISE EXCEPTION
        'Invalid price for product "%".',
        v_product.name;

    END IF;


    /* -----------------------------------------------
       5C. QUANTITY VALIDATION
    ----------------------------------------------- */

    v_quantity := v_cart_item.quantity;


    IF v_quantity IS NULL OR v_quantity < 1 THEN

      RAISE EXCEPTION
        'Invalid quantity for product "%".',
        v_product.name;

    END IF;


    IF v_quantity < COALESCE(
      v_product.minimum_order_quantity,
      1
    ) THEN

      RAISE EXCEPTION
        'The minimum order quantity for "%" is %.',
        v_product.name,
        COALESCE(v_product.minimum_order_quantity, 1);

    END IF;


    IF v_product.maximum_order_quantity IS NOT NULL
       AND v_quantity > v_product.maximum_order_quantity THEN

      RAISE EXCEPTION
        'The maximum order quantity for "%" is %.',
        v_product.name,
        v_product.maximum_order_quantity;

    END IF;


    /* -----------------------------------------------
       5D. AVAILABILITY AND STOCK VALIDATION
    ----------------------------------------------- */

    IF v_product.availability::TEXT = 'out_of_stock' THEN

      RAISE EXCEPTION
        'Product "%" is currently out of stock.',
        v_product.name;

    END IF;


    IF v_product.availability::TEXT = 'in_stock'
       AND v_product.stock_quantity IS NOT NULL
       AND v_quantity > v_product.stock_quantity THEN

      RAISE EXCEPTION
        'Only % units of "%" are currently available.',
        v_product.stock_quantity,
        v_product.name;

    END IF;


    /* -----------------------------------------------
       5E. CURRENCY CONSISTENCY
    ----------------------------------------------- */

    v_item_currency :=
      UPPER(BTRIM(v_product.currency))::CHAR(3);


    IF v_currency IS NULL THEN

      v_currency := v_item_currency;

    ELSIF v_currency <> v_item_currency THEN

      RAISE EXCEPTION
        'Your cart contains products with different currencies. Please separate them into different orders.';

    END IF;


    /* =================================================
       6. VALIDATE REQUIRED PRODUCT OPTIONS
    ================================================= */

    FOR v_option IN

      SELECT

        po.*,

        (
          SELECT COUNT(*)::INTEGER

          FROM public.product_option_values pov

          WHERE pov.option_id = po.id
            AND pov.is_available = TRUE

        ) AS available_value_count

      FROM public.product_options po

      WHERE po.product_id = v_product.id
        AND po.is_active = TRUE

      ORDER BY po.display_order, po.created_at

    LOOP

      SELECT COUNT(*)::INTEGER

      INTO v_selected_count

      FROM JSONB_ARRAY_ELEMENTS(v_selected_options) AS selected(value)

      WHERE selected.value->>'option_id' = v_option.id::TEXT

        AND (

          CASE

            WHEN v_option.input_type IN (
              'text',
              'number',
              'date'
            ) THEN

              NULLIF(
                BTRIM(selected.value->>'value'),
                ''
              ) IS NOT NULL


            WHEN v_option.input_type = 'checkbox'
                 AND v_option.available_value_count = 0 THEN

              LOWER(
                COALESCE(
                  selected.value->>'value',
                  'false'
                )
              ) = 'true'


            ELSE

              NULLIF(
                selected.value->>'option_value_id',
                ''
              ) IS NOT NULL

          END

        );


      v_minimum := GREATEST(
        COALESCE(v_option.minimum_selections, 0),
        CASE
          WHEN v_option.is_required THEN 1
          ELSE 0
        END
      );


      v_maximum := COALESCE(
        v_option.maximum_selections,

        CASE

          WHEN v_option.input_type IN (
            'multi_select'
          ) THEN 2147483647

          WHEN v_option.input_type = 'checkbox'
               AND v_option.available_value_count > 0
          THEN 2147483647

          ELSE 1

        END
      );


      IF v_selected_count < v_minimum THEN

        RAISE EXCEPTION
          'Please complete the required option "%".',
          v_option.display_name;

      END IF;


      IF v_selected_count > v_maximum THEN

        RAISE EXCEPTION
          'Too many selections for option "%".',
          v_option.display_name;

      END IF;

    END LOOP;


    /* =================================================
       7. VALIDATE SELECTED VALUES AND RECALCULATE PRICE
    ================================================= */

    v_normalized_options := '[]'::JSONB;

    v_option_adjustments := 0;


    FOR v_selected IN

      SELECT value

      FROM JSONB_ARRAY_ELEMENTS(v_selected_options)

    LOOP

      IF JSONB_TYPEOF(v_selected) <> 'object' THEN

        RAISE EXCEPTION
          'Invalid product option data.';

      END IF;


      v_option_id_text :=
        v_selected->>'option_id';


      SELECT

        po.*,

        (
          SELECT COUNT(*)::INTEGER

          FROM public.product_option_values pov

          WHERE pov.option_id = po.id
            AND pov.is_available = TRUE

        ) AS available_value_count

      INTO v_option

      FROM public.product_options po

      WHERE po.id::TEXT = v_option_id_text
        AND po.product_id = v_product.id
        AND po.is_active = TRUE;


      IF NOT FOUND THEN

        RAISE EXCEPTION
          'A selected option is invalid or no longer available.';

      END IF;


      v_option_value_id :=
        NULLIF(
          v_selected->>'option_value_id',
          ''
        );


      /* -----------------------------------------------
         7A. DATABASE-BASED OPTION VALUE
      ----------------------------------------------- */

      IF v_option_value_id IS NOT NULL THEN

        SELECT pov.*

        INTO v_option_value

        FROM public.product_option_values pov

        WHERE pov.id::TEXT = v_option_value_id
          AND pov.option_id = v_option.id
          AND pov.is_available = TRUE;


        IF NOT FOUND THEN

          RAISE EXCEPTION
            'A selected value for "%" is no longer available.',
            v_option.display_name;

        END IF;


        CASE v_option_value.price_adjustment_type

          WHEN 'none' THEN

            NULL;


          WHEN 'fixed' THEN

            v_option_adjustments :=
              v_option_adjustments
              + v_option_value.price_adjustment;


          WHEN 'percentage' THEN

            v_option_adjustments :=
              v_option_adjustments
              + ROUND(
                  v_product.price
                  * v_option_value.price_adjustment
                  / 100,
                  2
                );


          ELSE

            RAISE EXCEPTION
              'Invalid pricing configuration for option "%".',
              v_option.display_name;

        END CASE;


        v_normalized_options :=
          v_normalized_options
          || JSONB_BUILD_ARRAY(

            JSONB_BUILD_OBJECT(

              'option_id',
              v_option.id,

              'option_value_id',
              v_option_value.id,

              'option_name',
              v_option.name,

              'display_name',
              v_option.display_name,

              'value',
              v_option_value.value,

              'label',
              v_option_value.label,

              'price_adjustment_type',
              v_option_value.price_adjustment_type,

              'price_adjustment',
              v_option_value.price_adjustment

            )

          );


      /* -----------------------------------------------
         7B. FREE-TEXT, NUMBER, DATE OR SIMPLE CHECKBOX
      ----------------------------------------------- */

      ELSE

        v_raw_value :=
          NULLIF(
            BTRIM(v_selected->>'value'),
            ''
          );


        IF v_option.input_type IN (
          'text',
          'number',
          'date'
        ) THEN

          IF v_raw_value IS NULL THEN

            IF v_option.is_required THEN

              RAISE EXCEPTION
                'Please complete "%".',
                v_option.display_name;

            ELSE

              CONTINUE;

            END IF;

          END IF;


          IF v_option.input_type = 'number' THEN

            BEGIN

              PERFORM v_raw_value::NUMERIC;

            EXCEPTION WHEN OTHERS THEN

              RAISE EXCEPTION
                'Please enter a valid number for "%".',
                v_option.display_name;

            END;

          END IF;


          IF v_option.input_type = 'date' THEN

            BEGIN

              PERFORM v_raw_value::DATE;

            EXCEPTION WHEN OTHERS THEN

              RAISE EXCEPTION
                'Please enter a valid date for "%".',
                v_option.display_name;

            END;

          END IF;


          v_normalized_options :=
            v_normalized_options
            || JSONB_BUILD_ARRAY(

              JSONB_BUILD_OBJECT(

                'option_id',
                v_option.id,

                'option_value_id',
                NULL,

                'option_name',
                v_option.name,

                'display_name',
                v_option.display_name,

                'value',
                v_raw_value,

                'label',
                v_raw_value,

                'price_adjustment_type',
                'none',

                'price_adjustment',
                0

              )

            );


        ELSIF v_option.input_type = 'checkbox'
              AND v_option.available_value_count = 0 THEN


          IF LOWER(
            COALESCE(
              v_selected->>'value',
              'false'
            )
          ) <> 'true' THEN

            CONTINUE;

          END IF;


          v_normalized_options :=
            v_normalized_options
            || JSONB_BUILD_ARRAY(

              JSONB_BUILD_OBJECT(

                'option_id',
                v_option.id,

                'option_value_id',
                NULL,

                'option_name',
                v_option.name,

                'display_name',
                v_option.display_name,

                'value',
                TRUE,

                'label',
                v_option.display_name,

                'price_adjustment_type',
                'none',

                'price_adjustment',
                0

              )

            );


        ELSE

          RAISE EXCEPTION
            'A valid selection is required for "%".',
            v_option.display_name;

        END IF;

      END IF;

    END LOOP;


    /* =================================================
       8. CALCULATE AUTHORITATIVE ITEM PRICE
    ================================================= */

    v_unit_price := ROUND(
      v_product.price + v_option_adjustments,
      2
    );


    v_line_total := ROUND(
      v_unit_price * v_quantity,
      2
    );


    v_subtotal := v_subtotal + v_line_total;


    /* =================================================
       9. VALIDATE PRIVATE REFERENCE IMAGE
    ================================================= */

    v_reference_path :=
      NULLIF(
        BTRIM(v_cart_item.reference_image_url),
        ''
      );


    IF v_reference_path IS NOT NULL
       AND v_reference_path NOT LIKE
         v_user_id::TEXT || '/%' THEN

      RAISE EXCEPTION
        'An invalid reference image was found in your cart.';

    END IF;


    /* =================================================
       10. PREPARE VERIFIED ORDER ITEM
    ================================================= */

    v_items :=
      v_items
      || JSONB_BUILD_ARRAY(

        JSONB_BUILD_OBJECT(

          'product_id',
          v_product.id,

          'product_name',
          v_product.name,

          'product_sku',
          v_product.sku,

          'product_image_url',
          v_product.primary_image_url,

          'product_description',
          v_product.description,

          'quantity',
          v_quantity,

          'unit_price',
          v_unit_price,

          'line_total',
          v_line_total,

          'currency',
          v_item_currency,

          'selected_options',
          v_normalized_options,

          'custom_text',
          v_cart_item.custom_text,

          'customer_notes',
          v_cart_item.customer_notes,

          'reference_image_url',
          v_reference_path

        )

      );

  END LOOP;


  /* =====================================================
     11. VALIDATE FINAL ORDER TOTAL
  ===================================================== */

  IF v_subtotal <= 0 THEN

    RAISE EXCEPTION
      'The order total must be greater than zero.';

  END IF;


  IF v_currency IS NULL THEN

    RAISE EXCEPTION
      'Unable to determine the order currency.';

  END IF;


  /* =====================================================
     12. CREATE ORDER
  ===================================================== */

  INSERT INTO public.orders (

    user_id,

    status,

    fulfillment_method,

    customer_name,

    customer_email,

    customer_phone,

    delivery_address,

    requested_date,

    requested_time,

    subtotal,

    delivery_fee,

    discount_amount,

    tax_amount,

    total_amount,

    currency,

    customer_notes,

    initial_online_amount,

    delivery_fee_status,

    delivery_fee_collection_method,

    delivery_location_review_required,

    delivery_zone_id,

    delivery_zone_matched_by

  )

  VALUES (

    v_user_id,

    'awaiting_payment',

    p_fulfillment_method,

    BTRIM(v_profile.full_name),

    BTRIM(v_profile.email),

    BTRIM(v_profile.phone),

    CASE
      WHEN p_fulfillment_method = 'delivery'
      THEN p_delivery_address
      ELSE NULL
    END,

    p_requested_date,

    NULLIF(BTRIM(p_requested_time), ''),

    v_subtotal,

    v_delivery_fee,

    0,

    0,

    CASE WHEN v_manual_delivery_fee THEN v_subtotal ELSE v_subtotal + v_delivery_fee END,

    v_currency,

    NULLIF(BTRIM(p_customer_notes), ''),

    CASE WHEN v_manual_delivery_fee THEN v_subtotal ELSE v_subtotal + v_delivery_fee END,

    CASE WHEN p_fulfillment_method = 'pickup' THEN 'not_required' WHEN v_manual_delivery_fee THEN 'pending_review' ELSE 'included_online' END,

    CASE WHEN p_fulfillment_method = 'pickup' THEN 'none' WHEN v_manual_delivery_fee THEN 'manual' ELSE 'online' END,

    v_manual_delivery_fee,

    v_delivery_zone_id,

    v_delivery_zone_matched_by

  )

  RETURNING id, order_number

  INTO v_order_id, v_order_number;


  /* =====================================================
     13. CREATE VERIFIED ORDER ITEMS
  ===================================================== */

  INSERT INTO public.order_items (

    order_id,

    product_id,

    product_name,

    product_sku,

    product_image_url,

    product_description,

    quantity,

    unit_price,

    line_total,

    currency,

    selected_options,

    custom_text,

    customer_notes,

    reference_image_url,

    item_type

  )

  SELECT

    v_order_id,

    (item.value->>'product_id')::UUID,

    item.value->>'product_name',

    item.value->>'product_sku',

    item.value->>'product_image_url',

    item.value->>'product_description',

    (item.value->>'quantity')::INTEGER,

    (item.value->>'unit_price')::NUMERIC,

    (item.value->>'line_total')::NUMERIC,

    (item.value->>'currency')::CHAR(3),

    item.value->'selected_options',

    item.value->>'custom_text',

    item.value->>'customer_notes',

    item.value->>'reference_image_url',

    'product'

  FROM JSONB_ARRAY_ELEMENTS(v_items) AS item(value);


  /* =====================================================
     14. CREATE PENDING BANK TRANSFER PAYMENT
  ===================================================== */

  INSERT INTO public.payments (

    order_id,

    user_id,

    payment_method,

    status,

    amount,

    currency,

    receipt_url,

    transfer_reference

  )

  VALUES (

    v_order_id,

    v_user_id,

    'bank_transfer',

    'pending',

    CASE WHEN v_manual_delivery_fee THEN v_subtotal ELSE v_subtotal + v_delivery_fee END,

    v_currency,

    p_receipt_path,

    NULLIF(BTRIM(p_transfer_reference), '')

  )

  RETURNING id INTO v_payment_id;


  /* =====================================================
     15. CLOSE CHECKED-OUT CART
  ===================================================== */

  UPDATE public.carts

  SET

    status = 'converted',

    updated_at = NOW()

  WHERE id = v_cart_id
    AND user_id = v_user_id
    AND status = 'active';


  /* =====================================================
     16. RETURN CHECKOUT RESULT
  ===================================================== */

  RETURN JSONB_BUILD_OBJECT(

    'success',
    TRUE,

    'order_id',
    v_order_id,

    'order_number',
    v_order_number,

    'payment_id',
    v_payment_id,

    'payment_method',
    'bank_transfer',

    'payment_status',
    'pending',

    'currency',
    v_currency,

    'subtotal',
    v_subtotal,

    'delivery_fee',
    CASE WHEN v_manual_delivery_fee THEN NULL ELSE v_delivery_fee END,

    'delivery_fee_status',
    CASE WHEN p_fulfillment_method='pickup' THEN 'not_required'
         WHEN v_manual_delivery_fee THEN 'pending_review' ELSE 'included_online' END,

    'delivery_fee_pending_confirmation',
    v_manual_delivery_fee,

    'delivery_location_review_required',
    v_manual_delivery_fee,

    'initial_online_amount',
    CASE WHEN v_manual_delivery_fee THEN v_subtotal ELSE v_subtotal + v_delivery_fee END,

    'message',
    CASE WHEN v_manual_delivery_fee
      THEN 'Your specific delivery location requires manual confirmation. Our team will contact you with the delivery fee.'
      ELSE NULL END,

    'total_amount',
    CASE WHEN v_manual_delivery_fee THEN v_subtotal ELSE v_subtotal + v_delivery_fee END

  );

END;

$_$;


--
-- Name: claim_notification_push_dispatch(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_notification_push_dispatch(p_notification_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_claimed uuid;
begin
  insert into public.push_notification_dispatches
    (notification_id,status,started_at,completed_at,attempt_count,last_attempt_at,next_attempt_at,last_error)
  values (p_notification_id,'processing',now(),null,1,now(),null,null)
  on conflict (notification_id) do update
    set status='processing',started_at=now(),completed_at=null,
        attempt_count=public.push_notification_dispatches.attempt_count+1,
        last_attempt_at=now(),next_attempt_at=null,last_error=null
  where public.push_notification_dispatches.status='retrying'
    and coalesce(public.push_notification_dispatches.next_attempt_at,now())<=now()
  returning notification_id into v_claimed;
  return v_claimed is not null;
end;
$$;


--
-- Name: complete_notification_push_dispatch(uuid, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_notification_push_dispatch(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update public.push_notification_dispatches
  set status=case
        when greatest(coalesce(p_sent,0),0)>0 and greatest(coalesce(p_failed,0),0)>0 then 'partial'
        when greatest(coalesce(p_sent,0),0)=0 and greatest(coalesce(p_failed,0),0)>0 then 'failed'
        else 'completed' end,
      completed_at=now(),next_attempt_at=null,
      last_error=case
        when greatest(coalesce(p_sent,0),0)>0 and greatest(coalesce(p_failed,0),0)>0
          then 'Some devices failed after at least one device accepted delivery. Automatic retry was withheld to avoid duplicate notifications.'
        when greatest(coalesce(p_sent,0),0)=0 and greatest(coalesce(p_failed,0),0)>0
          then 'All registered devices rejected delivery with a non-retryable error. Review the dispatch details.'
        else null end,
      sent_count=greatest(coalesce(p_sent,0),0),
      failed_count=greatest(coalesce(p_failed,0),0),
      device_count=greatest(coalesce(p_devices,0),0)
  where notification_id=p_notification_id and status='processing';
$$;


--
-- Name: create_notification(uuid, public.notification_type, text, text, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(p_user_id uuid, p_type public.notification_type, p_title text, p_message text, p_action_url text DEFAULT NULL::text, p_order_id uuid DEFAULT NULL::uuid, p_service_request_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.notifications (
    user_id, type, title, message, action_url, related_order_id, related_service_request_id
  ) VALUES (
    p_user_id, p_type, p_title, p_message,
    public.normalize_notification_action_url(p_action_url), p_order_id, p_service_request_id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


--
-- Name: dispatch_notification_push_after_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dispatch_notification_push_after_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  webhook_secret text;
begin
  insert into public.push_notification_dispatches (
    notification_id, status, started_at, completed_at,
    attempt_count, next_attempt_at, last_attempt_at, last_error
  )
  values (new.id, 'retrying', now(), null, 0, now(), null, null)
  on conflict (notification_id) do nothing;

  select ds.decrypted_secret into webhook_secret
  from vault.decrypted_secrets ds
  where ds.name = 'hafhass_push_webhook_secret'
  limit 1;

  if webhook_secret is null then
    raise warning 'HAFHASS push webhook secret is unavailable; notification % remains queued for retry.', new.id;
    return new;
  end if;

  begin
    perform net.http_post(
      url := 'https://gbsvwizlplzoantvkese.supabase.co/functions/v1/dispatch-notification-push',
      body := jsonb_build_object('notification_id', new.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-hafhass-webhook-secret', webhook_secret
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'HAFHASS push dispatch wake-up failed for notification %: %; durable retry remains queued.', new.id, sqlerrm;
  end;

  return new;
end;
$$;


--
-- Name: enqueue_due_notification_push_retries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_due_notification_push_retries() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_secret text; v_count integer:=0; v_row record;
begin
  update public.push_notification_dispatches
  set status='partial',completed_at=now(),next_attempt_at=null,
      last_error='Dispatch worker stopped before recording its final outcome. Automatic replay was withheld because Firebase may already have accepted the notification. Review before retrying.'
  where status='processing' and started_at<now()-interval '10 minutes';

  select decrypted_secret into v_secret from vault.decrypted_secrets
  where name='hafhass_push_webhook_secret' limit 1;
  if v_secret is null then
    raise warning 'HAFHASS push retry worker skipped: webhook secret unavailable.';
    return 0;
  end if;

  for v_row in
    select notification_id from public.push_notification_dispatches
    where status='retrying' and coalesce(next_attempt_at,now())<=now()
    order by coalesce(next_attempt_at,started_at),started_at limit 20
  loop
    perform net.http_post(
      url:='https://gbsvwizlplzoantvkese.supabase.co/functions/v1/dispatch-notification-push',
      body:=jsonb_build_object('notification_id',v_row.notification_id),
      headers:=jsonb_build_object('Content-Type','application/json','x-hafhass-webhook-secret',v_secret),
      timeout_milliseconds:=5000
    );
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;


--
-- Name: get_delivery_fee(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_delivery_fee(p_state text, p_city text, p_area text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  v_state_id uuid;
  v_lga_id uuid;
  v_city_id uuid;
  v_area_id uuid;
  v_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('success',false,'available',false,'message','Please sign in to calculate delivery.');
  end if;
  if nullif(btrim(p_state),'') is null or nullif(btrim(p_city),'') is null then
    return jsonb_build_object('success',false,'available',false,'message','Please provide a state and settlement.');
  end if;

  select count(*)::integer into v_count
  from public.delivery_states s
  join public.delivery_lgas l on l.state_id=s.id and l.is_active
  join public.delivery_cities c on c.lga_id=l.id and c.is_active
  where s.is_active
    and lower(btrim(s.name))=lower(btrim(p_state))
    and lower(btrim(c.name))=lower(btrim(p_city));

  if v_count<>1 then
    return jsonb_build_object('success',true,'available',false,'manual_review_required',true,
      'delivery_fee',null,'message','This settlement needs manual delivery-fee confirmation.');
  end if;

  select s.id,l.id,c.id into v_state_id,v_lga_id,v_city_id
  from public.delivery_states s
  join public.delivery_lgas l on l.state_id=s.id and l.is_active
  join public.delivery_cities c on c.lga_id=l.id and c.is_active
  where s.is_active
    and lower(btrim(s.name))=lower(btrim(p_state))
    and lower(btrim(c.name))=lower(btrim(p_city))
  limit 1;

  if nullif(btrim(p_area),'') is not null then
    select a.id into v_area_id from public.delivery_areas a
    where a.city_id=v_city_id and a.is_active
      and lower(btrim(a.name))=lower(btrim(p_area))
    limit 1;

    if v_area_id is null then
      return public.get_delivery_fee(v_state_id,v_lga_id,v_city_id,null,null,true);
    end if;
  end if;

  return public.get_delivery_fee(v_state_id,v_lga_id,v_city_id,v_area_id,null,false);
end;
$$;


--
-- Name: FUNCTION get_delivery_fee(p_state text, p_city text, p_area text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_delivery_fee(p_state text, p_city text, p_area text) IS 'Returns the active delivery fee for a state, city and optional area. Exact area matches take priority over city-wide zones.';


--
-- Name: get_delivery_fee(uuid, uuid, uuid, uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_delivery_fee(p_state_id uuid, p_lga_id uuid, p_city_id uuid, p_area_id uuid DEFAULT NULL::uuid, p_location_node_id uuid DEFAULT NULL::uuid, p_is_custom_location boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_state_id uuid;
  v_lga_id uuid;
  v_city_id uuid;
  v_area_id uuid;
  v_node_id uuid;
  v_zone record;
begin
  if auth.uid() is null then
    return jsonb_build_object('success',false,'available',false,'message','Please sign in to calculate delivery.');
  end if;

  -- Validate every recognised level supplied, including ancestors of a custom location.
  if p_state_id is not null then
    select s.id into v_state_id from public.delivery_states s
    where s.id=p_state_id and s.is_active;
    if not found then
      return jsonb_build_object('success',false,'available',false,'message','The selected state is inactive or invalid.');
    end if;
  end if;

  if p_lga_id is not null then
    if v_state_id is null then
      return jsonb_build_object('success',false,'available',false,'message','Select the recognised state for this LGA.');
    end if;
    select l.id into v_lga_id from public.delivery_lgas l
    where l.id=p_lga_id and l.state_id=v_state_id and l.is_active;
    if not found then
      return jsonb_build_object('success',false,'available',false,'message','The selected LGA is inactive or does not belong to the selected state.');
    end if;
  end if;

  if p_city_id is not null then
    if v_lga_id is null then
      return jsonb_build_object('success',false,'available',false,'message','Select the recognised LGA for this settlement.');
    end if;
    select c.id into v_city_id from public.delivery_cities c
    where c.id=p_city_id and c.lga_id=v_lga_id and c.is_active;
    if not found then
      return jsonb_build_object('success',false,'available',false,'message','The selected settlement is inactive or does not belong to the selected LGA.');
    end if;
  end if;

  if p_area_id is not null then
    if v_city_id is null then
      return jsonb_build_object('success',false,'available',false,'message','Select the recognised settlement for this area.');
    end if;
    select a.id into v_area_id from public.delivery_areas a
    where a.id=p_area_id and a.city_id=v_city_id and a.is_active;
    if not found then
      return jsonb_build_object('success',false,'available',false,'message','The selected area is inactive or does not belong to the selected settlement.');
    end if;
  end if;

  if p_location_node_id is not null then
    if v_city_id is null then
      return jsonb_build_object('success',false,'available',false,'message','Select the recognised settlement for this specific location.');
    end if;
    if exists (
      with recursive chain as (
        select n.id,n.parent_id,n.settlement_id,n.is_active
        from public.delivery_location_nodes n
        where n.id=p_location_node_id and n.settlement_id=v_city_id
        union all
        select p.id,p.parent_id,p.settlement_id,p.is_active
        from public.delivery_location_nodes p
        join chain ch on ch.parent_id=p.id
      )
      select 1 from chain where not is_active or settlement_id<>v_city_id
    ) or not exists (
      select 1 from public.delivery_location_nodes n
      where n.id=p_location_node_id and n.settlement_id=v_city_id and n.is_active
    ) then
      return jsonb_build_object('success',false,'available',false,'message','The selected specific location or one of its parent locations is inactive or invalid.');
    end if;
    v_node_id:=p_location_node_id;
  end if;

  if p_is_custom_location then
    return jsonb_build_object('success',true,'available',false,'manual_review_required',true,
      'delivery_fee',null,'message','This specific delivery location requires manual confirmation.');
  end if;

  if v_state_id is null or v_lga_id is null or v_city_id is null then
    return jsonb_build_object('success',false,'available',false,'message','Please select a recognised state, LGA and settlement, or submit the exact location for manual review.');
  end if;

  with recursive node_chain as (
    select n.id,n.parent_id,0 as depth
    from public.delivery_location_nodes n
    where n.id=v_node_id
    union all
    select parent.id,parent.parent_id,child.depth+1
    from public.delivery_location_nodes parent
    join node_chain child on child.parent_id=parent.id
  )
  select dz.id,dz.delivery_fee,
    case when nc.id is not null then 'location'
         when dz.area_id is not null then 'area'
         when dz.city_id is not null then 'settlement'
         when dz.lga_id is not null then 'lga'
         when dz.state_id is not null then 'state'
         else 'legacy' end matched_by
  into v_zone
  from public.delivery_zones dz
  left join node_chain nc on nc.id=dz.location_node_id
  where dz.is_active and (
    (dz.location_node_id is not null and nc.id is not null)
    or (dz.location_node_id is null and dz.area_id is not null and dz.area_id=v_area_id)
    or (dz.location_node_id is null and dz.area_id is null and dz.city_id is not null and dz.city_id=v_city_id)
    or (dz.location_node_id is null and dz.area_id is null and dz.city_id is null and dz.lga_id is not null and dz.lga_id=v_lga_id)
    or (dz.location_node_id is null and dz.area_id is null and dz.city_id is null and dz.lga_id is null and dz.state_id=v_state_id)
  )
  order by
    case when nc.id is not null then 0 else 1 end,
    coalesce(nc.depth,0),
    case
      when dz.area_id=v_area_id and v_area_id is not null then 2
      when dz.city_id=v_city_id then 3
      when dz.lga_id=v_lga_id then 4
      when dz.state_id=v_state_id then 5
      else 6 end
  limit 1;

  if not found then
    return jsonb_build_object('success',true,'available',false,'delivery_fee',null,
      'message','Delivery fee requires manual confirmation.');
  end if;

  return jsonb_build_object('success',true,'available',true,'manual_review_required',false,
    'delivery_fee',v_zone.delivery_fee,'zone_id',v_zone.id,'matched_by',v_zone.matched_by);
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

BEGIN

    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        phone
    )

    VALUES (
        NEW.id,

        COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name'
        ),

        NEW.email,

        COALESCE(
            NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
            NEW.phone
        )
    )

    ON CONFLICT (id)

    DO UPDATE SET

        email = EXCLUDED.email,

        full_name = COALESCE(
            NULLIF(EXCLUDED.full_name, ''),
            public.profiles.full_name
        ),

        phone = COALESCE(
            NULLIF(EXCLUDED.phone, ''),
            public.profiles.phone
        );

    RETURN NEW;

END;

$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = (SELECT auth.uid())
          AND role = 'admin'::public.user_role
          AND is_active = TRUE
    );
$$;


--
-- Name: manage_default_address(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.manage_default_address() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

BEGIN

    IF NEW.is_default = TRUE THEN

        UPDATE public.addresses

        SET is_default = FALSE

        WHERE user_id = NEW.user_id

        AND id IS DISTINCT FROM NEW.id

        AND is_default = TRUE;

    END IF;

    RETURN NEW;

END;

$$;


--
-- Name: mark_all_notifications_read(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_all_notifications_read() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

DECLARE
  v_count integer;

BEGIN

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in to continue.';
  END IF;

  UPDATE public.notifications
  SET
    is_read = TRUE,
    read_at = COALESCE(read_at, NOW())
  WHERE user_id = auth.uid()
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;

END;

$$;


--
-- Name: mark_notification_push_dispatch_partial(uuid, integer, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_notification_push_dispatch_partial(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer, p_error text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  update public.push_notification_dispatches
  set status = 'partial',
      completed_at = now(),
      next_attempt_at = null,
      sent_count = greatest(coalesce(p_sent,0),0),
      failed_count = greatest(coalesce(p_failed,0),0),
      device_count = greatest(coalesce(p_devices,0),0),
      last_error = left(coalesce(p_error,'Dispatch stopped after at least one device accepted delivery. Review before retrying.'),1000)
  where notification_id = p_notification_id
    and status = 'processing';
end;
$$;


--
-- Name: mark_notification_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_notification_read(p_notification_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

BEGIN

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in to continue.';
  END IF;

  UPDATE public.notifications
  SET
    is_read = TRUE,
    read_at = COALESCE(read_at, NOW())
  WHERE id = p_notification_id
    AND user_id = auth.uid()
    AND is_read = FALSE;

END;

$$;


--
-- Name: normalize_notification_action_url(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_notification_action_url(p_action_url text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
DECLARE
  v_url text := NULLIF(BTRIM(p_action_url), '');
BEGIN
  IF v_url IS NULL THEN RETURN NULL; END IF;
  IF v_url ~* '^[a-z][a-z0-9+.-]*:' OR LEFT(v_url, 2) = '//'
     OR POSITION(CHR(92) IN v_url) > 0 OR v_url ~ '[[:space:]<>]' THEN
    RETURN NULL;
  END IF;
  v_url := REGEXP_REPLACE(v_url, '^(\.\./)+', '/');
  v_url := REGEXP_REPLACE(v_url, '^\./', '/');
  IF LEFT(v_url, 1) <> '/' THEN v_url := '/' || v_url; END IF;
  v_url := REGEXP_REPLACE(v_url, '^/order-details\.html', '/account/order-details.html');
  v_url := REGEXP_REPLACE(v_url, '^/orders\.html', '/account/orders.html');
  v_url := REGEXP_REPLACE(v_url, '^/notification\.html', '/account/notification.html');
  RETURN v_url;
END;
$$;


--
-- Name: notify_new_customer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_customer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

BEGIN

  IF NEW.role = 'customer' THEN

    PERFORM public.create_notification(
      NEW.id,
      'welcome',
      'Welcome to HAFHASS Events & Delights',
      'Your account is ready. Browse the shop, save your delivery addresses and follow your orders right here.',
      'orders.html'
    );

  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN

  RAISE WARNING 'notify_new_customer failed: %', SQLERRM;

  RETURN NEW;

END;

$$;


--
-- Name: notify_order_created(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_order_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

BEGIN

  PERFORM public.create_notification(
    NEW.user_id,
    'order_confirmation',
    'Order received',
    FORMAT(
      'We have received your order %s. We will keep you updated here as it moves along.',
      NEW.order_number
    ),
    'order-details.html?id=' || NEW.id,
    NEW.id
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN

  RAISE WARNING 'notify_order_created failed: %', SQLERRM;

  RETURN NEW;

END;

$$;


--
-- Name: notify_order_status_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_order_status_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

DECLARE
  v_type public.notification_type;
  v_title text;
  v_message text;

BEGIN

  CASE NEW.status

    WHEN 'processing' THEN
      v_type := 'order_update';
      v_title := 'Your order is being prepared';
      v_message := FORMAT(
        'Good news. We have started working on order %s.',
        NEW.order_number
      );

    WHEN 'ready_for_pickup' THEN
      v_type := 'order_update';
      v_title := 'Your order is ready for pickup';
      v_message := FORMAT(
        'Order %s is ready. You can come and collect it.',
        NEW.order_number
      );

    WHEN 'out_for_delivery' THEN
      v_type := 'delivery_update';
      v_title := 'Your order is on its way';
      v_message := FORMAT(
        'Order %s is out for delivery.',
        NEW.order_number
      );

    WHEN 'completed' THEN

      IF NEW.fulfillment_method = 'delivery' THEN
        v_type := 'delivery_update';
        v_title := 'Your order has been delivered';
        v_message := FORMAT(
          'Order %s has been delivered. Thank you for choosing us.',
          NEW.order_number
        );
      ELSE
        v_type := 'order_update';
        v_title := 'Your order is complete';
        v_message := FORMAT(
          'Order %s is complete. Thank you for choosing us.',
          NEW.order_number
        );
      END IF;

    WHEN 'cancelled' THEN
      v_type := 'order_update';
      v_title := 'Your order was cancelled';
      v_message := FORMAT(
        'Order %s was cancelled.%s',
        NEW.order_number,
        CASE
          WHEN NULLIF(BTRIM(NEW.cancellation_reason), '') IS NOT NULL
            THEN ' Reason: ' || BTRIM(NEW.cancellation_reason)
          ELSE ''
        END
      );

    ELSE
      RETURN NEW;

  END CASE;

  PERFORM public.create_notification(
    NEW.user_id,
    v_type,
    v_title,
    v_message,
    'order-details.html?id=' || NEW.id,
    NEW.id
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN

  RAISE WARNING 'notify_order_status_changed failed: %', SQLERRM;

  RETURN NEW;

END;

$$;


--
-- Name: notify_payment_status_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_payment_status_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

DECLARE
  v_order_number text;
  v_amount text;
  v_title text;
  v_message text;

BEGIN

  IF NEW.status NOT IN (
    'successful',
    'failed',
    'refunded',
    'partially_refunded'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT o.order_number
  INTO v_order_number
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  v_amount :=
    CASE
      WHEN BTRIM(NEW.currency) = 'NGN' THEN '₦'
      ELSE BTRIM(NEW.currency) || ' '
    END
    || TO_CHAR(NEW.amount, 'FM999,999,999,990.00');

  CASE NEW.status

    WHEN 'successful' THEN
      v_title := 'Payment confirmed';
      v_message := FORMAT(
        'We have received your payment of %s for order %s. Thank you.',
        v_amount,
        v_order_number
      );

    WHEN 'failed' THEN
      v_title := 'Payment not confirmed';
      v_message := FORMAT(
        'We could not confirm your payment for order %s.%s Please contact us if you need help.',
        v_order_number,
        CASE
          WHEN NULLIF(BTRIM(NEW.failure_reason), '') IS NOT NULL
            THEN ' ' || BTRIM(NEW.failure_reason)
          ELSE ''
        END
      );

    WHEN 'refunded' THEN
      v_title := 'Payment refunded';
      v_message := FORMAT(
        'Your payment of %s for order %s has been refunded.',
        v_amount,
        v_order_number
      );

    ELSE
      v_title := 'Partial refund issued';
      v_message := FORMAT(
        'A partial refund has been issued for order %s.',
        v_order_number
      );

  END CASE;

  PERFORM public.create_notification(
    NEW.user_id,
    'payment_confirmation',
    v_title,
    v_message,
    'order-details.html?id=' || NEW.order_id,
    NEW.order_id
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN

  RAISE WARNING 'notify_payment_status_changed failed: %', SQLERRM;

  RETURN NEW;

END;

$$;


--
-- Name: notify_service_request_status_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_service_request_status_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE v_title text; v_message text;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id THEN RETURN NEW; END IF;
  CASE NEW.status
    WHEN 'reviewing' THEN
      v_title := 'We are reviewing your request';
      v_message := FORMAT('Your service request %s is being reviewed by our team.', NEW.request_number);
    WHEN 'quoted' THEN
      v_title := 'Your quote is ready';
      v_message := FORMAT('We have prepared a quote for your service request %s.', NEW.request_number);
    WHEN 'accepted' THEN
      v_title := 'Your request was accepted';
      v_message := FORMAT('Your service request %s has been accepted. We will be in touch with the next steps.', NEW.request_number);
    WHEN 'declined' THEN
      v_title := 'Your request was declined';
      v_message := FORMAT('Unfortunately we could not take on service request %s. Please contact us for details.', NEW.request_number);
    WHEN 'in_progress' THEN
      v_title := 'Work has started';
      v_message := FORMAT('We have started work on your service request %s.', NEW.request_number);
    WHEN 'completed' THEN
      v_title := 'Your service is complete';
      v_message := FORMAT('Your service request %s is complete. Thank you for choosing us.', NEW.request_number);
    WHEN 'cancelled' THEN
      v_title := 'Your request was cancelled';
      v_message := FORMAT('Your service request %s was cancelled.', NEW.request_number);
    ELSE RETURN NEW;
  END CASE;
  PERFORM public.create_notification(NEW.user_id, 'service_update', v_title, v_message,
    '/account/notification.html', NULL, NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_service_request_status_changed failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: record_financial_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_financial_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_record_id uuid;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if tg_table_name = 'payments' then
    if tg_op in ('UPDATE', 'DELETE') then
      v_old_values := jsonb_build_object(
        'order_id', old.order_id,
        'user_id', old.user_id,
        'payment_method', old.payment_method,
        'status', old.status,
        'amount', old.amount,
        'currency', old.currency,
        'paystack_reference', old.paystack_reference,
        'transfer_reference', old.transfer_reference,
        'verified_at', old.verified_at,
        'failure_reason', old.failure_reason,
        'reversal_reason', old.reversal_reason,
        'auto_confirmed_by_order', old.auto_confirmed_by_order
      );
    end if;

    if tg_op in ('INSERT', 'UPDATE') then
      v_new_values := jsonb_build_object(
        'order_id', new.order_id,
        'user_id', new.user_id,
        'payment_method', new.payment_method,
        'status', new.status,
        'amount', new.amount,
        'currency', new.currency,
        'paystack_reference', new.paystack_reference,
        'transfer_reference', new.transfer_reference,
        'verified_at', new.verified_at,
        'failure_reason', new.failure_reason,
        'reversal_reason', new.reversal_reason,
        'auto_confirmed_by_order', new.auto_confirmed_by_order
      );
    end if;

  elsif tg_table_name = 'service_quotes' then
    if tg_op in ('UPDATE', 'DELETE') then
      v_old_values := jsonb_build_object(
        'request_id', old.request_id,
        'amount', old.amount,
        'currency', old.currency,
        'status', old.status,
        'valid_until', old.valid_until,
        'sent_at', old.sent_at,
        'accepted_at', old.accepted_at,
        'rejected_at', old.rejected_at,
        'converted_order_id', old.converted_order_id,
        'converted_at', old.converted_at
      );
    end if;

    if tg_op in ('INSERT', 'UPDATE') then
      v_new_values := jsonb_build_object(
        'request_id', new.request_id,
        'amount', new.amount,
        'currency', new.currency,
        'status', new.status,
        'valid_until', new.valid_until,
        'sent_at', new.sent_at,
        'accepted_at', new.accepted_at,
        'rejected_at', new.rejected_at,
        'converted_order_id', new.converted_order_id,
        'converted_at', new.converted_at
      );
    end if;
  end if;

  if tg_op = 'DELETE' then
    v_record_id := old.id;
  else
    v_record_id := new.id;
  end if;

  insert into public.financial_audit_logs (
    record_type, record_id, operation, old_values, new_values, changed_by, actor_role
  )
  values (
    case when tg_table_name = 'payments' then 'payment' else 'service_quote' end,
    v_record_id,
    tg_op,
    v_old_values,
    v_new_values,
    auth.uid(),
    coalesce(auth.role(), 'database')
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


--
-- Name: record_order_status_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_order_status_history() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

DECLARE
  v_user_id UUID;
  v_source TEXT;
  v_role TEXT;

BEGIN

  v_user_id := auth.uid();


  -- Identify the actor.

  IF v_user_id IS NULL THEN

    v_source := 'system';

  ELSE

    SELECT p.role::text
    INTO v_role
    FROM public.profiles p
    WHERE p.id = v_user_id;

    v_source := CASE
      WHEN v_role = 'admin' THEN 'admin'
      WHEN v_role = 'staff' THEN 'staff'
      WHEN v_role = 'customer' THEN 'customer'
      ELSE 'system'
    END;

  END IF;


  -- Record newly created orders.

  IF TG_OP = 'INSERT' THEN

    INSERT INTO public.order_status_history (
      order_id,
      old_status,
      new_status,
      changed_by,
      change_source
    )
    VALUES (
      NEW.id,
      NULL,
      NEW.status,
      v_user_id,
      v_source
    );


  -- Record actual status changes.

  ELSIF TG_OP = 'UPDATE' THEN

    IF OLD.status IS DISTINCT FROM NEW.status THEN

      INSERT INTO public.order_status_history (
        order_id,
        old_status,
        new_status,
        changed_by,
        change_source
      )
      VALUES (
        NEW.id,
        OLD.status,
        NEW.status,
        v_user_id,
        v_source
      );

    END IF;

  END IF;


  RETURN NEW;

END;

$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: schedule_notification_push_retry(uuid, integer, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_notification_push_retry(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer, p_error text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_attempt integer;
  v_status text;
  v_next timestamptz;
begin
  select attempt_count into v_attempt
  from public.push_notification_dispatches
  where notification_id = p_notification_id
    and status = 'processing'
  for update;

  if not found then
    raise exception 'No active dispatch claim exists for this notification.';
  end if;

  if v_attempt >= 5 then
    v_status := 'failed';
    v_next := null;
  else
    v_status := 'retrying';
    v_next := now() + case v_attempt
      when 1 then interval '1 minute'
      when 2 then interval '5 minutes'
      when 3 then interval '15 minutes'
      else interval '1 hour'
    end;
  end if;

  update public.push_notification_dispatches
  set status = v_status,
      completed_at = case when v_status = 'failed' then now() else null end,
      next_attempt_at = v_next,
      last_error = left(coalesce(p_error, 'Push delivery failed.'), 1000),
      sent_count = greatest(coalesce(p_sent, 0), 0),
      failed_count = greatest(coalesce(p_failed, 0), 0),
      device_count = greatest(coalesce(p_devices, 0), 0)
  where notification_id = p_notification_id;

  return jsonb_build_object(
    'status', v_status,
    'attempt_count', v_attempt,
    'next_attempt_at', v_next
  );
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: sync_delivery_zone_location(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_delivery_zone_location() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_city_id uuid;
  v_lga_id uuid;
  v_state_id uuid;
  v_city_name text;
  v_state_name text;
begin
  if new.location_node_id is not null then
    select c.id,c.name,l.id,s.id,s.name
      into v_city_id,v_city_name,v_lga_id,v_state_id,v_state_name
    from public.delivery_location_nodes n
    join public.delivery_cities c on c.id=n.settlement_id
    join public.delivery_lgas l on l.id=c.lga_id
    join public.delivery_states s on s.id=l.state_id
    where n.id=new.location_node_id;
    new.area_id:=null;
  elsif new.area_id is not null then
    select c.id,c.name,l.id,s.id,s.name
      into v_city_id,v_city_name,v_lga_id,v_state_id,v_state_name
    from public.delivery_areas a
    join public.delivery_cities c on c.id=a.city_id
    join public.delivery_lgas l on l.id=c.lga_id
    join public.delivery_states s on s.id=l.state_id
    where a.id=new.area_id;
    new.location_node_id:=null;
  elsif new.city_id is not null then
    select c.id,c.name,l.id,s.id,s.name
      into v_city_id,v_city_name,v_lga_id,v_state_id,v_state_name
    from public.delivery_cities c
    join public.delivery_lgas l on l.id=c.lga_id
    join public.delivery_states s on s.id=l.state_id
    where c.id=new.city_id;
    new.location_node_id:=null;
    new.area_id:=null;
  elsif new.lga_id is not null then
    select l.id,s.id,s.name into v_lga_id,v_state_id,v_state_name
    from public.delivery_lgas l
    join public.delivery_states s on s.id=l.state_id
    where l.id=new.lga_id;
    new.location_node_id:=null;
    new.area_id:=null;
    new.city_id:=null;
  elsif new.state_id is not null then
    select s.id,s.name into v_state_id,v_state_name
    from public.delivery_states s where s.id=new.state_id;
    new.location_node_id:=null;
    new.area_id:=null;
    new.city_id:=null;
    new.lga_id:=null;
  else
    return new;
  end if;

  if v_state_id is null then raise exception 'The selected delivery zone location is invalid.'; end if;
  new.state_id:=v_state_id;
  new.lga_id:=v_lga_id;
  new.city_id:=v_city_id;
  new.state:=v_state_name;
  new.city:=coalesce(v_city_name,'All settlements');
  return new;
end;
$$;


--
-- Name: sync_payment_when_order_confirmed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_payment_when_order_confirmed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.status = 'payment_confirmed'
     and old.status is distinct from new.status then

    update public.payments
    set
      status = 'successful',
      verified_at = coalesce(verified_at, now()),
      failure_reason = null,
      reversal_reason = null,
      auto_confirmed_by_order = true
    where order_id = new.id
      and status in ('pending', 'processing');

  elsif old.status = 'payment_confirmed'
        and new.status = 'awaiting_payment' then

    update public.payments
    set
      status = 'pending',
      verified_at = null,
      failure_reason = null,
      auto_confirmed_by_order = false
    where order_id = new.id
      and status = 'successful'
      and auto_confirmed_by_order = true;

  end if;

  return new;
end;
$$;


--
-- Name: validate_delivery_location_node(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_delivery_location_node() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_parent_settlement uuid;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'A location cannot be its own parent.';
    end if;

    select settlement_id
      into v_parent_settlement
      from public.delivery_location_nodes
     where id = new.parent_id;

    if v_parent_settlement is null then
      raise exception 'Parent location does not exist.';
    end if;

    if v_parent_settlement <> new.settlement_id then
      raise exception 'Parent and child must belong to the same settlement.';
    end if;

    if tg_op = 'UPDATE' then
      if exists (
        with recursive descendants(id) as (
          select new.id
          union all
          select child.id
            from public.delivery_location_nodes child
            join descendants d on child.parent_id = d.id
        )
        select 1 from descendants where id = new.parent_id
      ) then
        raise exception 'Moving this location would create a hierarchy cycle.';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: validate_order_item_relationship(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_order_item_relationship() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

DECLARE

    v_order_user_id UUID;

    v_quote_status public.quote_status;

    v_quote_request_id UUID;

    v_quote_service_id UUID;

    v_quote_user_id UUID;

    v_converted_order_id UUID;

BEGIN

    -- Retrieve the order owner.

    SELECT user_id
    INTO v_order_user_id

    FROM public.orders

    WHERE id = NEW.order_id;


    IF NOT FOUND THEN

        RAISE EXCEPTION 'Associated order does not exist.';

    END IF;


    -- PRODUCT ORDER ITEM

    IF NEW.item_type = 'product' THEN

        IF NEW.service_id IS NOT NULL
           OR NEW.service_quote_id IS NOT NULL THEN

            RAISE EXCEPTION
            'Product order items cannot reference services or service quotations.';

        END IF;

        RETURN NEW;

    END IF;


    -- SERVICE ORDER ITEM

    IF NEW.item_type = 'service' THEN

        IF NEW.service_id IS NULL THEN

            RAISE EXCEPTION
            'Service order items must reference a service.';

        END IF;


        IF NEW.product_id IS NOT NULL THEN

            RAISE EXCEPTION
            'Service order items cannot reference a product.';

        END IF;


        -- Fixed-price service:
        -- No quotation is required.

        IF NEW.service_quote_id IS NULL THEN

            RETURN NEW;

        END IF;


        -- Custom service quotation:
        -- Validate the quotation and its owner.

        SELECT
            sq.status,
            sq.request_id,
            sq.converted_order_id,
            sr.service_id,
            sr.user_id

        INTO
            v_quote_status,
            v_quote_request_id,
            v_converted_order_id,
            v_quote_service_id,
            v_quote_user_id

        FROM public.service_quotes sq

        JOIN public.service_requests sr
            ON sr.id = sq.request_id

        WHERE sq.id = NEW.service_quote_id;


        IF NOT FOUND THEN

            RAISE EXCEPTION
            'The referenced service quotation does not exist.';

        END IF;


        IF v_quote_status <> 'accepted' THEN

            RAISE EXCEPTION
            'Only accepted service quotations can be converted into orders.';

        END IF;


        IF v_quote_service_id <> NEW.service_id THEN

            RAISE EXCEPTION
            'The quotation does not belong to the selected service.';

        END IF;


        IF v_quote_user_id <> v_order_user_id THEN

            RAISE EXCEPTION
            'The quotation and order must belong to the same customer.';

        END IF;


        IF v_converted_order_id IS NOT NULL
           AND v_converted_order_id <> NEW.order_id THEN

            RAISE EXCEPTION
            'This quotation has already been converted into another order.';

        END IF;


        RETURN NEW;

    END IF;


    RAISE EXCEPTION 'Invalid order item type: %', NEW.item_type;

END;

$$;


--
-- Name: validate_payment_ownership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_payment_ownership() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$

DECLARE

    v_order_user_id UUID;

BEGIN

    SELECT user_id

    INTO v_order_user_id

    FROM public.orders

    WHERE id = NEW.order_id;


    IF NOT FOUND THEN

        RAISE EXCEPTION
        'Payment cannot reference a nonexistent order.';

    END IF;


    IF NEW.user_id <> v_order_user_id THEN

        RAISE EXCEPTION
        'Payment owner must match the associated order owner.';

    END IF;


    RETURN NEW;

END;

$$;


--
-- Name: verify_hafhass_push_webhook(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_hafhass_push_webhook(p_secret text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(
    p_secret = (
      select ds.decrypted_secret
      from vault.decrypted_secrets ds
      where ds.name = 'hafhass_push_webhook_secret'
      limit 1
    ),
    false
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_notification_requests; Type: TABLE; Schema: private; Owner: -
--

CREATE TABLE private.admin_notification_requests (
    request_id uuid NOT NULL,
    admin_user_id uuid NOT NULL,
    recipient_user_id uuid,
    title text NOT NULL,
    message text NOT NULL,
    notification_type public.notification_type NOT NULL,
    action_url text,
    created_count integer,
    notification_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_notification_requests_created_count_check CHECK (((created_count IS NULL) OR (created_count >= 0)))
);


--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text,
    recipient_name text NOT NULL,
    phone text NOT NULL,
    address_line_1 text,
    address_line_2 text,
    city text NOT NULL,
    state text NOT NULL,
    postal_code text,
    country text DEFAULT 'Nigeria'::text NOT NULL,
    delivery_instructions text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lga_id uuid,
    city_id uuid,
    area_id uuid,
    custom_lga text,
    custom_city text,
    custom_area text,
    location_node_id uuid,
    is_custom_location boolean DEFAULT false NOT NULL,
    custom_location_text text,
    CONSTRAINT addresses_address_not_empty CHECK ((length(TRIM(BOTH FROM address_line_1)) > 0)),
    CONSTRAINT addresses_city_not_empty CHECK ((length(TRIM(BOTH FROM city)) > 0)),
    CONSTRAINT addresses_custom_location_details_check CHECK (((is_custom_location = false) OR (NULLIF(btrim(custom_location_text), ''::text) IS NOT NULL) OR (NULLIF(btrim(custom_city), ''::text) IS NOT NULL) OR (NULLIF(btrim(custom_lga), ''::text) IS NOT NULL) OR (NULLIF(btrim(custom_area), ''::text) IS NOT NULL))),
    CONSTRAINT addresses_phone_not_empty CHECK ((length(TRIM(BOTH FROM phone)) > 0)),
    CONSTRAINT addresses_recipient_name_not_empty CHECK ((length(TRIM(BOTH FROM recipient_name)) > 0)),
    CONSTRAINT addresses_state_not_empty CHECK ((length(TRIM(BOTH FROM state)) > 0))
);


--
-- Name: business_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_settings (
    id smallint DEFAULT 1 NOT NULL,
    business_name text DEFAULT 'HAFHASS EVENTS & DELIGHTS'::text NOT NULL,
    tagline text DEFAULT 'Where Taste Meets Creativity.'::text,
    owner_name text,
    business_description text,
    phone text,
    whatsapp_number text,
    email text,
    address text,
    city text,
    state text,
    country text DEFAULT 'Nigeria'::text,
    logo_url text,
    favicon_url text,
    brand_primary_color text DEFAULT '#702D43'::text,
    brand_secondary_color text DEFAULT '#E8B8C3'::text,
    brand_accent_color text DEFAULT '#C6A46A'::text,
    currency text DEFAULT 'NGN'::text NOT NULL,
    timezone text DEFAULT 'Africa/Lagos'::text NOT NULL,
    minimum_order_amount numeric(12,2) DEFAULT 0 NOT NULL,
    pickup_enabled boolean DEFAULT true NOT NULL,
    delivery_enabled boolean DEFAULT true NOT NULL,
    delivery_fee numeric(12,2) DEFAULT 0 NOT NULL,
    free_delivery_enabled boolean DEFAULT false NOT NULL,
    free_delivery_threshold numeric(12,2),
    delivery_information text,
    pickup_information text,
    estimated_delivery_days integer,
    estimated_preparation_days integer,
    opening_hours jsonb DEFAULT '{}'::jsonb NOT NULL,
    bank_transfer_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    social_links jsonb DEFAULT '{}'::jsonb NOT NULL,
    announcement_enabled boolean DEFAULT false NOT NULL,
    announcement_text text,
    announcement_link text,
    terms_url text,
    privacy_url text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    business_subtitle text,
    home_hero_image_url text,
    shop_hero_image_url text,
    services_hero_image_url text,
    gallery_hero_image_url text,
    founder_hero_image_url text,
    custom_orders_hero_image_url text,
    about_section_image_url text,
    home_founder_image_url text,
    founder_portrait_image_url text,
    founder_story_image_url text,
    CONSTRAINT business_currency_length CHECK ((length(currency) = 3)),
    CONSTRAINT business_delivery_fee_nonnegative CHECK ((delivery_fee >= (0)::numeric)),
    CONSTRAINT business_estimated_delivery_nonnegative CHECK (((estimated_delivery_days IS NULL) OR (estimated_delivery_days >= 0))),
    CONSTRAINT business_estimated_preparation_nonnegative CHECK (((estimated_preparation_days IS NULL) OR (estimated_preparation_days >= 0))),
    CONSTRAINT business_free_delivery_nonnegative CHECK (((free_delivery_threshold IS NULL) OR (free_delivery_threshold >= (0)::numeric))),
    CONSTRAINT business_minimum_order_nonnegative CHECK ((minimum_order_amount >= (0)::numeric)),
    CONSTRAINT business_name_not_empty CHECK ((length(TRIM(BOTH FROM business_name)) > 0)),
    CONSTRAINT business_settings_single_record CHECK ((id = 1))
);


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cart_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    selected_options jsonb DEFAULT '[]'::jsonb NOT NULL,
    custom_text text,
    customer_notes text,
    reference_image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cart_items_quantity_positive CHECK ((quantity >= 1)),
    CONSTRAINT cart_items_selected_options_array CHECK ((jsonb_typeof(selected_options) = 'array'::text))
);


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT carts_status_valid CHECK ((status = ANY (ARRAY['active'::text, 'converted'::text, 'abandoned'::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_id uuid,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    image_url text,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT categories_name_not_empty CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT categories_slug_not_empty CHECK ((length(TRIM(BOTH FROM slug)) > 0))
);


--
-- Name: checkout_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout_idempotency (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    request_hash text NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    order_id uuid,
    failure_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT checkout_completed_requires_order CHECK (((status <> 'completed'::text) OR (order_id IS NOT NULL))),
    CONSTRAINT checkout_idempotency_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT checkout_request_hash_valid CHECK ((request_hash ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: delivery_areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    city_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_areas_name_not_blank CHECK ((length(btrim(name)) > 0))
);


--
-- Name: delivery_cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lga_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_cities_name_not_blank CHECK ((length(btrim(name)) > 0))
);


--
-- Name: delivery_lgas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_lgas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    state_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_lgas_name_not_blank CHECK ((length(btrim(name)) > 0))
);


--
-- Name: delivery_location_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_location_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_node_id uuid NOT NULL,
    alias text NOT NULL,
    normalized_alias text GENERATED ALWAYS AS (lower(regexp_replace(btrim(alias), '[[:space:][:punct:]]+'::text, ''::text, 'g'::text))) STORED,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_location_aliases_alias_check CHECK ((length(btrim(alias)) > 0))
);


--
-- Name: delivery_location_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_location_nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    settlement_id uuid NOT NULL,
    parent_id uuid,
    name text NOT NULL,
    slug text NOT NULL,
    place_type text DEFAULT 'community'::text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_location_nodes_name_check CHECK ((length(btrim(name)) > 0)),
    CONSTRAINT delivery_location_nodes_place_type_check CHECK ((place_type = ANY (ARRAY['community'::text, 'quarter'::text, 'neighbourhood'::text, 'area'::text, 'street'::text, 'landmark'::text, 'market'::text, 'junction'::text, 'plaza'::text, 'school'::text, 'hospital'::text, 'mosque'::text, 'church'::text, 'palace'::text, 'bus_stop'::text, 'estate'::text, 'other'::text]))),
    CONSTRAINT delivery_location_nodes_slug_check CHECK ((length(btrim(slug)) > 0))
);


--
-- Name: delivery_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country_code text DEFAULT 'NG'::text NOT NULL,
    name text NOT NULL,
    code text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_states_country_code_check CHECK ((country_code = upper(country_code))),
    CONSTRAINT delivery_states_name_not_blank CHECK ((length(btrim(name)) > 0))
);


--
-- Name: delivery_zone_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_zone_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_zone_id uuid NOT NULL,
    alias text NOT NULL,
    normalized_alias text GENERATED ALWAYS AS (lower(regexp_replace(btrim(alias), '[[:space:][:punct:]]+'::text, ''::text, 'g'::text))) STORED,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_zone_aliases_alias_not_blank CHECK ((length(btrim(alias)) > 0))
);


--
-- Name: delivery_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    state text NOT NULL,
    city text NOT NULL,
    area text,
    delivery_fee numeric(12,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    state_id uuid,
    lga_id uuid,
    city_id uuid,
    area_id uuid,
    location_node_id uuid,
    CONSTRAINT delivery_zones_area_not_empty CHECK (((area IS NULL) OR (length(TRIM(BOTH FROM area)) > 0))),
    CONSTRAINT delivery_zones_city_not_empty CHECK ((length(TRIM(BOTH FROM city)) > 0)),
    CONSTRAINT delivery_zones_fee_nonnegative CHECK ((delivery_fee >= (0)::numeric)),
    CONSTRAINT delivery_zones_hierarchy_ancestry_check CHECK ((((location_node_id IS NULL) OR ((area_id IS NULL) AND (city_id IS NOT NULL) AND (lga_id IS NOT NULL) AND (state_id IS NOT NULL))) AND ((area_id IS NULL) OR ((city_id IS NOT NULL) AND (lga_id IS NOT NULL) AND (state_id IS NOT NULL))) AND ((city_id IS NULL) OR ((lga_id IS NOT NULL) AND (state_id IS NOT NULL))) AND ((lga_id IS NULL) OR (state_id IS NOT NULL)))),
    CONSTRAINT delivery_zones_state_not_empty CHECK ((length(TRIM(BOTH FROM state)) > 0))
);


--
-- Name: favourites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favourites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: financial_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    record_type text NOT NULL,
    record_id uuid NOT NULL,
    operation text NOT NULL,
    old_values jsonb,
    new_values jsonb,
    changed_by uuid,
    actor_role text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_audit_operation_valid CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]))),
    CONSTRAINT financial_audit_record_type_valid CHECK ((record_type = ANY (ARRAY['payment'::text, 'service_quote'::text])))
);


--
-- Name: gallery_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    image_url text NOT NULL,
    alt_text text,
    category text,
    is_featured boolean DEFAULT false NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gallery_image_url_not_empty CHECK ((length(TRIM(BOTH FROM image_url)) > 0)),
    CONSTRAINT gallery_title_not_empty CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.notification_type DEFAULT 'general'::public.notification_type NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    related_order_id uuid,
    related_service_request_id uuid,
    action_url text,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_message_not_empty CHECK ((length(TRIM(BOTH FROM message)) > 0)),
    CONSTRAINT notification_title_not_empty CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: order_item_customizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_item_customizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_item_id uuid NOT NULL,
    option_name text NOT NULL,
    option_value text NOT NULL,
    price_adjustment_type text DEFAULT 'none'::text NOT NULL,
    price_adjustment numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_customizations_adjustment_nonnegative CHECK ((price_adjustment >= (0)::numeric)),
    CONSTRAINT order_customizations_adjustment_type_valid CHECK ((price_adjustment_type = ANY (ARRAY['none'::text, 'fixed'::text, 'percentage'::text]))),
    CONSTRAINT order_customizations_option_name_not_empty CHECK ((length(TRIM(BOTH FROM option_name)) > 0)),
    CONSTRAINT order_customizations_option_value_not_empty CHECK ((length(TRIM(BOTH FROM option_value)) > 0)),
    CONSTRAINT order_customizations_percentage_valid CHECK (((price_adjustment_type <> 'percentage'::text) OR (price_adjustment <= (100)::numeric)))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    product_sku text,
    product_image_url text,
    product_description text,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'NGN'::bpchar NOT NULL,
    selected_options jsonb DEFAULT '[]'::jsonb NOT NULL,
    custom_text text,
    customer_notes text,
    reference_image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    item_type text DEFAULT 'product'::text NOT NULL,
    service_id uuid,
    service_quote_id uuid,
    CONSTRAINT order_items_amounts_nonnegative CHECK (((quantity > 0) AND (unit_price >= (0)::numeric) AND (line_total >= (0)::numeric))),
    CONSTRAINT order_items_line_total_nonnegative CHECK ((line_total >= (0)::numeric)),
    CONSTRAINT order_items_product_name_not_empty CHECK ((length(TRIM(BOTH FROM product_name)) > 0)),
    CONSTRAINT order_items_quantity_positive CHECK ((quantity >= 1)),
    CONSTRAINT order_items_selected_options_array CHECK ((jsonb_typeof(selected_options) = 'array'::text)),
    CONSTRAINT order_items_type_valid CHECK ((((item_type = 'product'::text) AND (service_id IS NULL) AND (service_quote_id IS NULL)) OR ((item_type = 'service'::text) AND (service_id IS NOT NULL)))),
    CONSTRAINT order_items_unit_price_nonnegative CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    old_status public.order_status,
    new_status public.order_status NOT NULL,
    changed_by uuid,
    change_note text,
    change_source text DEFAULT 'system'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_history_source_valid CHECK ((change_source = ANY (ARRAY['admin'::text, 'staff'::text, 'customer'::text, 'system'::text])))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text DEFAULT ('HF-'::text || upper("substring"(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 12))) NOT NULL,
    user_id uuid NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    fulfillment_method public.fulfillment_method NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    delivery_address jsonb,
    requested_date date,
    requested_time text,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    delivery_fee numeric(12,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'NGN'::bpchar NOT NULL,
    customer_notes text,
    cancellation_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    initial_online_amount numeric(12,2),
    delivery_fee_status text DEFAULT 'not_required'::text NOT NULL,
    delivery_fee_collection_method text DEFAULT 'none'::text NOT NULL,
    delivery_location_review_required boolean DEFAULT false NOT NULL,
    delivery_location_review_note text,
    delivery_zone_id uuid,
    delivery_zone_matched_by text,
    delivery_fee_confirmed_at timestamp with time zone,
    delivery_fee_confirmed_by uuid,
    delivery_fee_settled_at timestamp with time zone,
    delivery_fee_settled_by uuid,
    delivery_completed_at timestamp with time zone,
    delivery_completed_by uuid,
    CONSTRAINT orders_amounts_nonnegative CHECK (((subtotal >= (0)::numeric) AND (delivery_fee >= (0)::numeric) AND (discount_amount >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND (total_amount >= (0)::numeric))),
    CONSTRAINT orders_customer_email_not_empty CHECK ((length(TRIM(BOTH FROM customer_email)) > 0)),
    CONSTRAINT orders_customer_name_not_empty CHECK ((length(TRIM(BOTH FROM customer_name)) > 0)),
    CONSTRAINT orders_customer_phone_not_empty CHECK ((length(TRIM(BOTH FROM customer_phone)) > 0)),
    CONSTRAINT orders_delivery_address_object CHECK (((delivery_address IS NULL) OR (jsonb_typeof(delivery_address) = 'object'::text))),
    CONSTRAINT orders_delivery_address_valid CHECK (((fulfillment_method <> 'delivery'::public.fulfillment_method) OR (delivery_address IS NOT NULL))),
    CONSTRAINT orders_delivery_completion_metadata_check CHECK ((((delivery_completed_at IS NULL) AND (delivery_completed_by IS NULL)) OR ((fulfillment_method = 'delivery'::public.fulfillment_method) AND (delivery_completed_at IS NOT NULL) AND (delivery_completed_by IS NOT NULL) AND (delivery_fee_status = ANY (ARRAY['included_online'::text, 'settled'::text]))))),
    CONSTRAINT orders_delivery_fee_collection_check CHECK ((delivery_fee_collection_method = ANY (ARRAY['none'::text, 'online'::text, 'manual'::text]))),
    CONSTRAINT orders_delivery_fee_nonnegative CHECK ((delivery_fee >= (0)::numeric)),
    CONSTRAINT orders_delivery_fee_state_consistency CHECK ((((fulfillment_method = 'pickup'::public.fulfillment_method) AND (delivery_fee_status = 'not_required'::text) AND (delivery_fee_collection_method = 'none'::text) AND (delivery_location_review_required = false)) OR ((fulfillment_method = 'delivery'::public.fulfillment_method) AND (((delivery_fee_status = 'included_online'::text) AND (delivery_fee_collection_method = 'online'::text) AND (delivery_location_review_required = false)) OR ((delivery_fee_status = 'pending_review'::text) AND (delivery_fee_collection_method = 'manual'::text) AND (delivery_location_review_required = true)) OR ((delivery_fee_status = ANY (ARRAY['awaiting_manual_payment'::text, 'settled'::text])) AND (delivery_fee_collection_method = 'manual'::text) AND (delivery_location_review_required = false)))))),
    CONSTRAINT orders_delivery_fee_status_check CHECK ((delivery_fee_status = ANY (ARRAY['not_required'::text, 'included_online'::text, 'pending_review'::text, 'awaiting_manual_payment'::text, 'settled'::text]))),
    CONSTRAINT orders_discount_nonnegative CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT orders_initial_online_amount_nonnegative CHECK (((initial_online_amount IS NULL) OR (initial_online_amount >= (0)::numeric))),
    CONSTRAINT orders_manual_delivery_fee_timestamps_check CHECK ((((delivery_fee_status = ANY (ARRAY['not_required'::text, 'included_online'::text, 'pending_review'::text])) AND (delivery_fee_confirmed_at IS NULL) AND (delivery_fee_settled_at IS NULL)) OR ((delivery_fee_status = 'awaiting_manual_payment'::text) AND (delivery_fee_confirmed_at IS NOT NULL) AND (delivery_fee_settled_at IS NULL)) OR ((delivery_fee_status = 'settled'::text) AND (delivery_fee_confirmed_at IS NOT NULL) AND (delivery_fee_settled_at IS NOT NULL)))),
    CONSTRAINT orders_subtotal_nonnegative CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT orders_tax_nonnegative CHECK ((tax_amount >= (0)::numeric)),
    CONSTRAINT orders_total_nonnegative CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: payment_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'paystack'::text NOT NULL,
    event_key text NOT NULL,
    event_type text NOT NULL,
    payment_reference text,
    transaction_id text,
    processing_status text DEFAULT 'received'::text NOT NULL,
    payload_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_webhook_events_processing_status_check CHECK ((processing_status = ANY (ARRAY['received'::text, 'processing'::text, 'processed'::text, 'failed'::text, 'ignored'::text]))),
    CONSTRAINT payment_webhook_events_provider_check CHECK ((provider = 'paystack'::text)),
    CONSTRAINT webhook_processed_timestamp_valid CHECK (((processing_status <> 'processed'::text) OR (processed_at IS NOT NULL)))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    user_id uuid NOT NULL,
    payment_method public.payment_method NOT NULL,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'NGN'::bpchar NOT NULL,
    paystack_reference text,
    paystack_access_code text,
    transfer_reference text,
    receipt_url text,
    verified_at timestamp with time zone,
    provider_response jsonb,
    failure_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auto_confirmed_by_order boolean DEFAULT false NOT NULL,
    reversal_reason text,
    CONSTRAINT payments_amount_positive CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_receipt_url_valid CHECK (((receipt_url IS NULL) OR (length(TRIM(BOTH FROM receipt_url)) > 0))),
    CONSTRAINT payments_successful_requires_verification CHECK (((status <> 'successful'::public.payment_status) OR (verified_at IS NOT NULL)))
);


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    image_url text NOT NULL,
    alt_text text,
    display_order integer DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_images_url_not_empty CHECK ((length(TRIM(BOTH FROM image_url)) > 0))
);


--
-- Name: product_option_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_option_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    option_id uuid NOT NULL,
    value text NOT NULL,
    label text NOT NULL,
    price_adjustment_type text DEFAULT 'none'::text NOT NULL,
    price_adjustment numeric(12,2) DEFAULT 0 NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT option_values_adjustment_nonnegative CHECK ((price_adjustment >= (0)::numeric)),
    CONSTRAINT option_values_adjustment_type_valid CHECK ((price_adjustment_type = ANY (ARRAY['none'::text, 'fixed'::text, 'percentage'::text]))),
    CONSTRAINT option_values_label_not_empty CHECK ((length(TRIM(BOTH FROM label)) > 0)),
    CONSTRAINT option_values_percentage_valid CHECK (((price_adjustment_type <> 'percentage'::text) OR (price_adjustment <= (100)::numeric))),
    CONSTRAINT option_values_value_not_empty CHECK ((length(TRIM(BOTH FROM value)) > 0))
);


--
-- Name: product_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    input_type text DEFAULT 'single_select'::text NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    display_style text DEFAULT 'select'::text NOT NULL,
    minimum_selections integer DEFAULT 0 NOT NULL,
    maximum_selections integer,
    placeholder text,
    help_text text,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_options_display_name_not_empty CHECK ((length(TRIM(BOTH FROM display_name)) > 0)),
    CONSTRAINT product_options_display_style_valid CHECK ((display_style = ANY (ARRAY['select'::text, 'radio'::text, 'checkbox'::text, 'swatches'::text, 'buttons'::text]))),
    CONSTRAINT product_options_input_type_valid CHECK ((input_type = ANY (ARRAY['single_select'::text, 'multi_select'::text, 'text'::text, 'number'::text, 'color'::text, 'date'::text, 'file'::text, 'checkbox'::text]))),
    CONSTRAINT product_options_maximum_selections_valid CHECK (((maximum_selections IS NULL) OR (maximum_selections >= minimum_selections))),
    CONSTRAINT product_options_minimum_selections_valid CHECK ((minimum_selections >= 0)),
    CONSTRAINT product_options_name_not_empty CHECK ((length(TRIM(BOTH FROM name)) > 0))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid,
    sku text,
    name text NOT NULL,
    slug text NOT NULL,
    short_description text,
    description text,
    pricing_type public.product_pricing_type DEFAULT 'fixed'::public.product_pricing_type NOT NULL,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    compare_at_price numeric(12,2),
    currency character(3) DEFAULT 'NGN'::bpchar NOT NULL,
    availability public.product_availability DEFAULT 'made_to_order'::public.product_availability NOT NULL,
    status public.product_status DEFAULT 'draft'::public.product_status NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    is_customizable boolean DEFAULT false NOT NULL,
    stock_quantity integer,
    minimum_order_quantity integer DEFAULT 1 NOT NULL,
    maximum_order_quantity integer,
    preparation_time_days integer,
    display_order integer DEFAULT 0 NOT NULL,
    meta_title text,
    meta_description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_compare_price_nonnegative CHECK (((compare_at_price IS NULL) OR (compare_at_price >= (0)::numeric))),
    CONSTRAINT products_maximum_quantity_valid CHECK (((maximum_order_quantity IS NULL) OR (maximum_order_quantity >= minimum_order_quantity))),
    CONSTRAINT products_minimum_quantity_positive CHECK ((minimum_order_quantity >= 1)),
    CONSTRAINT products_name_not_empty CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT products_preparation_days_nonnegative CHECK (((preparation_time_days IS NULL) OR (preparation_time_days >= 0))),
    CONSTRAINT products_price_nonnegative CHECK ((price >= (0)::numeric)),
    CONSTRAINT products_slug_not_empty CHECK ((length(TRIM(BOTH FROM slug)) > 0)),
    CONSTRAINT products_stock_nonnegative CHECK (((stock_quantity IS NULL) OR (stock_quantity >= 0)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    phone text,
    role public.user_role DEFAULT 'customer'::public.user_role NOT NULL,
    avatar_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_notification_dispatches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_notification_dispatches (
    notification_id uuid NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    sent_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    device_count integer DEFAULT 0 NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone,
    last_attempt_at timestamp with time zone,
    last_error text,
    CONSTRAINT push_notification_dispatches_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'partial'::text, 'retrying'::text, 'failed'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    device_label text,
    user_agent text,
    is_active boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_subscriptions_token_not_empty CHECK ((length(btrim(token)) > 0))
);


--
-- Name: TABLE push_subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.push_subscriptions IS 'Firebase Cloud Messaging browser/device tokens. Each authenticated user can manage only their own tokens; service_role is used for server-side delivery.';


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    rating integer NOT NULL,
    title text,
    comment text,
    status public.review_status DEFAULT 'pending'::public.review_status NOT NULL,
    admin_response text,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_content_required CHECK ((((title IS NOT NULL) AND (length(TRIM(BOTH FROM title)) > 0)) OR ((comment IS NOT NULL) AND (length(TRIM(BOTH FROM comment)) > 0)))),
    CONSTRAINT reviews_rating_range CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: service_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_number text DEFAULT ('SQ-'::text || upper("substring"(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 12))) NOT NULL,
    request_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'NGN'::bpchar NOT NULL,
    status public.quote_status DEFAULT 'draft'::public.quote_status NOT NULL,
    description text,
    terms_and_conditions text,
    customer_message text,
    valid_until timestamp with time zone,
    sent_at timestamp with time zone,
    accepted_at timestamp with time zone,
    rejected_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    converted_order_id uuid,
    converted_at timestamp with time zone,
    CONSTRAINT service_quotes_amount_nonnegative CHECK ((amount >= (0)::numeric)),
    CONSTRAINT service_quotes_validity CHECK (((valid_until IS NULL) OR (valid_until > created_at)))
);


--
-- Name: service_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_number text DEFAULT ('SR-'::text || upper("substring"(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 12))) NOT NULL,
    user_id uuid NOT NULL,
    service_id uuid NOT NULL,
    status public.service_request_status DEFAULT 'pending'::public.service_request_status NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    event_type text,
    event_date date,
    event_time text,
    event_location text,
    guest_count integer,
    budget_min numeric(12,2),
    budget_max numeric(12,2),
    currency character(3) DEFAULT 'NGN'::bpchar NOT NULL,
    requirements text NOT NULL,
    reference_images jsonb DEFAULT '[]'::jsonb NOT NULL,
    additional_notes text,
    internal_notes text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_requests_budget_max_valid CHECK (((budget_max IS NULL) OR (budget_max >= (0)::numeric))),
    CONSTRAINT service_requests_budget_min_valid CHECK (((budget_min IS NULL) OR (budget_min >= (0)::numeric))),
    CONSTRAINT service_requests_budget_range_valid CHECK (((budget_min IS NULL) OR (budget_max IS NULL) OR (budget_max >= budget_min))),
    CONSTRAINT service_requests_customer_email_valid CHECK ((length(TRIM(BOTH FROM customer_email)) > 0)),
    CONSTRAINT service_requests_customer_name_valid CHECK ((length(TRIM(BOTH FROM customer_name)) > 0)),
    CONSTRAINT service_requests_customer_phone_valid CHECK ((length(TRIM(BOTH FROM customer_phone)) > 0)),
    CONSTRAINT service_requests_guest_count_valid CHECK (((guest_count IS NULL) OR (guest_count >= 1))),
    CONSTRAINT service_requests_images_array CHECK ((jsonb_typeof(reference_images) = 'array'::text)),
    CONSTRAINT service_requests_requirements_valid CHECK ((length(TRIM(BOTH FROM requirements)) > 0))
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    short_description text,
    description text,
    image_url text,
    pricing_type public.product_pricing_type DEFAULT 'quote'::public.product_pricing_type NOT NULL,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'NGN'::bpchar NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    preparation_time_days integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT services_name_not_empty CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT services_preparation_days_valid CHECK (((preparation_time_days IS NULL) OR (preparation_time_days >= 0))),
    CONSTRAINT services_price_nonnegative CHECK ((price >= (0)::numeric)),
    CONSTRAINT services_slug_not_empty CHECK ((length(TRIM(BOTH FROM slug)) > 0))
);


--
-- Name: admin_notification_requests admin_notification_requests_pkey; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.admin_notification_requests
    ADD CONSTRAINT admin_notification_requests_pkey PRIMARY KEY (request_id);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: business_settings business_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_settings
    ADD CONSTRAINT business_settings_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: checkout_idempotency checkout_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_idempotency
    ADD CONSTRAINT checkout_idempotency_pkey PRIMARY KEY (id);


--
-- Name: checkout_idempotency checkout_idempotency_unique_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_idempotency
    ADD CONSTRAINT checkout_idempotency_unique_key UNIQUE (user_id, idempotency_key);


--
-- Name: delivery_areas delivery_areas_city_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_areas
    ADD CONSTRAINT delivery_areas_city_name_unique UNIQUE (city_id, name);


--
-- Name: delivery_areas delivery_areas_city_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_areas
    ADD CONSTRAINT delivery_areas_city_slug_unique UNIQUE (city_id, slug);


--
-- Name: delivery_areas delivery_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_areas
    ADD CONSTRAINT delivery_areas_pkey PRIMARY KEY (id);


--
-- Name: delivery_cities delivery_cities_lga_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_cities
    ADD CONSTRAINT delivery_cities_lga_name_unique UNIQUE (lga_id, name);


--
-- Name: delivery_cities delivery_cities_lga_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_cities
    ADD CONSTRAINT delivery_cities_lga_slug_unique UNIQUE (lga_id, slug);


--
-- Name: delivery_cities delivery_cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_cities
    ADD CONSTRAINT delivery_cities_pkey PRIMARY KEY (id);


--
-- Name: delivery_lgas delivery_lgas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_lgas
    ADD CONSTRAINT delivery_lgas_pkey PRIMARY KEY (id);


--
-- Name: delivery_lgas delivery_lgas_state_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_lgas
    ADD CONSTRAINT delivery_lgas_state_name_unique UNIQUE (state_id, name);


--
-- Name: delivery_lgas delivery_lgas_state_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_lgas
    ADD CONSTRAINT delivery_lgas_state_slug_unique UNIQUE (state_id, slug);


--
-- Name: delivery_location_aliases delivery_location_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_location_aliases
    ADD CONSTRAINT delivery_location_aliases_pkey PRIMARY KEY (id);


--
-- Name: delivery_location_nodes delivery_location_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_location_nodes
    ADD CONSTRAINT delivery_location_nodes_pkey PRIMARY KEY (id);


--
-- Name: delivery_states delivery_states_country_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_states
    ADD CONSTRAINT delivery_states_country_name_unique UNIQUE (country_code, name);


--
-- Name: delivery_states delivery_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_states
    ADD CONSTRAINT delivery_states_pkey PRIMARY KEY (id);


--
-- Name: delivery_zone_aliases delivery_zone_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zone_aliases
    ADD CONSTRAINT delivery_zone_aliases_pkey PRIMARY KEY (id);


--
-- Name: delivery_zone_aliases delivery_zone_aliases_zone_alias_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zone_aliases
    ADD CONSTRAINT delivery_zone_aliases_zone_alias_unique UNIQUE (delivery_zone_id, normalized_alias);


--
-- Name: delivery_zones delivery_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_pkey PRIMARY KEY (id);


--
-- Name: favourites favourites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favourites
    ADD CONSTRAINT favourites_pkey PRIMARY KEY (id);


--
-- Name: favourites favourites_unique_product_per_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favourites
    ADD CONSTRAINT favourites_unique_product_per_user UNIQUE (user_id, product_id);


--
-- Name: financial_audit_logs financial_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_audit_logs
    ADD CONSTRAINT financial_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: gallery_images gallery_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_images
    ADD CONSTRAINT gallery_images_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: product_option_values option_values_unique_per_option; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option_values
    ADD CONSTRAINT option_values_unique_per_option UNIQUE (option_id, value);


--
-- Name: order_item_customizations order_item_customizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_customizations
    ADD CONSTRAINT order_item_customizations_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_webhook_events payment_webhook_events_event_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_event_key_key UNIQUE (event_key);


--
-- Name: payment_webhook_events payment_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: payments payments_paystack_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_paystack_reference_key UNIQUE (paystack_reference);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_option_values product_option_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option_values
    ADD CONSTRAINT product_option_values_pkey PRIMARY KEY (id);


--
-- Name: product_options product_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_options
    ADD CONSTRAINT product_options_pkey PRIMARY KEY (id);


--
-- Name: product_options product_options_unique_name_per_product; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_options
    ADD CONSTRAINT product_options_unique_name_per_product UNIQUE (product_id, name);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_notification_dispatches push_notification_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_notification_dispatches
    ADD CONSTRAINT push_notification_dispatches_pkey PRIMARY KEY (notification_id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_token_unique UNIQUE (token);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: service_quotes service_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_pkey PRIMARY KEY (id);


--
-- Name: service_quotes service_quotes_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_quote_number_key UNIQUE (quote_number);


--
-- Name: service_requests service_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_pkey PRIMARY KEY (id);


--
-- Name: service_requests service_requests_request_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_request_number_key UNIQUE (request_number);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: services services_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_slug_key UNIQUE (slug);


--
-- Name: addresses_area_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX addresses_area_id_idx ON public.addresses USING btree (area_id);


--
-- Name: addresses_city_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX addresses_city_id_idx ON public.addresses USING btree (city_id);


--
-- Name: addresses_lga_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX addresses_lga_id_idx ON public.addresses USING btree (lga_id);


--
-- Name: addresses_location_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX addresses_location_node_idx ON public.addresses USING btree (location_node_id);


--
-- Name: addresses_one_default_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX addresses_one_default_per_user ON public.addresses USING btree (user_id) WHERE (is_default = true);


--
-- Name: addresses_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX addresses_user_id_idx ON public.addresses USING btree (user_id);


--
-- Name: cart_items_cart_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cart_items_cart_id_idx ON public.cart_items USING btree (cart_id);


--
-- Name: cart_items_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cart_items_product_id_idx ON public.cart_items USING btree (product_id);


--
-- Name: carts_one_active_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX carts_one_active_per_user ON public.carts USING btree (user_id) WHERE (status = 'active'::text);


--
-- Name: carts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX carts_status_idx ON public.carts USING btree (status);


--
-- Name: carts_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX carts_user_id_idx ON public.carts USING btree (user_id);


--
-- Name: categories_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX categories_active_idx ON public.categories USING btree (is_active);


--
-- Name: categories_display_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX categories_display_order_idx ON public.categories USING btree (display_order);


--
-- Name: categories_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX categories_parent_id_idx ON public.categories USING btree (parent_id);


--
-- Name: delivery_areas_city_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_areas_city_sort_idx ON public.delivery_areas USING btree (city_id, sort_order, name);


--
-- Name: delivery_cities_lga_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_cities_lga_sort_idx ON public.delivery_cities USING btree (lga_id, sort_order, name);


--
-- Name: delivery_lgas_state_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_lgas_state_sort_idx ON public.delivery_lgas USING btree (state_id, sort_order, name);


--
-- Name: delivery_location_aliases_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_location_aliases_node_idx ON public.delivery_location_aliases USING btree (location_node_id);


--
-- Name: delivery_location_aliases_normalized_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_location_aliases_normalized_idx ON public.delivery_location_aliases USING btree (normalized_alias);


--
-- Name: delivery_location_aliases_unique_per_node_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX delivery_location_aliases_unique_per_node_uidx ON public.delivery_location_aliases USING btree (location_node_id, normalized_alias);


--
-- Name: delivery_location_nodes_name_per_parent_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX delivery_location_nodes_name_per_parent_uidx ON public.delivery_location_nodes USING btree (settlement_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));


--
-- Name: delivery_location_nodes_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_location_nodes_parent_idx ON public.delivery_location_nodes USING btree (parent_id);


--
-- Name: delivery_location_nodes_settlement_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_location_nodes_settlement_idx ON public.delivery_location_nodes USING btree (settlement_id);


--
-- Name: delivery_location_nodes_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_location_nodes_type_idx ON public.delivery_location_nodes USING btree (place_type);


--
-- Name: delivery_states_country_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX delivery_states_country_code_unique ON public.delivery_states USING btree (country_code, code) WHERE (code IS NOT NULL);


--
-- Name: delivery_zone_aliases_normalized_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_zone_aliases_normalized_idx ON public.delivery_zone_aliases USING btree (normalized_alias) WHERE (is_active = true);


--
-- Name: delivery_zones_area_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_zones_area_id_idx ON public.delivery_zones USING btree (area_id);


--
-- Name: delivery_zones_city_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_zones_city_id_idx ON public.delivery_zones USING btree (city_id);


--
-- Name: delivery_zones_lga_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_zones_lga_id_idx ON public.delivery_zones USING btree (lga_id);


--
-- Name: delivery_zones_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_zones_location_idx ON public.delivery_zones USING btree (lower(TRIM(BOTH FROM state)), lower(TRIM(BOTH FROM city)));


--
-- Name: delivery_zones_location_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_zones_location_node_idx ON public.delivery_zones USING btree (location_node_id);


--
-- Name: delivery_zones_state_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_zones_state_id_idx ON public.delivery_zones USING btree (state_id);


--
-- Name: delivery_zones_unique_hierarchy_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX delivery_zones_unique_hierarchy_scope_idx ON public.delivery_zones USING btree (COALESCE(('node:'::text || (location_node_id)::text), ('area:'::text || (area_id)::text), ('city:'::text || (city_id)::text), ('lga:'::text || (lga_id)::text), ('state:'::text || (state_id)::text), ((((('legacy:'::text || lower(btrim(state))) || ':'::text) || lower(btrim(city))) || ':'::text) || COALESCE(lower(btrim(area)), ''::text))));


--
-- Name: favourites_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX favourites_product_id_idx ON public.favourites USING btree (product_id);


--
-- Name: favourites_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX favourites_user_id_idx ON public.favourites USING btree (user_id);


--
-- Name: idx_checkout_idempotency_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_idempotency_created ON public.checkout_idempotency USING btree (created_at DESC);


--
-- Name: idx_checkout_idempotency_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_idempotency_status ON public.checkout_idempotency USING btree (status);


--
-- Name: idx_checkout_idempotency_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkout_idempotency_user ON public.checkout_idempotency USING btree (user_id);


--
-- Name: idx_financial_audit_changed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_audit_changed_by ON public.financial_audit_logs USING btree (changed_by);


--
-- Name: idx_financial_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_audit_created ON public.financial_audit_logs USING btree (created_at DESC);


--
-- Name: idx_financial_audit_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_audit_record ON public.financial_audit_logs USING btree (record_type, record_id);


--
-- Name: idx_gallery_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gallery_display_order ON public.gallery_images USING btree (display_order);


--
-- Name: idx_gallery_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gallery_featured ON public.gallery_images USING btree (is_featured);


--
-- Name: idx_gallery_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gallery_published ON public.gallery_images USING btree (is_published);


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_order_items_unique_service_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_order_items_unique_service_quote ON public.order_items USING btree (service_quote_id) WHERE (service_quote_id IS NOT NULL);


--
-- Name: idx_order_status_history_changed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_status_history_changed_by ON public.order_status_history USING btree (changed_by);


--
-- Name: idx_order_status_history_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_status_history_created ON public.order_status_history USING btree (created_at DESC);


--
-- Name: idx_order_status_history_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_status_history_order ON public.order_status_history USING btree (order_id);


--
-- Name: idx_payment_webhook_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_webhook_received ON public.payment_webhook_events USING btree (received_at DESC);


--
-- Name: idx_payment_webhook_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_webhook_reference ON public.payment_webhook_events USING btree (payment_reference);


--
-- Name: idx_payment_webhook_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_webhook_status ON public.payment_webhook_events USING btree (processing_status);


--
-- Name: idx_payment_webhook_transaction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_webhook_transaction ON public.payment_webhook_events USING btree (transaction_id);


--
-- Name: idx_push_subscriptions_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subscriptions_user_active ON public.push_subscriptions USING btree (user_id, is_active);


--
-- Name: idx_reviews_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_created ON public.reviews USING btree (created_at DESC);


--
-- Name: idx_reviews_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_order ON public.reviews USING btree (order_id);


--
-- Name: idx_reviews_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_product ON public.reviews USING btree (product_id);


--
-- Name: idx_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_status ON public.reviews USING btree (status);


--
-- Name: idx_reviews_unique_order_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_reviews_unique_order_product ON public.reviews USING btree (user_id, order_id, product_id) NULLS NOT DISTINCT;


--
-- Name: idx_reviews_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_user ON public.reviews USING btree (user_id);


--
-- Name: idx_service_quotes_converted_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_quotes_converted_order ON public.service_quotes USING btree (converted_order_id);


--
-- Name: order_item_customizations_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_item_customizations_item_id_idx ON public.order_item_customizations USING btree (order_item_id);


--
-- Name: order_items_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_order_id_idx ON public.order_items USING btree (order_id);


--
-- Name: order_items_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_product_id_idx ON public.order_items USING btree (product_id);


--
-- Name: orders_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_created_at_idx ON public.orders USING btree (created_at DESC);


--
-- Name: orders_delivery_completed_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_delivery_completed_by_idx ON public.orders USING btree (delivery_completed_by);


--
-- Name: orders_delivery_fee_confirmed_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_delivery_fee_confirmed_by_idx ON public.orders USING btree (delivery_fee_confirmed_by);


--
-- Name: orders_delivery_fee_settled_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_delivery_fee_settled_by_idx ON public.orders USING btree (delivery_fee_settled_by);


--
-- Name: orders_delivery_fee_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_delivery_fee_status_idx ON public.orders USING btree (delivery_fee_status, created_at DESC) WHERE (fulfillment_method = 'delivery'::public.fulfillment_method);


--
-- Name: orders_delivery_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_delivery_review_idx ON public.orders USING btree (delivery_location_review_required, created_at DESC) WHERE (fulfillment_method = 'delivery'::public.fulfillment_method);


--
-- Name: orders_delivery_zone_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_delivery_zone_id_idx ON public.orders USING btree (delivery_zone_id);


--
-- Name: orders_order_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_order_number_idx ON public.orders USING btree (order_number);


--
-- Name: orders_requested_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_requested_date_idx ON public.orders USING btree (requested_date);


--
-- Name: orders_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_status_idx ON public.orders USING btree (status);


--
-- Name: orders_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_user_id_idx ON public.orders USING btree (user_id);


--
-- Name: payments_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_created_at_idx ON public.payments USING btree (created_at DESC);


--
-- Name: payments_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_order_id_idx ON public.payments USING btree (order_id);


--
-- Name: payments_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_status_idx ON public.payments USING btree (status);


--
-- Name: payments_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_user_id_idx ON public.payments USING btree (user_id);


--
-- Name: product_images_display_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_images_display_order_idx ON public.product_images USING btree (display_order);


--
-- Name: product_images_one_primary_per_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_images_one_primary_per_product ON public.product_images USING btree (product_id) WHERE (is_primary = true);


--
-- Name: product_images_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_images_product_id_idx ON public.product_images USING btree (product_id);


--
-- Name: product_option_values_display_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_option_values_display_order_idx ON public.product_option_values USING btree (display_order);


--
-- Name: product_option_values_option_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_option_values_option_id_idx ON public.product_option_values USING btree (option_id);


--
-- Name: product_options_display_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_options_display_order_idx ON public.product_options USING btree (display_order);


--
-- Name: product_options_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_options_product_id_idx ON public.product_options USING btree (product_id);


--
-- Name: products_availability_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_availability_idx ON public.products USING btree (availability);


--
-- Name: products_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_category_id_idx ON public.products USING btree (category_id);


--
-- Name: products_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_created_at_idx ON public.products USING btree (created_at DESC);


--
-- Name: products_display_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_display_order_idx ON public.products USING btree (display_order);


--
-- Name: products_featured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_featured_idx ON public.products USING btree (is_featured);


--
-- Name: products_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_status_idx ON public.products USING btree (status);


--
-- Name: profiles_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_email_unique ON public.profiles USING btree (lower(email)) WHERE (email IS NOT NULL);


--
-- Name: profiles_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_role_idx ON public.profiles USING btree (role);


--
-- Name: push_notification_dispatches_retry_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_notification_dispatches_retry_due_idx ON public.push_notification_dispatches USING btree (next_attempt_at, started_at) WHERE (status = 'retrying'::text);


--
-- Name: push_notification_dispatches_stale_processing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_notification_dispatches_stale_processing_idx ON public.push_notification_dispatches USING btree (started_at) WHERE (status = 'processing'::text);


--
-- Name: service_quotes_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_quotes_created_at_idx ON public.service_quotes USING btree (created_at DESC);


--
-- Name: service_quotes_request_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_quotes_request_id_idx ON public.service_quotes USING btree (request_id);


--
-- Name: service_quotes_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_quotes_status_idx ON public.service_quotes USING btree (status);


--
-- Name: service_requests_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_requests_created_at_idx ON public.service_requests USING btree (created_at DESC);


--
-- Name: service_requests_event_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_requests_event_date_idx ON public.service_requests USING btree (event_date);


--
-- Name: service_requests_service_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_requests_service_id_idx ON public.service_requests USING btree (service_id);


--
-- Name: service_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_requests_status_idx ON public.service_requests USING btree (status);


--
-- Name: service_requests_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_requests_user_id_idx ON public.service_requests USING btree (user_id);


--
-- Name: services_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_active_idx ON public.services USING btree (is_active);


--
-- Name: services_display_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_display_order_idx ON public.services USING btree (display_order);


--
-- Name: services_featured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_featured_idx ON public.services USING btree (is_featured);


--
-- Name: addresses manage_customer_default_address; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER manage_customer_default_address BEFORE INSERT OR UPDATE OF is_default ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.manage_default_address();


--
-- Name: profiles notify_new_customer_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_new_customer_trigger AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_new_customer();


--
-- Name: orders notify_order_created_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_order_created_trigger AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_created();


--
-- Name: orders notify_order_status_changed_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_order_status_changed_trigger AFTER UPDATE OF status ON public.orders FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.notify_order_status_changed();


--
-- Name: payments notify_payment_status_changed_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_payment_status_changed_trigger AFTER UPDATE OF status ON public.payments FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.notify_payment_status_changed();


--
-- Name: service_requests notify_service_request_status_changed_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_service_request_status_changed_trigger AFTER UPDATE OF status ON public.service_requests FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.notify_service_request_status_changed();


--
-- Name: orders record_order_status_history_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER record_order_status_history_trigger AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.record_order_status_history();


--
-- Name: payments record_payment_financial_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER record_payment_financial_audit AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.record_financial_audit();


--
-- Name: service_quotes record_service_quote_financial_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER record_service_quote_financial_audit AFTER INSERT OR DELETE OR UPDATE ON public.service_quotes FOR EACH ROW EXECUTE FUNCTION public.record_financial_audit();


--
-- Name: addresses set_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: business_settings set_business_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_business_settings_updated_at BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cart_items set_cart_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: carts set_carts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_carts_updated_at BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: categories set_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: checkout_idempotency set_checkout_idempotency_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_checkout_idempotency_updated_at BEFORE UPDATE ON public.checkout_idempotency FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: delivery_areas set_delivery_areas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_delivery_areas_updated_at BEFORE UPDATE ON public.delivery_areas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: delivery_cities set_delivery_cities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_delivery_cities_updated_at BEFORE UPDATE ON public.delivery_cities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: delivery_lgas set_delivery_lgas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_delivery_lgas_updated_at BEFORE UPDATE ON public.delivery_lgas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: delivery_states set_delivery_states_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_delivery_states_updated_at BEFORE UPDATE ON public.delivery_states FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: delivery_zones set_delivery_zones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_delivery_zones_updated_at BEFORE UPDATE ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: gallery_images set_gallery_images_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_gallery_images_updated_at BEFORE UPDATE ON public.gallery_images FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: orders set_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payments set_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: product_option_values set_product_option_values_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_product_option_values_updated_at BEFORE UPDATE ON public.product_option_values FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: product_options set_product_options_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_product_options_updated_at BEFORE UPDATE ON public.product_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: products set_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reviews set_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: service_quotes set_service_quotes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_service_quotes_updated_at BEFORE UPDATE ON public.service_quotes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: service_requests set_service_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_service_requests_updated_at BEFORE UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: services set_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: delivery_zones sync_delivery_zone_location_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_delivery_zone_location_before_write BEFORE INSERT OR UPDATE OF state_id, lga_id, city_id, area_id, location_node_id ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_zone_location();


--
-- Name: orders sync_payment_when_order_confirmed_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_payment_when_order_confirmed_trigger AFTER UPDATE OF status ON public.orders FOR EACH ROW WHEN (((old.status IS DISTINCT FROM new.status) AND ((new.status = 'payment_confirmed'::public.order_status) OR ((old.status = 'payment_confirmed'::public.order_status) AND (new.status = 'awaiting_payment'::public.order_status))))) EXECUTE FUNCTION public.sync_payment_when_order_confirmed();


--
-- Name: notifications trg_dispatch_notification_push; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dispatch_notification_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.dispatch_notification_push_after_insert();


--
-- Name: delivery_location_nodes validate_delivery_location_node_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_delivery_location_node_trigger BEFORE INSERT OR UPDATE ON public.delivery_location_nodes FOR EACH ROW EXECUTE FUNCTION public.validate_delivery_location_node();


--
-- Name: order_items validate_order_item_relationship_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_order_item_relationship_trigger BEFORE INSERT OR UPDATE OF order_id, product_id, item_type, service_id, service_quote_id ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.validate_order_item_relationship();


--
-- Name: payments validate_payment_ownership_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_payment_ownership_trigger BEFORE INSERT OR UPDATE OF order_id, user_id ON public.payments FOR EACH ROW EXECUTE FUNCTION public.validate_payment_ownership();


--
-- Name: admin_notification_requests admin_notification_requests_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.admin_notification_requests
    ADD CONSTRAINT admin_notification_requests_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: addresses addresses_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.delivery_areas(id) ON DELETE SET NULL;


--
-- Name: addresses addresses_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.delivery_cities(id) ON DELETE SET NULL;


--
-- Name: addresses addresses_lga_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_lga_id_fkey FOREIGN KEY (lga_id) REFERENCES public.delivery_lgas(id) ON DELETE SET NULL;


--
-- Name: addresses addresses_location_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_location_node_id_fkey FOREIGN KEY (location_node_id) REFERENCES public.delivery_location_nodes(id) ON DELETE SET NULL;


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: business_settings business_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_settings
    ADD CONSTRAINT business_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: checkout_idempotency checkout_idempotency_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_idempotency
    ADD CONSTRAINT checkout_idempotency_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: checkout_idempotency checkout_idempotency_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_idempotency
    ADD CONSTRAINT checkout_idempotency_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: delivery_areas delivery_areas_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_areas
    ADD CONSTRAINT delivery_areas_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.delivery_cities(id) ON DELETE RESTRICT;


--
-- Name: delivery_cities delivery_cities_lga_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_cities
    ADD CONSTRAINT delivery_cities_lga_id_fkey FOREIGN KEY (lga_id) REFERENCES public.delivery_lgas(id) ON DELETE RESTRICT;


--
-- Name: delivery_lgas delivery_lgas_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_lgas
    ADD CONSTRAINT delivery_lgas_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.delivery_states(id) ON DELETE RESTRICT;


--
-- Name: delivery_location_aliases delivery_location_aliases_location_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_location_aliases
    ADD CONSTRAINT delivery_location_aliases_location_node_id_fkey FOREIGN KEY (location_node_id) REFERENCES public.delivery_location_nodes(id) ON DELETE CASCADE;


--
-- Name: delivery_location_nodes delivery_location_nodes_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_location_nodes
    ADD CONSTRAINT delivery_location_nodes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.delivery_location_nodes(id) ON DELETE CASCADE;


--
-- Name: delivery_location_nodes delivery_location_nodes_settlement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_location_nodes
    ADD CONSTRAINT delivery_location_nodes_settlement_id_fkey FOREIGN KEY (settlement_id) REFERENCES public.delivery_cities(id) ON DELETE CASCADE;


--
-- Name: delivery_zone_aliases delivery_zone_aliases_delivery_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zone_aliases
    ADD CONSTRAINT delivery_zone_aliases_delivery_zone_id_fkey FOREIGN KEY (delivery_zone_id) REFERENCES public.delivery_zones(id) ON DELETE CASCADE;


--
-- Name: delivery_zones delivery_zones_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.delivery_areas(id) ON DELETE SET NULL;


--
-- Name: delivery_zones delivery_zones_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.delivery_cities(id) ON DELETE SET NULL;


--
-- Name: delivery_zones delivery_zones_lga_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_lga_id_fkey FOREIGN KEY (lga_id) REFERENCES public.delivery_lgas(id) ON DELETE SET NULL;


--
-- Name: delivery_zones delivery_zones_location_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_location_node_id_fkey FOREIGN KEY (location_node_id) REFERENCES public.delivery_location_nodes(id) ON DELETE SET NULL;


--
-- Name: delivery_zones delivery_zones_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.delivery_states(id) ON DELETE SET NULL;


--
-- Name: favourites favourites_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favourites
    ADD CONSTRAINT favourites_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: favourites favourites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favourites
    ADD CONSTRAINT favourites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: financial_audit_logs financial_audit_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_audit_logs
    ADD CONSTRAINT financial_audit_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_related_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_related_order_id_fkey FOREIGN KEY (related_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_related_service_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_related_service_request_id_fkey FOREIGN KEY (related_service_request_id) REFERENCES public.service_requests(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: order_item_customizations order_item_customizations_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_customizations
    ADD CONSTRAINT order_item_customizations_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_service_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_service_quote_id_fkey FOREIGN KEY (service_quote_id) REFERENCES public.service_quotes(id) ON DELETE SET NULL;


--
-- Name: order_status_history order_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_delivery_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivery_completed_by_fkey FOREIGN KEY (delivery_completed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: orders orders_delivery_fee_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivery_fee_confirmed_by_fkey FOREIGN KEY (delivery_fee_confirmed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: orders orders_delivery_fee_settled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivery_fee_settled_by_fkey FOREIGN KEY (delivery_fee_settled_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: orders orders_delivery_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivery_zone_id_fkey FOREIGN KEY (delivery_zone_id) REFERENCES public.delivery_zones(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_option_values product_option_values_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option_values
    ADD CONSTRAINT product_option_values_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.product_options(id) ON DELETE CASCADE;


--
-- Name: product_options product_options_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_options
    ADD CONSTRAINT product_options_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_notification_dispatches push_notification_dispatches_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_notification_dispatches
    ADD CONSTRAINT push_notification_dispatches_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: reviews reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- Name: service_quotes service_quotes_converted_order_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_converted_order_fkey FOREIGN KEY (converted_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: service_quotes service_quotes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: service_quotes service_quotes_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_quotes
    ADD CONSTRAINT service_quotes_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE RESTRICT;


--
-- Name: service_requests service_requests_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;


--
-- Name: service_requests service_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;


--
-- Name: admin_notification_requests; Type: ROW SECURITY; Schema: private; Owner: -
--

ALTER TABLE private.admin_notification_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_lgas Active LGAs are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active LGAs are publicly readable" ON public.delivery_lgas FOR SELECT TO authenticated, anon USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM public.delivery_states s
  WHERE ((s.id = delivery_lgas.state_id) AND (s.is_active = true))))));


--
-- Name: delivery_areas Active areas are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active areas are publicly readable" ON public.delivery_areas FOR SELECT TO authenticated, anon USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM ((public.delivery_cities c
     JOIN public.delivery_lgas l ON ((l.id = c.lga_id)))
     JOIN public.delivery_states s ON ((s.id = l.state_id)))
  WHERE ((c.id = delivery_areas.city_id) AND (c.is_active = true) AND (l.is_active = true) AND (s.is_active = true))))));


--
-- Name: delivery_cities Active cities are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active cities are publicly readable" ON public.delivery_cities FOR SELECT TO authenticated, anon USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM (public.delivery_lgas l
     JOIN public.delivery_states s ON ((s.id = l.state_id)))
  WHERE ((l.id = delivery_cities.lga_id) AND (l.is_active = true) AND (s.is_active = true))))));


--
-- Name: delivery_location_aliases Active location aliases are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active location aliases are publicly readable" ON public.delivery_location_aliases FOR SELECT TO authenticated, anon USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM public.delivery_location_nodes n
  WHERE ((n.id = delivery_location_aliases.location_node_id) AND (n.is_active = true))))));


--
-- Name: delivery_location_nodes Active location nodes are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active location nodes are publicly readable" ON public.delivery_location_nodes FOR SELECT TO authenticated, anon USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM ((public.delivery_cities c
     JOIN public.delivery_lgas l ON ((l.id = c.lga_id)))
     JOIN public.delivery_states s ON ((s.id = l.state_id)))
  WHERE ((c.id = delivery_location_nodes.settlement_id) AND (c.is_active = true) AND (l.is_active = true) AND (s.is_active = true))))));


--
-- Name: delivery_states Active locations are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Active locations are publicly readable" ON public.delivery_states FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- Name: notifications Admins can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: delivery_zones Admins can delete delivery zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete delivery zones" ON public.delivery_zones FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: delivery_zones Admins can insert delivery zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert delivery zones" ON public.delivery_zones FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: categories Admins can manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage categories" ON public.categories TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: gallery_images Admins can manage gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage gallery" ON public.gallery_images TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: product_option_values Admins can manage option values; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage option values" ON public.product_option_values TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: product_images Admins can manage product images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage product images" ON public.product_images TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: product_options Admins can manage product options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage product options" ON public.product_options TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: products Admins can manage products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage products" ON public.products TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: reviews Admins can manage reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage reviews" ON public.reviews TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: service_quotes Admins can manage service quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage service quotes" ON public.service_quotes TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: services Admins can manage services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage services" ON public.services TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: business_settings Admins can update business settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update business settings" ON public.business_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: profiles Admins can update customer profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update customer profiles" ON public.profiles FOR UPDATE TO authenticated USING ((public.is_admin() AND (role = 'customer'::public.user_role))) WITH CHECK ((public.is_admin() AND (role = 'customer'::public.user_role)));


--
-- Name: delivery_zones Admins can update delivery zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update delivery zones" ON public.delivery_zones FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: orders Admins can update orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: payments Admins can update payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update payments" ON public.payments FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: service_requests Admins can update service requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update service requests" ON public.service_requests FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: profiles Admins can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) AND (role = 'admin'::public.user_role) AND (is_active = true))) WITH CHECK (((id = ( SELECT auth.uid() AS uid)) AND (role = 'admin'::public.user_role) AND (is_active = true)));


--
-- Name: addresses Admins can view all addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all addresses" ON public.addresses FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: cart_items Admins can view all cart items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all cart items" ON public.cart_items FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: carts Admins can view all carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all carts" ON public.carts FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: delivery_zones Admins can view all delivery zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all delivery zones" ON public.delivery_zones FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: order_item_customizations Admins can view all item customizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all item customizations" ON public.order_item_customizations FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: notifications Admins can view all notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all notifications" ON public.notifications FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: order_items Admins can view all order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all order items" ON public.order_items FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: order_status_history Admins can view all order status history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all order status history" ON public.order_status_history FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: orders Admins can view all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: payments Admins can view all payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: service_requests Admins can view all service requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all service requests" ON public.service_requests FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: financial_audit_logs Admins can view financial audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view financial audit logs" ON public.financial_audit_logs FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: delivery_lgas Admins manage delivery LGAs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage delivery LGAs" ON public.delivery_lgas TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: delivery_areas Admins manage delivery areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage delivery areas" ON public.delivery_areas TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: delivery_cities Admins manage delivery cities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage delivery cities" ON public.delivery_cities TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: delivery_location_aliases Admins manage delivery location aliases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage delivery location aliases" ON public.delivery_location_aliases TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: delivery_location_nodes Admins manage delivery location nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage delivery location nodes" ON public.delivery_location_nodes TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: delivery_states Admins manage delivery states; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage delivery states" ON public.delivery_states TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: delivery_zone_aliases Admins manage delivery zone aliases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage delivery zone aliases" ON public.delivery_zone_aliases TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: categories Anyone can view active categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active categories" ON public.categories FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- Name: delivery_zones Anyone can view active delivery zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active delivery zones" ON public.delivery_zones FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- Name: products Anyone can view active products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT TO authenticated, anon USING ((status = 'active'::public.product_status));


--
-- Name: services Anyone can view active services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active services" ON public.services FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- Name: product_option_values Anyone can view available product option values; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view available product option values" ON public.product_option_values FOR SELECT TO authenticated, anon USING (((is_available = true) AND (EXISTS ( SELECT 1
   FROM (public.product_options
     JOIN public.products ON ((products.id = product_options.product_id)))
  WHERE ((product_options.id = product_option_values.option_id) AND (product_options.is_active = true) AND (products.status = 'active'::public.product_status))))));


--
-- Name: product_images Anyone can view images of active products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view images of active products" ON public.product_images FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.products
  WHERE ((products.id = product_images.product_id) AND (products.status = 'active'::public.product_status)))));


--
-- Name: product_options Anyone can view options of active products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view options of active products" ON public.product_options FOR SELECT TO authenticated, anon USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM public.products
  WHERE ((products.id = product_options.product_id) AND (products.status = 'active'::public.product_status))))));


--
-- Name: cart_items Customers can add items to their own carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can add items to their own carts" ON public.cart_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.carts
  WHERE ((carts.id = cart_items.cart_id) AND (carts.user_id = ( SELECT auth.uid() AS uid)) AND (carts.status = 'active'::text)))));


--
-- Name: addresses Customers can add their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can add their own addresses" ON public.addresses FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: favourites Customers can add their own favourites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can add their own favourites" ON public.favourites FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: carts Customers can create their own carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create their own carts" ON public.carts FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: addresses Customers can delete their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can delete their own addresses" ON public.addresses FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: cart_items Customers can delete their own cart items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can delete their own cart items" ON public.cart_items FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.carts
  WHERE ((carts.id = cart_items.cart_id) AND (carts.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: carts Customers can delete their own carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can delete their own carts" ON public.carts FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: push_subscriptions Customers can register their own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can register their own push subscriptions" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: favourites Customers can remove their own favourites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can remove their own favourites" ON public.favourites FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: push_subscriptions Customers can remove their own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can remove their own push subscriptions" ON public.push_subscriptions FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: reviews Customers can submit reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can submit reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::public.review_status) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = reviews.order_id) AND (o.user_id = ( SELECT auth.uid() AS uid)) AND (o.status = 'completed'::public.order_status)))) AND ((product_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.order_items oi
  WHERE ((oi.order_id = reviews.order_id) AND (oi.product_id = reviews.product_id)))))));


--
-- Name: service_requests Customers can submit their own service requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can submit their own service requests" ON public.service_requests FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::public.service_request_status) AND (EXISTS ( SELECT 1
   FROM public.services
  WHERE ((services.id = service_requests.service_id) AND (services.is_active = true))))));


--
-- Name: notifications Customers can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: addresses Customers can update their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update their own addresses" ON public.addresses FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: cart_items Customers can update their own cart items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update their own cart items" ON public.cart_items FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.carts
  WHERE ((carts.id = cart_items.cart_id) AND (carts.user_id = ( SELECT auth.uid() AS uid)) AND (carts.status = 'active'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.carts
  WHERE ((carts.id = cart_items.cart_id) AND (carts.user_id = ( SELECT auth.uid() AS uid)) AND (carts.status = 'active'::text)))));


--
-- Name: carts Customers can update their own carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update their own carts" ON public.carts FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles Customers can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: push_subscriptions Customers can update their own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update their own push subscriptions" ON public.push_subscriptions FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: notifications Customers can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own notifications" ON public.notifications FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: order_status_history Customers can view own order status history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own order status history" ON public.order_status_history FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_status_history.order_id) AND (o.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: reviews Customers can view own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own reviews" ON public.reviews FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: addresses Customers can view their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own addresses" ON public.addresses FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: cart_items Customers can view their own cart items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own cart items" ON public.cart_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.carts
  WHERE ((carts.id = cart_items.cart_id) AND (carts.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: carts Customers can view their own carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own carts" ON public.carts FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: favourites Customers can view their own favourites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own favourites" ON public.favourites FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: order_item_customizations Customers can view their own order customizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own order customizations" ON public.order_item_customizations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.order_items
     JOIN public.orders ON ((orders.id = order_items.order_id)))
  WHERE ((order_items.id = order_item_customizations.order_item_id) AND (orders.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: order_items Customers can view their own order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: orders Customers can view their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own orders" ON public.orders FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: payments Customers can view their own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own payments" ON public.payments FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles Customers can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: push_subscriptions Customers can view their own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own push subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: service_quotes Customers can view their own service quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own service quotes" ON public.service_quotes FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.service_requests
  WHERE ((service_requests.id = service_quotes.request_id) AND (service_requests.user_id = ( SELECT auth.uid() AS uid))))) AND (status <> 'draft'::public.quote_status)));


--
-- Name: service_requests Customers can view their own service requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own service requests" ON public.service_requests FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: reviews Public can view approved reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view approved reviews" ON public.reviews FOR SELECT TO authenticated, anon USING ((status = 'approved'::public.review_status));


--
-- Name: business_settings Public can view business settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view business settings" ON public.business_settings FOR SELECT TO authenticated, anon USING ((id = 1));


--
-- Name: gallery_images Public can view published gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view published gallery" ON public.gallery_images FOR SELECT TO authenticated, anon USING ((is_published = true));


--
-- Name: addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: business_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: cart_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

--
-- Name: carts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: checkout_idempotency; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkout_idempotency ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_areas ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_cities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_cities ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_lgas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_lgas ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_location_aliases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_location_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_location_nodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_location_nodes ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_states ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_zone_aliases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_zone_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: favourites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: gallery_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: order_item_customizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_item_customizations ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_status_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: product_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

--
-- Name: product_option_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;

--
-- Name: product_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: push_notification_dispatches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_notification_dispatches ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: service_quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: service_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION admin_confirm_manual_delivery_fee(p_order_id uuid, p_delivery_fee numeric, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_confirm_manual_delivery_fee(p_order_id uuid, p_delivery_fee numeric, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_confirm_manual_delivery_fee(p_order_id uuid, p_delivery_fee numeric, p_note text) TO authenticated;


--
-- Name: FUNCTION admin_get_push_dispatch_monitor(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_get_push_dispatch_monitor() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_get_push_dispatch_monitor() TO authenticated;


--
-- Name: FUNCTION admin_mark_delivery_completed(p_order_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_mark_delivery_completed(p_order_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_mark_delivery_completed(p_order_id uuid) TO authenticated;


--
-- Name: FUNCTION admin_mark_delivery_fee_settled(p_order_id uuid, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_mark_delivery_fee_settled(p_order_id uuid, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_mark_delivery_fee_settled(p_order_id uuid, p_note text) TO authenticated;


--
-- Name: FUNCTION admin_reopen_payment(p_payment_id uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_reopen_payment(p_payment_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_reopen_payment(p_payment_id uuid, p_reason text) TO authenticated;


--
-- Name: FUNCTION admin_review_bank_transfer(p_payment_id uuid, p_approve boolean, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_review_bank_transfer(p_payment_id uuid, p_approve boolean, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_review_bank_transfer(p_payment_id uuid, p_approve boolean, p_reason text) TO authenticated;


--
-- Name: FUNCTION admin_send_broadcast_notification(p_title text, p_message text, p_type public.notification_type, p_action_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_send_broadcast_notification(p_title text, p_message text, p_type public.notification_type, p_action_url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_send_broadcast_notification(p_title text, p_message text, p_type public.notification_type, p_action_url text) TO authenticated;


--
-- Name: FUNCTION admin_send_notification(p_user_id uuid, p_title text, p_message text, p_type public.notification_type, p_action_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_send_notification(p_user_id uuid, p_title text, p_message text, p_type public.notification_type, p_action_url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_send_notification(p_user_id uuid, p_title text, p_message text, p_type public.notification_type, p_action_url text) TO authenticated;


--
-- Name: FUNCTION admin_send_notification_idempotent(p_request_id uuid, p_user_id uuid, p_title text, p_message text, p_type public.notification_type, p_action_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_send_notification_idempotent(p_request_id uuid, p_user_id uuid, p_title text, p_message text, p_type public.notification_type, p_action_url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_send_notification_idempotent(p_request_id uuid, p_user_id uuid, p_title text, p_message text, p_type public.notification_type, p_action_url text) TO authenticated;


--
-- Name: FUNCTION checkout_create_order(p_fulfillment_method public.fulfillment_method, p_delivery_address jsonb, p_requested_date date, p_requested_time text, p_customer_notes text, p_receipt_path text, p_transfer_reference text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.checkout_create_order(p_fulfillment_method public.fulfillment_method, p_delivery_address jsonb, p_requested_date date, p_requested_time text, p_customer_notes text, p_receipt_path text, p_transfer_reference text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.checkout_create_order(p_fulfillment_method public.fulfillment_method, p_delivery_address jsonb, p_requested_date date, p_requested_time text, p_customer_notes text, p_receipt_path text, p_transfer_reference text) TO authenticated;


--
-- Name: FUNCTION claim_notification_push_dispatch(p_notification_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_notification_push_dispatch(p_notification_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_notification_push_dispatch(p_notification_id uuid) TO service_role;


--
-- Name: FUNCTION complete_notification_push_dispatch(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_notification_push_dispatch(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_notification_push_dispatch(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer) TO service_role;


--
-- Name: FUNCTION create_notification(p_user_id uuid, p_type public.notification_type, p_title text, p_message text, p_action_url text, p_order_id uuid, p_service_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_notification(p_user_id uuid, p_type public.notification_type, p_title text, p_message text, p_action_url text, p_order_id uuid, p_service_request_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION dispatch_notification_push_after_insert(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dispatch_notification_push_after_insert() FROM PUBLIC;


--
-- Name: FUNCTION enqueue_due_notification_push_retries(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enqueue_due_notification_push_retries() FROM PUBLIC;


--
-- Name: FUNCTION get_delivery_fee(p_state text, p_city text, p_area text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_delivery_fee(p_state text, p_city text, p_area text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_delivery_fee(p_state text, p_city text, p_area text) TO authenticated;


--
-- Name: FUNCTION get_delivery_fee(p_state_id uuid, p_lga_id uuid, p_city_id uuid, p_area_id uuid, p_location_node_id uuid, p_is_custom_location boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_delivery_fee(p_state_id uuid, p_lga_id uuid, p_city_id uuid, p_area_id uuid, p_location_node_id uuid, p_is_custom_location boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_delivery_fee(p_state_id uuid, p_lga_id uuid, p_city_id uuid, p_area_id uuid, p_location_node_id uuid, p_is_custom_location boolean) TO authenticated;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;


--
-- Name: FUNCTION manage_default_address(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.manage_default_address() FROM PUBLIC;


--
-- Name: FUNCTION mark_all_notifications_read(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_all_notifications_read() TO authenticated;


--
-- Name: FUNCTION mark_notification_push_dispatch_partial(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer, p_error text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_notification_push_dispatch_partial(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer, p_error text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_notification_push_dispatch_partial(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer, p_error text) TO service_role;


--
-- Name: FUNCTION mark_notification_read(p_notification_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_notification_read(p_notification_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_notification_read(p_notification_id uuid) TO authenticated;


--
-- Name: FUNCTION normalize_notification_action_url(p_action_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.normalize_notification_action_url(p_action_url text) FROM PUBLIC;


--
-- Name: FUNCTION notify_new_customer(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_new_customer() FROM PUBLIC;


--
-- Name: FUNCTION notify_order_created(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_order_created() FROM PUBLIC;


--
-- Name: FUNCTION notify_order_status_changed(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_order_status_changed() FROM PUBLIC;


--
-- Name: FUNCTION notify_payment_status_changed(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_payment_status_changed() FROM PUBLIC;


--
-- Name: FUNCTION notify_service_request_status_changed(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_service_request_status_changed() FROM PUBLIC;


--
-- Name: FUNCTION record_financial_audit(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_financial_audit() FROM PUBLIC;


--
-- Name: FUNCTION record_order_status_history(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_order_status_history() FROM PUBLIC;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;


--
-- Name: FUNCTION schedule_notification_push_retry(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer, p_error text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.schedule_notification_push_retry(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer, p_error text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.schedule_notification_push_retry(p_notification_id uuid, p_sent integer, p_failed integer, p_devices integer, p_error text) TO service_role;


--
-- Name: FUNCTION sync_delivery_zone_location(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_delivery_zone_location() FROM PUBLIC;


--
-- Name: FUNCTION sync_payment_when_order_confirmed(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_payment_when_order_confirmed() FROM PUBLIC;


--
-- Name: FUNCTION validate_delivery_location_node(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_delivery_location_node() FROM PUBLIC;


--
-- Name: FUNCTION validate_order_item_relationship(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_order_item_relationship() FROM PUBLIC;


--
-- Name: FUNCTION validate_payment_ownership(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_payment_ownership() FROM PUBLIC;


--
-- Name: FUNCTION verify_hafhass_push_webhook(p_secret text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.verify_hafhass_push_webhook(p_secret text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.verify_hafhass_push_webhook(p_secret text) TO service_role;


--
-- Name: TABLE addresses; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.addresses TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.addresses TO authenticated;


--
-- Name: TABLE business_settings; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.business_settings TO service_role;
GRANT SELECT ON TABLE public.business_settings TO anon;
GRANT SELECT,UPDATE ON TABLE public.business_settings TO authenticated;


--
-- Name: TABLE cart_items; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.cart_items TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cart_items TO authenticated;


--
-- Name: TABLE carts; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.carts TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.carts TO authenticated;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.categories TO service_role;
GRANT SELECT ON TABLE public.categories TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.categories TO authenticated;


--
-- Name: TABLE checkout_idempotency; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.checkout_idempotency TO service_role;


--
-- Name: TABLE delivery_areas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN ON TABLE public.delivery_areas TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.delivery_areas TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.delivery_areas TO service_role;


--
-- Name: TABLE delivery_cities; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN ON TABLE public.delivery_cities TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.delivery_cities TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.delivery_cities TO service_role;


--
-- Name: TABLE delivery_lgas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN ON TABLE public.delivery_lgas TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.delivery_lgas TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.delivery_lgas TO service_role;


--
-- Name: TABLE delivery_location_aliases; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.delivery_location_aliases TO service_role;
GRANT SELECT ON TABLE public.delivery_location_aliases TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.delivery_location_aliases TO authenticated;


--
-- Name: TABLE delivery_location_nodes; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.delivery_location_nodes TO service_role;
GRANT SELECT ON TABLE public.delivery_location_nodes TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.delivery_location_nodes TO authenticated;


--
-- Name: TABLE delivery_states; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN ON TABLE public.delivery_states TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.delivery_states TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.delivery_states TO service_role;


--
-- Name: TABLE delivery_zone_aliases; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.delivery_zone_aliases TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.delivery_zone_aliases TO service_role;


--
-- Name: TABLE delivery_zones; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN ON TABLE public.delivery_zones TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.delivery_zones TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.delivery_zones TO service_role;


--
-- Name: TABLE favourites; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.favourites TO service_role;
GRANT SELECT,INSERT,DELETE ON TABLE public.favourites TO authenticated;


--
-- Name: TABLE financial_audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.financial_audit_logs TO service_role;
GRANT SELECT ON TABLE public.financial_audit_logs TO authenticated;


--
-- Name: TABLE gallery_images; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.gallery_images TO service_role;
GRANT SELECT ON TABLE public.gallery_images TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.gallery_images TO authenticated;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.notifications TO service_role;
GRANT SELECT ON TABLE public.notifications TO authenticated;


--
-- Name: COLUMN notifications.user_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(user_id) ON TABLE public.notifications TO authenticated;


--
-- Name: COLUMN notifications.type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(type) ON TABLE public.notifications TO authenticated;


--
-- Name: COLUMN notifications.title; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(title) ON TABLE public.notifications TO authenticated;


--
-- Name: COLUMN notifications.message; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(message) ON TABLE public.notifications TO authenticated;


--
-- Name: COLUMN notifications.related_order_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(related_order_id) ON TABLE public.notifications TO authenticated;


--
-- Name: COLUMN notifications.related_service_request_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(related_service_request_id) ON TABLE public.notifications TO authenticated;


--
-- Name: COLUMN notifications.action_url; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(action_url) ON TABLE public.notifications TO authenticated;


--
-- Name: COLUMN notifications.is_read; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(is_read) ON TABLE public.notifications TO authenticated;


--
-- Name: COLUMN notifications.read_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(read_at) ON TABLE public.notifications TO authenticated;


--
-- Name: TABLE order_item_customizations; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.order_item_customizations TO service_role;
GRANT SELECT ON TABLE public.order_item_customizations TO authenticated;


--
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.order_items TO service_role;
GRANT SELECT ON TABLE public.order_items TO authenticated;


--
-- Name: TABLE order_status_history; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.order_status_history TO service_role;
GRANT SELECT ON TABLE public.order_status_history TO authenticated;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.orders TO service_role;
GRANT SELECT,UPDATE ON TABLE public.orders TO authenticated;


--
-- Name: COLUMN orders.status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(status) ON TABLE public.orders TO authenticated;


--
-- Name: COLUMN orders.fulfillment_method; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(fulfillment_method) ON TABLE public.orders TO authenticated;


--
-- Name: COLUMN orders.delivery_address; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(delivery_address) ON TABLE public.orders TO authenticated;


--
-- Name: COLUMN orders.requested_date; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(requested_date) ON TABLE public.orders TO authenticated;


--
-- Name: COLUMN orders.requested_time; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(requested_time) ON TABLE public.orders TO authenticated;


--
-- Name: COLUMN orders.cancellation_reason; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(cancellation_reason) ON TABLE public.orders TO authenticated;


--
-- Name: TABLE payment_webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_webhook_events TO service_role;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.payments TO service_role;
GRANT SELECT,UPDATE ON TABLE public.payments TO authenticated;


--
-- Name: TABLE product_images; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.product_images TO service_role;
GRANT SELECT ON TABLE public.product_images TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product_images TO authenticated;


--
-- Name: TABLE product_option_values; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.product_option_values TO service_role;
GRANT SELECT ON TABLE public.product_option_values TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product_option_values TO authenticated;


--
-- Name: TABLE product_options; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.product_options TO service_role;
GRANT SELECT ON TABLE public.product_options TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product_options TO authenticated;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.products TO service_role;
GRANT SELECT ON TABLE public.products TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.products TO authenticated;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO service_role;
GRANT SELECT,UPDATE ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.full_name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(full_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.phone; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(phone) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.avatar_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(avatar_url) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(updated_at) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE push_notification_dispatches; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.push_notification_dispatches TO service_role;


--
-- Name: TABLE push_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.push_subscriptions TO authenticated;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.push_subscriptions TO service_role;


--
-- Name: TABLE reviews; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.reviews TO service_role;
GRANT SELECT ON TABLE public.reviews TO anon;
GRANT SELECT ON TABLE public.reviews TO authenticated;


--
-- Name: COLUMN reviews.user_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(user_id) ON TABLE public.reviews TO authenticated;


--
-- Name: COLUMN reviews.order_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(order_id) ON TABLE public.reviews TO authenticated;


--
-- Name: COLUMN reviews.product_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(product_id) ON TABLE public.reviews TO authenticated;


--
-- Name: COLUMN reviews.rating; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(rating) ON TABLE public.reviews TO authenticated;


--
-- Name: COLUMN reviews.title; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(title) ON TABLE public.reviews TO authenticated;


--
-- Name: COLUMN reviews.comment; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(comment) ON TABLE public.reviews TO authenticated;


--
-- Name: COLUMN reviews.status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(status) ON TABLE public.reviews TO authenticated;


--
-- Name: COLUMN reviews.admin_response; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(admin_response) ON TABLE public.reviews TO authenticated;


--
-- Name: COLUMN reviews.responded_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(responded_at) ON TABLE public.reviews TO authenticated;


--
-- Name: TABLE service_quotes; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.service_quotes TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.service_quotes TO authenticated;


--
-- Name: TABLE service_requests; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.service_requests TO service_role;
GRANT SELECT ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.user_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(user_id) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.service_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(service_id) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(status) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.customer_name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(customer_name) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.customer_email; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(customer_email) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.customer_phone; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(customer_phone) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.event_type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(event_type) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.event_date; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(event_date) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.event_time; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(event_time) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.event_location; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(event_location) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.guest_count; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(guest_count) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.budget_min; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(budget_min) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.budget_max; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(budget_max) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.currency; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(currency) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.requirements; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(requirements) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.reference_images; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(reference_images) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.additional_notes; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(additional_notes) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.internal_notes; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(internal_notes) ON TABLE public.service_requests TO authenticated;


--
-- Name: COLUMN service_requests.reviewed_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(reviewed_at) ON TABLE public.service_requests TO authenticated;


--
-- Name: TABLE services; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.services TO service_role;
GRANT SELECT ON TABLE public.services TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.services TO authenticated;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict UgHOz7zkVf5dCgIjNTV7RGwfdqnwXAwbKHdGUKa3XigQrHrd62DjW33sd3wRLll

