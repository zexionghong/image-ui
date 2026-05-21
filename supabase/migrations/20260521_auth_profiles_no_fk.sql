CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  current_plan text NOT NULL DEFAULT 'free',
  proposals_used integer NOT NULL DEFAULT 0,
  billing_cycle_start date NOT NULL DEFAULT CURRENT_DATE,
  ls_customer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_plan text NOT NULL DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS proposals_used integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_cycle_start date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ls_customer_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  price_monthly decimal(10,2) NOT NULL,
  proposals_per_month integer NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ls_variant_id text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  ls_subscription_id text UNIQUE,
  ls_customer_id text,
  ls_order_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT conrelid::regclass::text AS table_name, conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND connamespace = 'public'::regnamespace
      AND conrelid::regclass::text IN ('profiles', 'plans', 'subscriptions')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', constraint_record.table_name, constraint_record.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NULL OR EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_profiles'
      AND c.relkind IN ('v', 'm')
  ) THEN
    EXECUTE 'DROP VIEW IF EXISTS public.user_profiles';
    EXECUTE '
      CREATE VIEW public.user_profiles
      WITH (security_invoker = true) AS
      SELECT
        id,
        email,
        full_name,
        current_plan,
        proposals_used,
        billing_cycle_start,
        ls_customer_id,
        created_at,
        updated_at
      FROM public.profiles
    ';
  END IF;
END $$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_own_profile ON profiles;
CREATE POLICY users_own_profile ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS plans_public_read ON plans;
CREATE POLICY plans_public_read ON plans FOR SELECT USING (true);

DROP POLICY IF EXISTS users_own_subscriptions ON subscriptions;
CREATE POLICY users_own_subscriptions ON subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO plans (name, display_name, price_monthly, proposals_per_month, features)
VALUES
  ('free', 'Free', 0.00, 3, '["3 proposals per month", "AI-powered generation", "PDF export", "Proposal history"]'::jsonb),
  ('pro', 'Pro', 15.00, -1, '["Unlimited proposals", "AI-powered generation", "PDF export", "Proposal history", "Priority support"]'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  display_name = excluded.display_name,
  price_monthly = excluded.price_monthly,
  proposals_per_month = excluded.proposals_per_month,
  features = excluded.features,
  is_active = true;

CREATE INDEX IF NOT EXISTS profiles_current_plan_idx ON profiles(current_plan);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_plan_idx ON subscriptions(plan_id);

NOTIFY pgrst, 'reload schema';
