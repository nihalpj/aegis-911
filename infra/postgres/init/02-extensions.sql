-- Extensions used by the app (call-history search, id generation).
-- Runs against POSTGRES_DB during first-time volume init.

\connect aegis911

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
