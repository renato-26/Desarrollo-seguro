#!/usr/bin/env bash
# Publicación manual en Amazon ECR, sin crear recursos AWS ni imprimir credenciales.
# Requiere AWS CLI con permisos IAM mínimos, Docker y repositorio ECR ya creado.
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v aws >/dev/null || { echo 'Falta AWS CLI'; exit 1; }
command -v docker >/dev/null || { echo 'Falta Docker'; exit 1; }
: "${AWS_REGION:?Configurar AWS_REGION}"
: "${ECR_REPOSITORY:?Configurar ECR_REPOSITORY}"
if [[ -n "$(git status --porcelain)" ]]; then echo 'Git debe estar limpio: hacer commit antes de generar la imagen'; exit 1; fi
SHA="$(git rev-parse --verify HEAD)"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
REPO="${REGISTRY}/${ECR_REPOSITORY}"
aws ecr describe-repositories --repository-names "$ECR_REPOSITORY" --region "$AWS_REGION" >/dev/null
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
docker build --label "org.opencontainers.image.revision=$SHA" -t "$REPO:$SHA" .
docker push "$REPO:$SHA"
DIGEST="$(aws ecr describe-images --repository-name "$ECR_REPOSITORY" --image-ids "imageTag=$SHA" --region "$AWS_REGION" --query 'imageDetails[0].imageDigest' --output text)"
[[ "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo 'ECR no devolvió un digest válido'; exit 1; }
# No registra datos sensibles: solo commit e imagen inmutable.
printf '\nCOMMIT=%s\nAPP_IMAGE=%s@%s\n' "$SHA" "$REPO" "$DIGEST"
printf '\nPara desplegar en EC2 usar release.mjs con --image APP_IMAGE y --commit COMMIT.\n'
