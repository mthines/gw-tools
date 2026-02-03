# AUR Setup Guide

This guide will help you set up automatic AUR package publishing for gw-tools.

## Prerequisites

- An account on [aur.archlinux.org](https://aur.archlinux.org)
- SSH key configured for AUR access
- `makepkg` installed (part of the `pacman` package)

## One-Time Setup

### 1. Create AUR Account

1. Go to https://aur.archlinux.org/register/
2. Create an account
3. Verify your email

### 2. Configure SSH Key

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy your public key
cat ~/.ssh/id_ed25519.pub
```

1. Go to https://aur.archlinux.org/account/
2. Paste your SSH public key in the "SSH Public Key" section
3. Save

### 3. Test SSH Access

```bash
ssh -T aur@aur.archlinux.org
```

You should see: `Hi username! You've successfully authenticated...`

### 4. Initial Package Submission

**Note:** Only do this once when first publishing to AUR.

```bash
# Clone the AUR repository (will be empty)
git clone ssh://aur@aur.archlinux.org/gw-tools.git
cd gw-tools

# Copy the PKGBUILD template and update it with current version
cp /path/to/gw-tools/packages/gw-tool/PKGBUILD.template PKGBUILD

# Update the placeholders manually for the first release:
# - Replace VERSION_PLACEHOLDER with current version
# - Replace X64_SHA256_PLACEHOLDER with actual x64 SHA256
# - Replace ARM64_SHA256_PLACEHOLDER with actual arm64 SHA256

# Generate .SRCINFO
makepkg --printsrcinfo > .SRCINFO

# Commit and push
git add PKGBUILD .SRCINFO
git commit -m "Initial import: gw-tools v0.x.x"
git push
```

### 5. Update Maintainer Email

Edit `PKGBUILD.template` and replace `your@email.com` with your actual email:

```bash
# Maintainer: Matt Hines <your_actual_email@example.com>
```

## Automatic Updates

Once set up, the `release.sh` script will automatically:

1. ✅ Clone the AUR repository
2. ✅ Generate updated PKGBUILD with new version and SHA256 hashes
3. ✅ Generate .SRCINFO
4. ✅ Commit and push to AUR

**Note:** AUR updates are only triggered for stable releases (not beta/prerelease versions).

## Troubleshooting

### "Failed to clone AUR repository"
- Check SSH key is properly configured: `ssh -T aur@aur.archlinux.org`
- Ensure the package exists on AUR (do initial submission first)

### "makepkg not found"
- Install makepkg: `sudo pacman -S base-devel` (on Arch)
- On non-Arch systems, the script will skip AUR updates

### Manual AUR Update

If automatic updates fail, you can manually update:

```bash
git clone ssh://aur@aur.archlinux.org/gw-tools.git
cd gw-tools

# Update version in PKGBUILD
vim PKGBUILD

# Update checksums
updpkgsums

# Generate .SRCINFO
makepkg --printsrcinfo > .SRCINFO

# Commit and push
git add PKGBUILD .SRCINFO
git commit -m "Update to vX.Y.Z"
git push
```

## Resources

- [AUR Submission Guidelines](https://wiki.archlinux.org/title/AUR_submission_guidelines)
- [Creating AUR Packages](https://wiki.archlinux.org/title/AUR_submission_guidelines#Creating_a_package)
- [PKGBUILD Documentation](https://wiki.archlinux.org/title/PKGBUILD)
