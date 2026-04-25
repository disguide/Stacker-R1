-- Sync Anchor: V2 Sync Engine Setup
-- This function provides a reliable server-side timestamp for synchronization.
-- Clients should use this to anchor their sync requests to ensure consistency.

CREATE OR REPLACE FUNCTION get_server_time()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;

-- Ensure it is public for all authenticated users to call for sync anchoring
GRANT EXECUTE ON FUNCTION get_server_time() TO authenticated;
GRANT EXECUTE ON FUNCTION get_server_time() TO anon;
