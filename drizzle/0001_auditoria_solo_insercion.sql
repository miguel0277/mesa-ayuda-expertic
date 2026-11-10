-- La auditoría es SOLO de inserción: cualquier UPDATE o DELETE sobre audit_log falla.
-- (TRUNCATE sigue permitido solo para `pnpm db:seed --reset` en desarrollo.)
CREATE OR REPLACE FUNCTION audit_log_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es solo de inserción: % no está permitido', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();
