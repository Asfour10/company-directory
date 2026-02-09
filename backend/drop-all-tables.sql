-- Drop all tables and reset database
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO company_directory_user;
GRANT ALL ON SCHEMA public TO public;
