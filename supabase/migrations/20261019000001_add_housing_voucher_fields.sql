ALTER TABLE landlord_questionnaire
  ADD COLUMN IF NOT EXISTS accepts_housing_vouchers boolean;
ALTER TABLE tenant_questionnaire
  ADD COLUMN IF NOT EXISTS participates_in_voucher_program boolean,
  ADD COLUMN IF NOT EXISTS voucher_coverage_percentage integer;
