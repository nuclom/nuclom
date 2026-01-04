# Troubleshooting

> Solutions for common issues with Nuclom.

---

## Quick Fixes

**Try these first:**

1. Refresh the page (`F5` or `Cmd/Ctrl + R`)
2. Clear browser cache
3. Try a different browser
4. Check your internet connection
5. Try incognito/private mode

---

## Jump to Issue

| Category | Common Problems |
| -------- | --------------- |
| [Video Playback](#video-playback) | Won't play, poor quality, buffering |
| [Uploads](#uploads) | Failed uploads, slow uploads |
| [Login & Access](#login--access) | Can't sign in, access denied |
| [Comments](#comments) | Can't comment, comments not showing |
| [Performance](#performance) | Slow loading, crashes |

---

## Video Playback

### Video Won't Play

**Symptoms:** Loading spinner, black screen, error message

**Solutions:**

| Step | Action |
| ---- | ------ |
| 1 | Refresh the page |
| 2 | Try a different browser (Chrome recommended) |
| 3 | Clear browser cache and cookies |
| 4 | Disable browser extensions (especially ad blockers) |
| 5 | Check internet speed (minimum 2 Mbps for video) |

**Browser-specific:**

| Browser | Fix |
| ------- | --- |
| Chrome | Enable hardware acceleration in Settings |
| Firefox | Update to latest version |
| Safari | Enable JavaScript and cookies |
| Edge | Clear browsing data |

---

### Poor Video Quality

**Symptoms:** Blurry video, stuttering, buffering

**Solutions:**

1. **Check quality settings** — Click the quality icon in the player
2. **Test internet speed** — Need 5 Mbps for HD, 25 Mbps for 4K
3. **Close other tabs** — Free up bandwidth
4. **Use wired connection** — WiFi can be unstable

---

## Uploads

### Upload Failed

**Symptoms:** Progress stops, error message, file appears corrupted

**Before uploading:**

| Check | Requirement |
| ----- | ----------- |
| Format | MP4, MOV, AVI, or MKV |
| File size | Under your plan's limit |
| File integrity | Plays correctly on your device |

**During upload:**

- Keep the browser tab open
- Use a stable internet connection
- Avoid closing your laptop

**If it still fails:**

1. Try a different browser
2. Clear browser cache
3. Compress the video and try again
4. Try uploading a smaller test file

---

### Slow Uploads

**Symptoms:** Upload taking much longer than expected

| Fix | Details |
| --- | ------- |
| Check upload speed | Run a speed test (need at least 1 Mbps) |
| Use wired connection | More stable than WiFi |
| Close other apps | Stop downloads, streaming, backups |
| Upload off-peak | Less network congestion |
| Compress video | Use HandBrake to reduce file size |

---

## Login & Access

### Can't Sign In

**Password issues:**

1. Check caps lock
2. Use "Forgot Password" link
3. Check spam folder for reset email

**OAuth issues (GitHub/Google):**

1. Make sure you're using the same provider you signed up with
2. Check if your OAuth account is active
3. Try signing out of Google/GitHub first, then sign in to Nuclom

**Two-factor authentication:**

1. Check your device time is correct (codes are time-based)
2. Use backup codes if available
3. Contact support if locked out

---

### Access Denied

**Symptoms:** "Access denied" or "Permission denied" errors

| Check | Solution |
| ----- | -------- |
| Organization membership | Make sure you're a member of the organization |
| Your role | Check if you have permission for this action |
| Content permissions | The content owner may have restricted access |
| Session expired | Log out and back in |

---

## Comments

### Can't Add Comments

**Check these:**

| Issue | Solution |
| ----- | -------- |
| Permissions | You may not have commenting permissions |
| JavaScript | Make sure JavaScript is enabled |
| Extensions | Disable browser extensions and try again |
| Cache | Clear browser cache |

---

### Comments Not Showing

**Try:**

1. Refresh the page
2. Check comment filters (might be hiding some)
3. Clear browser cache
4. Check if you have read access to the video

---

## Performance

### Slow Loading

| Fix | How |
| --- | --- |
| Clear cache | Browser settings → Clear browsing data |
| Close tabs | Each tab uses memory |
| Update browser | Use the latest version |
| Check extensions | Disable unnecessary extensions |
| Restart browser | Fully close and reopen |

---

### Browser Crashes

**Memory issues:**

1. Close unused tabs
2. Restart your browser
3. Disable heavy extensions
4. Check if other apps are using too much memory

---

## System Requirements

### Browsers

| Browser | Minimum Version |
| ------- | --------------- |
| Chrome | 80+ (recommended) |
| Firefox | 75+ |
| Safari | 13+ |
| Edge | 80+ |

### Internet Speeds

| Activity | Minimum Speed |
| -------- | ------------- |
| General use | 2 Mbps |
| HD video | 5 Mbps |
| 4K video | 25 Mbps |
| Uploading | 1 Mbps |

### Device Requirements

| Device | Minimum |
| ------ | ------- |
| RAM | 4 GB (8 GB recommended) |
| iOS | iPhone 6s+, iOS 12+ |
| Android | Android 6.0+, 2 GB RAM |

---

## Still Need Help?

### Self-Service

- Review other [User Guides](README.md)
- Check the [API Documentation](../api/README.md) for developers

### Contact Support

| Channel | When to Use |
| ------- | ----------- |
| **Email** (support@nuclom.com) | General issues, non-urgent |
| **Live chat** | Urgent issues during business hours |
| **Emergency line** | Enterprise customers, critical issues |

### When Contacting Support

Include:
- What you were trying to do
- What happened instead
- Error messages (screenshots help)
- Browser and device info
- Steps to reproduce the issue
