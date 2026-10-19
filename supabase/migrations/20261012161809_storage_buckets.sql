-- Espaces de fichiers de Supabase Storage (seulement là où Storage existe :
-- une base de test locale n'a pas le schéma « storage »).
-- - produits : public, photos du catalogue ;
-- - preuves : privé, photos de livraison (liens signés côté serveur).
-- Aucune règle d'accès sur storage.objects : seul le serveur (clé secrète)
-- envoie des fichiers.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
      ('produits', 'produits', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
      ('preuves', 'preuves', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO UPDATE SET
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  END IF;
END
$$;
