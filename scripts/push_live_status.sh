#!/bin/bash
# Background watcher: pushes live_status.json to GitHub every 30 seconds.
# Run: bash scripts/push_live_status.sh &
# Stop: kill %1  (or it auto-stops when pipeline finishes)

cd "$(dirname "$0")/.."
STATUS_FILE="results/stage1/live_status.json"
SUMMARY_FILE="results/stage1/running_summary.json"
LAST_HASH=""

while true; do
    # Check if file exists
    if [ ! -f "$STATUS_FILE" ]; then
        sleep 30
        continue
    fi

    # Only push if file changed
    CURRENT_HASH=$(md5 -q "$STATUS_FILE" 2>/dev/null || md5sum "$STATUS_FILE" | cut -d' ' -f1)
    if [ "$CURRENT_HASH" != "$LAST_HASH" ]; then
        git add "$STATUS_FILE" "$SUMMARY_FILE" 2>/dev/null
        git commit -m "live: status update" --quiet 2>/dev/null
        git push --quiet 2>/dev/null
        LAST_HASH="$CURRENT_HASH"
    fi

    # Stop if pipeline is done
    if grep -q '"all_done"' "$STATUS_FILE" 2>/dev/null; then
        # One final push
        git add results/stage1/ 2>/dev/null
        git commit -m "live: final status" --quiet 2>/dev/null
        git push --quiet 2>/dev/null
        echo "Pipeline complete — watcher exiting."
        exit 0
    fi

    sleep 30
done
