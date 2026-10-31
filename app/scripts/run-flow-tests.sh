#!/bin/bash
# Runs every local test with MOCK calls only. Starts throwaway servers (in-memory database), runs the tests, stops them.
# Never uses your real database, Fo, or your phone. Usage: bash scripts/run-flow-tests.sh   (from the app folder)
set -u
cd "$(dirname "$0")/.."
stop() { pkill -f "next start" 2>/dev/null; pkill -f next-server 2>/dev/null; sleep 1; }
# SIMULATED server: what a stranger gets ("Demo: simulated calls")
sim() { (PGLITE_DIR=memory AGENT_MODE=demo DEV_LOGIN=1 MAX_REQUESTS_PER_USER_PER_DAY=99 PORT=3000 npm run start >> /tmp/hogaya-3000.log 2>&1 &); }
# REHEARSAL server: live-style bookings but every call is faked (FO_DRY_RUN=1)
reh() { (PGLITE_DIR=memory FO_DRY_RUN=1 AGENT_MODE=real DEV_LOGIN=1 CRON_SECRET=test-secret MAX_REQUESTS_PER_USER_PER_DAY=99 PORT=3100 npm run start >> /tmp/hogaya-3100.log 2>&1 &); }
stop; rm -f /tmp/hogaya-3000.log /tmp/hogaya-3100.log
[ "${SKIP_BUILD:-0}" = 1 ] || npm run build 2>&1 | grep -E "rror|Compiled"
FAIL=0
run() { echo "=== npm run $1"; npm run "$1" > /tmp/t.out 2>&1; RC=$?; grep -E "^(ok|ALL PASSED|FAILED)|AssertionError|Error:" /tmp/t.out | head -40; [ $RC = 0 ] || FAIL=1; }
run test:state; run test:briefs; run test:db; run test:fo-poll; run test:fo-json
stop; sim; reh; sleep 6
run test:flow          # simulated server (3000) + rehearsal server (3100)
run test:access        # against 3000
stop; (PGLITE_DIR=memory FO_DRY_RUN=1 AGENT_MODE=real DEV_LOGIN=1 PORT=3100 npm run start >> /tmp/hogaya-3100.log 2>&1 &); sleep 5; run test:live-gate   # fresh server with the default 3-bookings-a-day limit (part of that test)
stop; reh; sleep 5; run test:engine
echo "=== real Fo calls placed by all of this (must be 0 ask_fo lines): $(cat /tmp/hogaya-3000.log /tmp/hogaya-3100.log | grep -c ask_fo)"
stop
[ $FAIL = 0 ] && echo "EVERYTHING PASSED" || echo "SOMETHING FAILED"
exit $FAIL
