#!/usr/bin/env bash
# Register the Teamsly Azure AD (Entra ID) app with the exact delegated Graph
# permissions, redirect URIs and a client secret — replaces the 25-click portal
# walkthrough in SELF_HOSTING.md §1. Prints the .env lines at the end.
#
#   ./scripts/azure-app.sh https://teams.example.com            # your deployment URL
#   ./scripts/azure-app.sh http://localhost:3000 --name "Teamsly Dev" --single-tenant
#
# Needs: az CLI (https://aka.ms/azcli), logged in (`az login`) as a user who can
# create app registrations. Add --grant to also grant tenant-wide admin consent
# (requires Global/Application Administrator).
set -euo pipefail

BASE_URL="${1:?usage: azure-app.sh <base-url> [--name N] [--single-tenant] [--grant]}"; shift
NAME="Teamsly"; AUDIENCE="AzureADandPersonalMicrosoftAccount"; GRANT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    --single-tenant) AUDIENCE="AzureADMyOrg"; shift ;;
    --grant) GRANT=1; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

GRAPH="00000003-0000-0000-c000-000000000000"
# Delegated permission ids for Microsoft Graph (stable, documented at
# https://learn.microsoft.com/graph/permissions-reference)
declare -A SCOPES=(
  [User.Read]="e1fe6dd8-ba31-4d61-89e7-88639da4683d"
  [User.ReadBasic.All]="b340eb25-3456-403f-be2f-af7a0d370277"
  [Team.ReadBasic.All]="485be79e-c497-4b35-9400-0e3fa7f2a5d4"
  [Channel.ReadBasic.All]="9d8982ae-4365-4f57-95e9-d6032a4c0b87"
  [ChannelMessage.Read.All]="767156cb-16ae-4d10-8f8b-41b657c8c8c8"
  [ChannelMessage.Send]="ebf0f66e-9fb1-49e4-a278-222f76911cf4"
  [Chat.ReadWrite]="9ff7295e-131b-4d94-90e1-69fde507ac11"
  [Presence.Read.All]="9c7a330d-35b3-4aa1-963d-cb2b9f927841"
  [Presence.ReadWrite]="8d3c54a7-cf58-4773-bf81-c0cd6ad522bb"
  [Files.Read.All]="df85f4d6-205c-4ac5-a5ea-6bf408dba283"
  [Files.ReadWrite]="5c28f0bf-8a70-41f1-8ab2-9032436ddb65"
  [Calendars.Read]="465a38f9-76ea-45b9-9f34-9e8b0d4b0b42"
)

REDIRECTS=("${BASE_URL%/}/api/auth/callback/microsoft-entra-id")
[[ "$BASE_URL" != http://localhost* ]] && REDIRECTS+=("http://localhost:3000/api/auth/callback/microsoft-entra-id")

echo "▸ creating app registration '$NAME' ($AUDIENCE)…"
APP_JSON=$(az ad app create --display-name "$NAME" --sign-in-audience "$AUDIENCE" \
  --web-redirect-uris "${REDIRECTS[@]}" --enable-id-token-issuance false -o json)
APP_ID=$(echo "$APP_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["appId"])')
OBJ_ID=$(echo "$APP_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "  appId $APP_ID"

echo "▸ adding ${#SCOPES[@]} delegated Microsoft Graph permissions…"
ARGS=(); for s in "${!SCOPES[@]}"; do ARGS+=("${SCOPES[$s]}=Scope"); done
az ad app permission add --id "$APP_ID" --api "$GRAPH" --api-permissions "${ARGS[@]}" -o none 2>/dev/null

echo "▸ creating client secret (24 months)…"
SECRET=$(az ad app credential reset --id "$APP_ID" --display-name "teamsly-$(date +%Y%m)" --years 2 --query password -o tsv)

echo "▸ creating service principal (needed for consent)…"
az ad sp create --id "$APP_ID" -o none 2>/dev/null || true

if [ "$GRANT" = 1 ]; then
  echo "▸ granting tenant-wide admin consent…"
  az ad app permission admin-consent --id "$APP_ID" -o none && echo "  consented"
else
  echo "  skip admin consent (add --grant, or open: https://login.microsoftonline.com/$TENANT_ID/adminconsent?client_id=$APP_ID)"
fi

cat <<ENV

✔ Done. Put this in .env / your host's environment:

AZURE_AD_CLIENT_ID=$APP_ID
AZURE_AD_CLIENT_SECRET=$SECRET
AZURE_AD_TENANT_ID=$([ "$AUDIENCE" = AzureADMyOrg ] && echo "$TENANT_ID" || echo common)
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=$APP_ID
AUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=${BASE_URL%/}

Portal: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/$APP_ID
ENV
