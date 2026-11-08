#!/bin/bash
set -e

# Usa la contraseña desde una variable de entorno
: "${DB_PASS:?Define DB_PASS antes de ejecutar}"

sudo -u postgres psql -c "ALTER USER cv_user WITH PASSWORD '$DB_PASS';"
export PGPASSWORD="$DB_PASS"

psql -h localhost -U cv_user -d credito_vecino -c "SELECT 1;"
psql -h localhost -U cv_user -d credito_vecino -f src/persistencia/esquema.sql
