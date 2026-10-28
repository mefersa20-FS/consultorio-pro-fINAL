-- PsicoVida: require a paid, unexpired Izipay subscription before Neon Auth
-- creates a new user or changes an account email. Applied to the Neon branch
-- migracion-sin-supabase on 2026-10-28.

CREATE OR REPLACE FUNCTION public.psicovida_require_paid_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.email IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.billing_subscriptions s
    WHERE lower(s.payer_email) = lower(NEW.email)
      AND upper(s.status) = 'ACTIVE'
      AND s.next_billing_at > now()
  ) THEN
    RAISE EXCEPTION 'Se requiere una suscripción pagada y vigente para crear una cuenta.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS psicovida_paid_signup_required ON neon_auth."user";
CREATE TRIGGER psicovida_paid_signup_required
BEFORE INSERT OR UPDATE OF email ON neon_auth."user"
FOR EACH ROW EXECUTE FUNCTION public.psicovida_require_paid_subscription();

CREATE OR REPLACE FUNCTION public.psicovida_link_subscription_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.billing_subscriptions
     SET user_id = NEW.id::text,
         synced_at = now()
   WHERE lower(payer_email) = lower(NEW.email)
     AND upper(status) = 'ACTIVE'
     AND next_billing_at > now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS psicovida_link_paid_subscription ON neon_auth."user";
CREATE TRIGGER psicovida_link_paid_subscription
AFTER INSERT ON neon_auth."user"
FOR EACH ROW EXECUTE FUNCTION public.psicovida_link_subscription_user();
