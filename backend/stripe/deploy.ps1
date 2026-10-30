[CmdletBinding()]
param([string]$Stage = '.artifacts/stripe-payments-20261029/stage')
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$stagePath = [IO.Path]::GetFullPath((Join-Path $project $Stage))
$connection = @('-i','C:\Users\alexa\.ssh\shenpulse_vps','-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes')
$remote = 'debian@213.32.22.185'
$tag = 'stripe-payments-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$destination = '/var/www/shenpulse/.deploy-staging/' + $tag
$baseline = Get-Content -LiteralPath (Join-Path $stagePath 'baseline.json') -Raw | ConvertFrom-Json
$agencyBaseline = (Get-Content -LiteralPath (Join-Path $stagePath 'agency-baseline.sha256') -Raw).Trim()
& ssh @connection $remote "mkdir -p '$destination/stripe' '$destination/agencies'"
if ($LASTEXITCODE -ne 0) {throw 'Préparation du staging refusée.'}
foreach ($file in @('payments.js','index.js','stripe/service.mjs','agencies/service.mjs')) {
  & scp @connection (Join-Path $stagePath $file) "${remote}:$destination/$file"
  if ($LASTEXITCODE -ne 0) {throw "Copie impossible : $file"}
}
$script = @"
set -euo pipefail
cd /var/www/shenpulse
[ "`$(sha256sum server/payments.js | cut -d ' ' -f1)" = '$($baseline.'payments.js')' ]
[ "`$(sha256sum server/index.js | cut -d ' ' -f1)" = '$($baseline.'index.js')' ]
[ "`$(sha256sum server/agencies/service.mjs | cut -d ' ' -f1)" = '$agencyBaseline' ]
node --check '$destination/payments.js'
node --check '$destination/index.js'
node --check '$destination/stripe/service.mjs'
node --check '$destination/agencies/service.mjs'
backup='server/.stripe-backups/$tag'
mkdir -p "`$backup/agencies"
cp -p server/payments.js "`$backup/payments.js"
cp -p server/index.js "`$backup/index.js"
cp -p server/agencies/service.mjs "`$backup/agencies/service.mjs"
cp '$destination/stripe/service.mjs' server/stripe/service.mjs
cp '$destination/agencies/service.mjs' server/agencies/service.mjs
cp '$destination/payments.js' server/payments.js
cp '$destination/index.js' server/index.js
if ! pm2 restart shenpulse --update-env >/dev/null; then
  cp "`$backup/payments.js" server/payments.js
  cp "`$backup/index.js" server/index.js
  cp "`$backup/agencies/service.mjs" server/agencies/service.mjs
  pm2 restart shenpulse --update-env >/dev/null
  exit 70
fi
node --input-type=module -e 'let success=false;for(let attempt=0;attempt<20;attempt++){try{const r=await fetch("http://127.0.0.1:3199/api/payments/config");if(r.ok){const p=await r.json();if(p.stripe?.ready && p.paypalReady){console.log(JSON.stringify({paypalReady:p.paypalReady,stripe:p.stripe}));success=true;break;}}}catch{}await new Promise(r=>setTimeout(r,500));}if(!success)process.exit(1);' || {
  cp "`$backup/payments.js" server/payments.js
  cp "`$backup/index.js" server/index.js
  cp "`$backup/agencies/service.mjs" server/agencies/service.mjs
  pm2 restart shenpulse --update-env >/dev/null
  exit 71
}
printf 'STRIPE_DEPLOYED_BACKUP=%s\n' "`$backup"
"@
$script.Replace("`r",'') | & ssh @connection $remote 'bash -s'
if ($LASTEXITCODE -ne 0) {throw 'Publication Stripe refusée ou restaurée. Consulter les diagnostics.'}
