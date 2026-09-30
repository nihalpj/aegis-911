-- AEGIS-911 database bootstrap. Mounted into /docker-entrypoint-initdb.d and
-- executed only on first postgres-data volume creation; kept idempotent so
-- it also works when POSTGRES_DB already created the database.

SELECT 'CREATE DATABASE aegis911'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aegis911')\gexec
