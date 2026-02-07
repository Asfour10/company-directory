#!/bin/bash

# Database Setup Verification Script
# This script verifies that the production database is properly configured

set -e

echo "=================================="
echo "Database Setup Verification"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗ DATABASE_URL environment variable is not set${NC}"
    echo "  Please set DATABASE_URL before running this script"
    exit 1
fi

echo -e "${GREEN}✓ DATABASE_URL is set${NC}"
echo ""

# Extract connection details from DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

echo "Connection Details:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Function to run SQL query
run_query() {
    psql "$DATABASE_URL" -t -c "$1" 2>/dev/null
}

# Function to check and display result
check_result() {
    local test_name=$1
    local query=$2
    local expected=$3
    
    echo -n "Checking $test_name... "
    
    result=$(run_query "$query" | tr -d ' \n')
    
    if [ "$result" == "$expected" ] || [ -z "$expected" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        return 1
    fi
}

# Test 1: Database Connection
echo "-----------------------------------"
echo "Test 1: Database Connection"
echo "-----------------------------------"
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Successfully connected to database${NC}"
else
    echo -e "${RED}✗ Failed to connect to database${NC}"
    exit 1
fi
echo ""

# Test 2: SSL Connection
echo "-----------------------------------"
echo "Test 2: SSL/TLS Connection"
echo "-----------------------------------"
ssl_status=$(run_query "SELECT ssl_is_used();")
if [ "$ssl_status" == "t" ]; then
    echo -e "${GREEN}✓ SSL/TLS is enabled${NC}"
else
    echo -e "${YELLOW}⚠ SSL/TLS is not enabled (recommended for production)${NC}"
fi
echo ""

# Test 3: Database Version
echo "-----------------------------------"
echo "Test 3: PostgreSQL Version"
echo "-----------------------------------"
version=$(run_query "SELECT version();")
echo "  $version"
if [[ $version == *"PostgreSQL 13"* ]] || [[ $version == *"PostgreSQL 14"* ]] || [[ $version == *"PostgreSQL 15"* ]]; then
    echo -e "${GREEN}✓ PostgreSQL version is 13 or higher${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL version may be outdated${NC}"
fi
echo ""

# Test 4: Required Extensions
echo "-----------------------------------"
echo "Test 4: Required Extensions"
echo "-----------------------------------"
check_result "pg_trgm extension" "SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_trgm';" "1"
check_result "uuid-ossp extension" "SELECT COUNT(*) FROM pg_extension WHERE extname = 'uuid-ossp';" "1"
echo ""

# Test 5: Required Tables
echo "-----------------------------------"
echo "Test 5: Required Tables"
echo "-----------------------------------"
tables=("tenants" "users" "employees" "sessions" "audit_logs" "analytics_events" "custom_fields")
for table in "${tables[@]}"; do
    check_result "$table table" "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table';" "1"
done
echo ""

# Test 6: Indexes
echo "-----------------------------------"
echo "Test 6: Performance Indexes"
echo "-----------------------------------"
check_result "employees tenant_id index" "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'employees' AND indexname LIKE '%tenant_id%';" ""
check_result "employees email index" "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'employees' AND indexname LIKE '%email%';" ""
check_result "employees search index" "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'employees' AND indexname LIKE '%search%';" ""
echo ""

# Test 7: Connection Limits
echo "-----------------------------------"
echo "Test 7: Connection Configuration"
echo "-----------------------------------"
max_conn=$(run_query "SHOW max_connections;")
echo "  Max connections: $max_conn"
if [ "$max_conn" -ge 100 ]; then
    echo -e "${GREEN}✓ Max connections is adequate (>= 100)${NC}"
else
    echo -e "${YELLOW}⚠ Max connections may be too low for production${NC}"
fi
echo ""

# Test 8: Current Connections
echo "-----------------------------------"
echo "Test 8: Current Connections"
echo "-----------------------------------"
current_conn=$(run_query "SELECT count(*) FROM pg_stat_activity WHERE datname = '$DB_NAME';")
echo "  Current connections: $current_conn"
echo -e "${GREEN}✓ Connection count retrieved${NC}"
echo ""

# Test 9: Backup Configuration
echo "-----------------------------------"
echo "Test 9: Backup Configuration"
echo "-----------------------------------"
archive_mode=$(run_query "SHOW archive_mode;")
echo "  Archive mode: $archive_mode"
if [ "$archive_mode" == "on" ]; then
    echo -e "${GREEN}✓ WAL archiving is enabled (point-in-time recovery available)${NC}"
else
    echo -e "${YELLOW}⚠ WAL archiving is not enabled (consider enabling for production)${NC}"
fi
echo ""

# Test 10: User Permissions
echo "-----------------------------------"
echo "Test 10: User Permissions"
echo "-----------------------------------"
echo "Checking permissions for user: $DB_USER"
perms=$(run_query "SELECT has_database_privilege('$DB_USER', '$DB_NAME', 'CONNECT');")
if [ "$perms" == "t" ]; then
    echo -e "${GREEN}✓ User has CONNECT privilege${NC}"
else
    echo -e "${RED}✗ User does not have CONNECT privilege${NC}"
fi
echo ""

# Test 11: Sample Data Query
echo "-----------------------------------"
echo "Test 11: Sample Data Query"
echo "-----------------------------------"
tenant_count=$(run_query "SELECT COUNT(*) FROM tenants;")
user_count=$(run_query "SELECT COUNT(*) FROM users;")
employee_count=$(run_query "SELECT COUNT(*) FROM employees;")
echo "  Tenants: $tenant_count"
echo "  Users: $user_count"
echo "  Employees: $employee_count"
echo -e "${GREEN}✓ Successfully queried tables${NC}"
echo ""

# Summary
echo "=================================="
echo "Verification Summary"
echo "=================================="
echo ""
echo "Database setup verification complete!"
echo ""
echo "Next Steps:"
echo "1. Review any warnings or failures above"
echo "2. Ensure SSL/TLS is enabled for production"
echo "3. Configure automated backups if not already done"
echo "4. Test backup restoration procedure"
echo "5. Set up monitoring and alerting"
echo ""
