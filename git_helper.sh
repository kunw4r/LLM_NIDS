#!/bin/bash
# Git workflow helper for LLM_NIDS project
# Usage: ./git_helper.sh "commit message"

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  LLM_NIDS Git Helper${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if commit message provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./git_helper.sh \"your commit message\"${NC}"
    echo -e "${YELLOW}Example: ./git_helper.sh \"Add threat intelligence tool\"${NC}\n"
    exit 1
fi

COMMIT_MSG="$1"

# Show status
echo -e "${GREEN}📊 Current status:${NC}"
git status --short

echo -e "\n${GREEN}📝 Files to commit:${NC}"
git diff --stat

# Ask for confirmation
echo -e "\n${YELLOW}Commit message: ${COMMIT_MSG}${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Add all changes (except ignored files)
echo -e "\n${GREEN}📦 Adding files...${NC}"
git add .

# Commit
echo -e "${GREEN}💾 Committing...${NC}"
git commit -m "$COMMIT_MSG"

# Push
echo -e "${GREEN}🚀 Pushing to GitHub...${NC}"
git push

echo -e "\n${GREEN}✅ Done!${NC}"
echo -e "${BLUE}Repository: https://github.com/kunw4r/LLM_NIDS${NC}\n"
