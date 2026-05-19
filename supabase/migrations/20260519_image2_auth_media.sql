CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  original_name text NOT NULL,
  url text NOT NULL,
  storage_key text,
  width integer NOT NULL DEFAULT 0,
  height integer NOT NULL DEFAULT 0,
  size integer NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'uncategorized',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_generated boolean NOT NULL DEFAULT false,
  prompt text,
  parent_id uuid REFERENCES images(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  prompt text NOT NULL,
  negative_prompt text,
  style text,
  reference_image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  result_image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  style text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_project_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES resource_projects(id) ON DELETE CASCADE,
  image_id uuid NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  role text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_project_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_own_images ON images;
CREATE POLICY users_own_images ON images FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_generation_history ON generation_history;
CREATE POLICY users_own_generation_history ON generation_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_resource_projects ON resource_projects;
CREATE POLICY users_own_resource_projects ON resource_projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_own_resource_project_assets ON resource_project_assets;
CREATE POLICY users_own_resource_project_assets ON resource_project_assets
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM resource_projects
      WHERE resource_projects.id = resource_project_assets.project_id
      AND resource_projects.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM images
      WHERE images.id = resource_project_assets.image_id
      AND images.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM resource_projects
      WHERE resource_projects.id = resource_project_assets.project_id
      AND resource_projects.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM images
      WHERE images.id = resource_project_assets.image_id
      AND images.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS images_user_created_idx ON images(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS generation_history_user_created_idx ON generation_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS resource_projects_user_updated_idx ON resource_projects(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS resource_project_assets_project_idx ON resource_project_assets(project_id, sort_order, id);
