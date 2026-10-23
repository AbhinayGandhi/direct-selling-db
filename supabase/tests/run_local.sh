#!/usr/bin/env bash
# Runs migrations + tests on a THROWAWAY local PostgreSQL database named "t". Never point at production.
set -e
cd "$(dirname "$0")/.."
psql -q -c 'drop database if exists t' -c 'create database t' postgres
for f in tests/00_supabase_stub.sql migrations/*.sql tests/10_db_tests.sql; do psql -q -v ON_ERROR_STOP=1 -d t -f "$f" | grep -E 'FAIL|passed|^ +[0-9]+ +\|' || true; done
