BEGIN;

CREATE INDEX IF NOT EXISTS idx_statements_active_id
ON public.statements(is_active, id);

CREATE INDEX IF NOT EXISTS idx_party_answers_latest
ON public.party_answers(party_id, statement_id, updated_at DESC, id DESC);

COMMIT;
