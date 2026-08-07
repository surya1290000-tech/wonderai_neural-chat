# =====================================================================
# WonderAI NeuralChat - Azure Cloud Infrastructure & Deployment Script
# =====================================================================

$ErrorActionPreference = "Continue"
$env:Path += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"

# Prevent Windows CLI socket connection reset issues (10054)
$env:AZURE_CLI_DISABLE_CONNECTION_REUSE = "1"
$env:AZURE_CORE_OUTPUT_COLOR = "0"

function Invoke-AzWithRetry {
    param([string]$Command)
    $attempts = 0
    while ($attempts -lt 5) {
        $attempts++
        Write-Host "[+] Executing: $Command (Attempt $attempts)..." -ForegroundColor Cyan
        $out = Invoke-Expression $Command 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $out
        }
        Write-Host "[!] Command returned error or network reset. Retrying in 5 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
    Write-Error "Command failed after $attempts attempts: $Command"
    exit 1
}

Write-Host "[+] Checking Azure CLI installation..." -ForegroundColor Cyan
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI ('az') is not installed or not in PATH."
    exit 1
}

# 1. Login check
Write-Host "[+] Verifying Azure account login..." -ForegroundColor Cyan
$accountRaw = az account show 2>$null
if (-not $accountRaw) {
    Write-Host "[!] Initiating Azure login..." -ForegroundColor Yellow
    az login
    $accountRaw = az account show
}
$account = $accountRaw | ConvertFrom-Json
Write-Host "[OK] Logged in as: $($account.user.name) (Subscription: $($account.name))" -ForegroundColor Green

# 2. Resource Provider Registration
Write-Host "[+] Ensuring Resource Providers (Microsoft.ContainerRegistry & Microsoft.ContainerService) are registered..." -ForegroundColor Cyan
az provider register --namespace Microsoft.ContainerRegistry 2>$null
az provider register --namespace Microsoft.ContainerService 2>$null

# Parameters (Location set to 'koreacentral' which is authorized by Azure for Students policy AND supported by Google Gemini AI API)
$RESOURCE_GROUP = "wonderai-kc-rg"
$LOCATION = "koreacentral"
$ACR_NAME = "wonderaicr9872"
$AKS_NAME = "wonderai-aks"
$ACR_SERVER = "$ACR_NAME.azurecr.io"

# 3. Resource Group
Write-Host "[+] Ensuring Resource Group $RESOURCE_GROUP exists in $LOCATION..." -ForegroundColor Cyan
Invoke-AzWithRetry "az group create --name $RESOURCE_GROUP --location $LOCATION --output none"
Write-Host "[OK] Resource Group $RESOURCE_GROUP ready." -ForegroundColor Green

# 4. Azure Container Registry
Write-Host "[+] Ensuring Azure Container Registry $ACR_NAME exists..." -ForegroundColor Cyan
Invoke-AzWithRetry "az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true --location $LOCATION --output none"
Write-Host "[OK] Azure Container Registry $ACR_NAME ready." -ForegroundColor Green

# 5. Provision AKS Cluster with Standard_D2s_v3 VM size
Write-Host "[+] Provisioning Azure Kubernetes Service (AKS) Cluster: $AKS_NAME (Standard_D2s_v3 nodes)..." -ForegroundColor Cyan
$aksCheck = az aks show --resource-group $RESOURCE_GROUP --name $AKS_NAME 2>$null
if (-not $aksCheck) {
    Invoke-AzWithRetry "az aks create --resource-group $RESOURCE_GROUP --name $AKS_NAME --node-count 2 --node-vm-size Standard_D2s_v3 --enable-managed-identity --attach-acr $ACR_NAME --generate-ssh-keys --output none"
}
Write-Host "[OK] AKS Cluster $AKS_NAME ready!" -ForegroundColor Green

# 6. Docker Login & Image Push
Write-Host "[+] Logging into ACR via Docker..." -ForegroundColor Cyan
$acrPass = az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv
docker login $ACR_SERVER -u $ACR_NAME -p $acrPass

Write-Host "[+] Building & Pushing Backend Image to ACR..." -ForegroundColor Cyan
docker build -t "$ACR_SERVER/wonderai-backend:v1.0" ./backend
docker push "$ACR_SERVER/wonderai-backend:v1.0"

Write-Host "[+] Building & Pushing Frontend Image to ACR..." -ForegroundColor Cyan
docker build -t "$ACR_SERVER/wonderai-frontend:v1.0" ./frontend
docker push "$ACR_SERVER/wonderai-frontend:v1.0"

Write-Host "[OK] Microservice container images built and pushed to ACR!" -ForegroundColor Green

# 7. Fetch kubectl credentials
Write-Host "[+] Getting AKS Cluster Credentials..." -ForegroundColor Cyan
Invoke-AzWithRetry "az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_NAME --overwrite-existing"

# 8. Apply Kubernetes manifests
Write-Host "[+] Deploying Kubernetes Workloads to AKS..." -ForegroundColor Cyan
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml
kubectl apply -f kubernetes/postgres-deployment.yaml
kubectl apply -f kubernetes/redis-deployment.yaml
kubectl apply -f kubernetes/backend-deployment.yaml
kubectl apply -f kubernetes/frontend-deployment.yaml

Write-Host "[OK] Azure Deployment Completed Successfully!" -ForegroundColor Green
