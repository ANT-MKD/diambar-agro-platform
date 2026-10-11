-- Verrouillage des tables : seul le serveur de l'application lit et écrit.
--
-- 1. RLS activée sur toutes les tables, sans règle d'accès : les rôles
--    publics de Supabase (anon, authenticated) ne voient rien, même si la
--    Data API venait à être réactivée. Le serveur se connecte avec le rôle
--    propriétaire des tables, qui n'est pas soumis à ces règles.
-- 2. Retrait de tous les droits de ces rôles publics, sur les tables
--    existantes et futures (seulement s'ils existent : sur une base de test
--    locale, ils n'existent pas).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;
--> statement-breakpoint
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
    END IF;
  END LOOP;
END
$$;
