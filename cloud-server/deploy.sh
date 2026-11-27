#!/usr/bin/env bash
set -euo pipefail

project=titanium-web-516010-u9
region=europe-west1
service=skos-cloud-test
account=skos-cloud-runtime
identity="$account@$project.iam.gserviceaccount.com"
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

case "${1:-}" in
  identity)
    gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
      sheets.googleapis.com identitytoolkit.googleapis.com iam.googleapis.com --project="$project"
    if ! gcloud iam service-accounts describe "$identity" --project="$project" --quiet >/dev/null 2>&1; then
      gcloud iam service-accounts create "$account" --display-name="SKOS Cloud Runtime" --project="$project"
    fi
    gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:$identity" \
      --role=roles/firebaseauth.viewer --condition=None --quiet >/dev/null
    printf '\nShare the private test spreadsheet with this editor: %s\n' "$identity"
    ;;
  deploy)
    if [[ $# -ne 5 || ! $2 =~ ^[A-Za-z0-9_-]+$ || ! $3 =~ ^[0-9]+$ ||
          ! $4 =~ ^[A-Za-z0-9_-]+$ || ! $5 =~ ^[A-Za-z0-9_,-]+$ ]]; then
      echo 'Usage: deploy.sh deploy TEST_SPREADSHEET_ID CLOUD_DB_GID OWNER_UID VIEWER_UIDS' >&2
      exit 2
    fi
    if [[ $2 == '16qxluljVN3hrDeAwnyzezHigrX__bAvTuXWK2BXHGvQ' ]]; then
      echo 'Use a separate test spreadsheet for the initial deployment.' >&2
      exit 2
    fi
    gcloud run deploy "$service" --source="$source_dir" --project="$project" --region="$region" \
      --service-account="$identity" --allow-unauthenticated --min-instances=0 --max-instances=2 \
      --set-env-vars="^|^GOOGLE_CLOUD_PROJECT=$project|SKOS_SPREADSHEET_ID=$2|SKOS_INDEX_SHEET_ID=$3|SKOS_OWNER_UID=$4|SKOS_VIEWER_UIDS=$5"
    endpoint="$(gcloud run services describe "$service" --region="$region" --project="$project" --format='value(status.url)')"
    status="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$endpoint/session")"
    [[ $status == 401 ]] || { printf 'Expected a 401 response for anonymous access; got %s\n' "$status" >&2; exit 1; }
    printf '\nCloud Run URL: %s\n' "$endpoint"
    ;;
  *)
    echo 'Usage: deploy.sh identity | deploy.sh deploy TEST_SPREADSHEET_ID CLOUD_DB_GID OWNER_UID VIEWER_UIDS' >&2
    exit 2
    ;;
esac
