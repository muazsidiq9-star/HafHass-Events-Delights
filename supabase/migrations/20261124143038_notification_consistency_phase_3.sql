-- HAFHASS notification consistency
-- Records the notification URL normalisation already present in production
-- and gives service-request updates a safe destination in the customer inbox.

CREATE OR REPLACE FUNCTION public.normalize_notification_action_url(p_action_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  v_url text := NULLIF(BTRIM(p_action_url), '');
BEGIN
  IF v_url IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_url ~* '^[a-z][a-z0-9+.-]*:'
     OR LEFT(v_url, 2) = '//'
     OR POSITION(CHR(92) IN v_url) > 0
     OR v_url ~ '[[:space:]<>]' THEN
    RETURN NULL;
  END IF;

  v_url := REGEXP_REPLACE(v_url, '^(\.\./)+', '/');
  v_url := REGEXP_REPLACE(v_url, '^\./', '/');

  IF LEFT(v_url, 1) <> '/' THEN
    v_url := '/' || v_url;
  END IF;

  v_url := REGEXP_REPLACE(v_url, '^/order-details\.html', '/account/order-details.html');
  v_url := REGEXP_REPLACE(v_url, '^/orders\.html', '/account/orders.html');
  v_url := REGEXP_REPLACE(v_url, '^/notification\.html', '/account/notification.html');

  RETURN v_url;
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_notification_action_url(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_notification_action_url(text) TO postgres;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_message text,
  p_action_url text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_service_request_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, title, message, action_url,
    related_order_id, related_service_request_id
  )
  VALUES (
    p_user_id, p_type, p_title, p_message,
    public.normalize_notification_action_url(p_action_url),
    p_order_id, p_service_request_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, public.notification_type, text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, public.notification_type, text, text, text, uuid, uuid) TO postgres;

CREATE OR REPLACE FUNCTION public.admin_send_notification_idempotent(
  p_request_id uuid,
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type public.notification_type,
  p_action_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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

  IF v_admin_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required.';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request identifier is required.';
  END IF;

  IF NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_message), '') IS NULL THEN
    RAISE EXCEPTION 'A title and a message are required.';
  END IF;

  IF p_type IS NULL THEN
    RAISE EXCEPTION 'A notification category is required.';
  END IF;

  v_action_url := public.normalize_notification_action_url(p_action_url);

  INSERT INTO private.admin_notification_requests (
    request_id, admin_user_id, recipient_user_id, title,
    message, notification_type, action_url
  )
  VALUES (
    p_request_id, v_admin_id, p_user_id, BTRIM(p_title),
    BTRIM(p_message), p_type, v_action_url
  )
  ON CONFLICT (request_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_existing
    FROM private.admin_notification_requests
    WHERE request_id = p_request_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The notification request could not be recovered. Please retry.';
    END IF;

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

    RETURN jsonb_build_object(
      'created_count', v_existing.created_count,
      'notification_id', v_existing.notification_id,
      'replayed', true
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles profile
      WHERE profile.id = p_user_id
        AND profile.role = 'customer'::public.user_role
        AND profile.is_active = true
    ) THEN
      RAISE EXCEPTION 'The selected customer account is unavailable.';
    END IF;

    v_notification_id := public.create_notification(
      p_user_id, p_type, BTRIM(p_title), BTRIM(p_message), v_action_url, NULL, NULL
    );

    IF v_notification_id IS NULL THEN
      RAISE EXCEPTION 'The customer notification could not be created.';
    END IF;

    v_created_count := 1;
  ELSE
    FOR v_customer_id IN
      SELECT profile.id
      FROM public.profiles profile
      WHERE profile.role = 'customer'::public.user_role
        AND profile.is_active = true
    LOOP
      PERFORM public.create_notification(
        v_customer_id, p_type, BTRIM(p_title), BTRIM(p_message), v_action_url, NULL, NULL
      );
      v_created_count := v_created_count + 1;
    END LOOP;
  END IF;

  UPDATE private.admin_notification_requests
  SET created_count = v_created_count, notification_id = v_notification_id
  WHERE request_id = p_request_id;

  RETURN jsonb_build_object(
    'created_count', v_created_count,
    'notification_id', v_notification_id,
    'replayed', false
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_send_notification_idempotent(uuid, uuid, text, text, public.notification_type, text) TO authenticated, postgres;

CREATE OR REPLACE FUNCTION public.admin_send_broadcast_notification(
  p_title text,
  p_message text,
  p_type public.notification_type DEFAULT 'general',
  p_action_url text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_sent_count integer := 0;
  v_customer_id uuid;
  v_action_url text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required.';
  END IF;

  IF NULLIF(BTRIM(p_title), '') IS NULL
     OR NULLIF(BTRIM(p_message), '') IS NULL THEN
    RAISE EXCEPTION 'A title and a message are required.';
  END IF;

  IF p_type IS NULL THEN
    RAISE EXCEPTION 'A notification category is required.';
  END IF;

  v_action_url := public.normalize_notification_action_url(p_action_url);

  FOR v_customer_id IN
    SELECT profile.id
    FROM public.profiles AS profile
    WHERE profile.role = 'customer'::public.user_role
      AND profile.is_active = true
  LOOP
    PERFORM public.create_notification(
      v_customer_id, p_type, BTRIM(p_title), BTRIM(p_message),
      v_action_url, NULL, NULL
    );
    v_sent_count := v_sent_count + 1;
  END LOOP;

  RETURN v_sent_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_send_broadcast_notification(text, text, public.notification_type, text) TO authenticated, postgres;

CREATE OR REPLACE FUNCTION public.notify_service_request_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_title text;
  v_message text;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id THEN
    RETURN NEW;
  END IF;

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
    ELSE
      RETURN NEW;
  END CASE;

  PERFORM public.create_notification(
    NEW.user_id,
    'service_update',
    v_title,
    v_message,
    '/account/notification.html',
    NULL,
    NEW.id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_service_request_status_changed failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Bring historical records into the same canonical URL format.
UPDATE public.notifications
SET action_url = public.normalize_notification_action_url(action_url)
WHERE action_url IS NOT NULL
  AND action_url IS DISTINCT FROM public.normalize_notification_action_url(action_url);

UPDATE private.admin_notification_requests
SET action_url = public.normalize_notification_action_url(action_url)
WHERE action_url IS NOT NULL
  AND action_url IS DISTINCT FROM public.normalize_notification_action_url(action_url);
