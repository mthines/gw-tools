# VS Code Extension Publishing Setup

This guide explains how to set up the required secrets for publishing the `gw-worktrees` VS Code extension to the VS Code Marketplace and Open VSX.

## Prerequisites

- A Microsoft account (for VS Code Marketplace)
- A GitHub account (for Open VSX - uses GitHub OAuth)
- Admin access to the GitHub repository

---

## 1. VS Code Marketplace (VSCE_PAT)

### Step 1: Create an Azure DevOps Organization

1. Go to [Azure DevOps](https://dev.azure.com/)
2. Sign in with your Microsoft account
3. If you don't have an organization, create one:
   - Click "New organization"
   - Name it (e.g., `gw-tools`)
   - Choose a region

### Step 2: Create a Publisher

1. Go to the [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers)
2. Click "Create publisher"
3. Fill in:
   - **ID**: `gw-tools` (must match `publisher` in package.json)
   - **Name**: `gw-tools`
   - Other optional fields as desired
4. Click "Create"

### Step 3: Create a Personal Access Token (PAT)

1. Go to [Azure DevOps](https://dev.azure.com/)
2. Click on your profile icon (top right) → "Personal access tokens"
3. Click "New Token"
4. Configure the token:
   - **Name**: `vscode-marketplace-publish`
   - **Organization**: Select "All accessible organizations"
   - **Expiration**: Choose duration (max 1 year, set a reminder to rotate)
   - **Scopes**: Click "Custom defined", then:
     - Find "Marketplace" section
     - Check **Manage** (this includes Publish)
5. Click "Create"
6. **Copy the token immediately** - you won't be able to see it again

### Step 4: Verify the PAT (Optional)

```bash
npx @vscode/vsce verify-pat gw-tools
# Enter your PAT when prompted
```

---

## 2. Open VSX (OVSX_PAT)

Open VSX is an open-source alternative marketplace, used by VS Code forks like VSCodium.

### Step 1: Create an Account

1. Go to [Open VSX](https://open-vsx.org/)
2. Click "Log in" (top right)
3. Sign in with your GitHub account
4. Authorize Open VSX to access your GitHub account

### Step 2: Create a Namespace

1. After logging in, go to your [User Settings](https://open-vsx.org/user-settings/namespaces)
2. Under "Namespaces", click "Create namespace"
3. Enter: `gw-tools` (must match `publisher` in package.json)
4. Click "Create"

### Step 3: Create an Access Token

1. Go to [User Settings → Access Tokens](https://open-vsx.org/user-settings/tokens)
2. Click "Generate new token"
3. Enter a description: `github-actions-publish`
4. Click "Generate"
5. **Copy the token immediately** - you won't be able to see it again

---

## 3. GitHub Repository Configuration

### Step 1: Create the Environment

1. Go to your GitHub repository
2. Navigate to **Settings** → **Environments**
3. Click "New environment"
4. Name it: `vscode-publish`
5. Click "Configure environment"

### Step 2: Add Environment Secrets

In the `vscode-publish` environment configuration:

1. Under "Environment secrets", click "Add secret"

2. Add **VSCE_PAT**:
   - Name: `VSCE_PAT`
   - Value: Your Azure DevOps Personal Access Token
   - Click "Add secret"

3. Add **OVSX_PAT** (optional):
   - Name: `OVSX_PAT`
   - Value: Your Open VSX Access Token
   - Click "Add secret"

### Step 3: Configure Protection Rules (Recommended)

Still in the environment settings:

1. Check "Required reviewers" if you want approval before publishing
2. Add trusted team members as reviewers
3. Optionally limit "Deployment branches" to `main` only

---

## 4. Verification

### Test the Workflow

1. Make a change to `packages/vscode-gw/`
2. Push to main or trigger the workflow manually:
   - Go to **Actions** → **CI**
   - Click "Run workflow"
   - Check "Force VS Code extension release"
   - Optionally check "Dry run" to test without publishing
   - Click "Run workflow"

### Check Published Extension

- **VS Code Marketplace**: https://marketplace.visualstudio.com/items?itemName=gw-tools.gw-worktrees
- **Open VSX**: https://open-vsx.org/extension/gw-tools/gw-worktrees

---

## Token Rotation

Both tokens expire and should be rotated periodically:

| Token | Max Lifetime | Rotation Steps |
|-------|--------------|----------------|
| VSCE_PAT | 1 year | Create new PAT in Azure DevOps, update GitHub secret |
| OVSX_PAT | No expiry | Revoke old token in Open VSX, create new one, update GitHub secret |

Set calendar reminders to rotate tokens before they expire.

---

## Troubleshooting

### "Publisher 'gw-tools' not found"

- Ensure the publisher exists at https://marketplace.visualstudio.com/manage/publishers
- The `publisher` field in `package.json` must match exactly

### "Access Denied" or "401 Unauthorized"

- Verify the PAT has "Marketplace > Manage" scope
- Check the PAT hasn't expired
- Ensure "All accessible organizations" was selected

### "Namespace 'gw-tools' not found" (Open VSX)

- Create the namespace at https://open-vsx.org/user-settings/namespaces
- The namespace must match the `publisher` field in `package.json`

### Workflow Skips Publishing

- Check that `vscode_changed` is `true` in the detect-changes job
- Verify the workflow is running on the `main` branch
- Check that tests pass before versioning runs
