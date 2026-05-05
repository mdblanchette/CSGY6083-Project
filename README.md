# 1. Install
pip install -r requirements.txt

# 2. Build DB
createdb snickrdb

psql snickrdb < create_tables.sql

If PostgreSQL was installed via the standard installer, might need to do this instead:

createdb -U postgres snickrdb

psql -U postgres snickrdb < create_tables.sql
