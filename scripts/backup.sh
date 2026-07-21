#!/bin/bash
# Daily local backup of data/ (JSON content) + public/uploads/ (images). This project has no
# database — those two directories are the entire persistent state of the site. Run via cron
# (see the crontab entry set up alongside this script). Keeps RETENTION_DAYS days of backups
# under ./backups, then prunes older ones. Local-only for now — not shipped off this VPS.
set -euo pipefail

PROJECT_DIR=/opt/thaikaomai-new
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%F)
LOG="$BACKUP_DIR/backup.log"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

{
  echo "===== Backup started: $(date) ====="

  echo "-- data/ tar --"
  tar -czf "$BACKUP_DIR/data-$DATE.tar.gz" -C "$PROJECT_DIR" data

  echo "-- public/uploads/ tar --"
  tar -czf "$BACKUP_DIR/uploads-$DATE.tar.gz" -C "$PROJECT_DIR/public" uploads

  echo "-- pruning backups older than $RETENTION_DAYS days --"
  find "$BACKUP_DIR" -maxdepth 1 -name '*.tar.gz' -mtime +$RETENTION_DAYS -delete

  echo "===== Backup finished: $(date) ====="
} >> "$LOG" 2>&1
