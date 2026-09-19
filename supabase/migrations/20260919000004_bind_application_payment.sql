-- Permanently bind each universal-application payment to the exact window it
-- created so replaying an old Stripe session can never mint a new entitlement.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS universal_application_id UUID
  REFERENCES universal_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_universal_application
  ON payments(universal_application_id)
  WHERE universal_application_id IS NOT NULL;

-- Bind legacy universal-application payment records to the closest window that
-- existed for the same payer. Old confirmations will return that row only.
UPDATE payments p
SET universal_application_id = (
  SELECT ua.id
  FROM universal_applications ua
  WHERE ua.tenant_id = p.payer_id
  ORDER BY abs(extract(epoch FROM (ua.created_at - p.created_at)))
  LIMIT 1
)
WHERE p.universal_application_id IS NULL
  AND p.payer_id IS NOT NULL
  AND p.description ILIKE 'Universal application%';

CREATE OR REPLACE FUNCTION activate_universal_application_payment(
  p_tenant_id UUID,
  p_payment_intent_id TEXT,
  p_amount_cents INTEGER,
  p_description TEXT,
  p_property_id UUID DEFAULT NULL
)
RETURNS TABLE(universal_application_id UUID, already_processed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bound_id UUID;
  new_id UUID;
BEGIN
  -- Serialize activation for one tenant across confirm and webhook requests.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 0));

  SELECT p.universal_application_id INTO bound_id
  FROM payments p
  WHERE p.stripe_payment_intent_id = p_payment_intent_id;

  IF FOUND THEN
    IF bound_id IS NULL THEN
      RAISE EXCEPTION 'Existing payment is not bound to an application window.';
    END IF;
    RETURN QUERY SELECT bound_id, true;
    RETURN;
  END IF;

  UPDATE universal_applications
  SET status = 'expired'
  WHERE tenant_id = p_tenant_id AND status = 'active';

  INSERT INTO universal_applications (
    tenant_id, status, valid_until, triggering_property_id
  )
  VALUES (
    p_tenant_id, 'active', now() + interval '6 months', p_property_id
  )
  RETURNING id INTO new_id;

  INSERT INTO payments (
    application_id, universal_application_id, stripe_payment_intent_id,
    amount_cents, currency, status, payer_id, description
  )
  VALUES (
    NULL, new_id, p_payment_intent_id,
    p_amount_cents, 'usd', 'succeeded', p_tenant_id, p_description
  );

  RETURN QUERY SELECT new_id, false;
END;
$$;

REVOKE ALL ON FUNCTION activate_universal_application_payment(UUID, TEXT, INTEGER, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION activate_universal_application_payment(UUID, TEXT, INTEGER, TEXT, UUID)
  TO service_role;