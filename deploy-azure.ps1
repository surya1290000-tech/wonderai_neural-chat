# =====================================================================
# WonderAI NeuralChat - Azure Cloud Infrastructure & Deployment Script
# =====================================================================

$ErrorActionPreference = "Stop"

# Ensure Azure CLI is in PATH
$env:Path += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"

Write-Host "⚡ Checking Azure CLI installation..." -ForegroundColor Cyan
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI ('az') is not installed or not in PATH."
    exit 1
}

# 1. Login check
Write-Host "🔐 Verifying Azure account login..." -ForegroundColor Cyan
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "🔑 Initiating Azure login..." -ForegroundColor Yellow
    az login
    $account = az account show | ConvertFrom-Json
}

Write-Host "✅ Logged in as: $($account.user.name) (Subscription: $($account.name))" -ForegroundColor Green

# Parameters
$RESOURCE_GROUP = "wonderai-rg"
$LOCATION = "centralindia"
$RANDOM_SUFFIX = (Get-Random -Minimum 1000 -Maximum 9999)
$ACR_NAME = "wonderaicr$RANDOM_SUFFIX"
$AKS_NAME = "wonderai-aks"

# 2. Create Resource Group
Write-Host "📁 Creating Resource Group: $RESOURCE_GROUP in $LOCATION..." -ForegroundColor Cyan
az group create --name $RESOURCE_GROUP --location $LOCATION | Out-Null

# 3. Create Container Registry (ACR)
Write-Host "📦 Creating Azure Container Registry: $ACR_NAME..." -ForegroundColor Cyan
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic | Out-Null

$ACR_SERVER = "$ACR_NAME.azurecr.io"
Write-Host "✅ Container Registry Created: $ACR_SERVER" -ForegroundColor Green

# 4. Log in to ACR
Write-Host "🔓 Logging into ACR..." -ForegroundColor Cyan
az acr login --name $ACR_NAME

# 5. Tag and Push Local Images to ACR
Write-Host "🐳 Tagging and pushing Docker images to Azure ACR..." -ForegroundColor Cyan

docker tag wonderai-backend:latest "$ACR_SERVER/wonderai-backend:v1.0"
docker tag wonderai-frontend:latest "$ACR_SERVER/wonderai-frontend:v1.0"

Write-Host "⬆️ Pushing Backend Image to $ACR_SERVER..." -ForegroundColor Yellow
docker push "$ACR_SERVER/wonderai-backend:v1.0"

Write-Host "⬆️ Pushing Frontend Image to $ACR_SERVER..." -ForegroundColor Yellow
docker push "$ACR_SERVER/wonderai-frontend:v1.0"

Write-Host "✅ Docker images pushed to ACR successfully!" -ForegroundColor Green

# 6. Create AKS Cluster attached to ACR
Write-Host "☸️ Provisioning Azure Kubernetes Service (AKS) Cluster: $AKS_NAME..." -ForegroundColor Cyan
az aks create `
  --resource-group $RESOURCE_GROUP `
  --name $AKS_NAME `
  --node-count 2 `
  --enable-managed-identity `
  --attach-acr $ACR_NAME `
  --generate-ssh-keys

Write-Host "🔑 Getting AKS Cluster Credentials for kubectl..." -ForegroundColor Cyan
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_NAME --overwrite-existing

Write-Host "🎉 Azure Infrastructure Ready! Pods can now be deployed with kubectl." -ForegroundColor Green
