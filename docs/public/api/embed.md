# Embeddable Video Player

Nuclom provides an embeddable video player that can be integrated into any website using an iframe. This allows you to share videos on external sites while maintaining full playback functionality.

## Quick Start

### Basic Embed

To embed a Nuclom video, use the following iframe code:

```html
<iframe
  src="https://nuclom.com/embed/VIDEO_ID"
  width="640"
  height="360"
  frameborder="0"
  allowfullscreen
  allow="autoplay; fullscreen; picture-in-picture"
></iframe>
```

Replace `VIDEO_ID` with either:
- A **video ID** from your Nuclom dashboard
- A **share link ID** for password-free shared videos

### Responsive Embed

For responsive embeds that scale with their container:

```html
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
  <iframe
    src="https://nuclom.com/embed/VIDEO_ID"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    frameborder="0"
    allowfullscreen
    allow="autoplay; fullscreen; picture-in-picture"
  ></iframe>
</div>
```

---

## URL Parameters

Customize the embed behavior using query parameters:

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `autoplay` | `0`, `1` | `0` | Start playing automatically (requires `muted=1` in most browsers) |
| `muted` | `0`, `1` | `0` | Start video muted |
| `loop` | `0`, `1` | `0` | Loop video when it ends |
| `title` | `0`, `1` | `1` | Show video title overlay |
| `branding` | `0`, `1` | `1` | Show Nuclom branding |
| `t` | `<seconds>` | `0` | Start time in seconds |

### Examples

**Autoplay muted:**
```html
<iframe src="https://nuclom.com/embed/VIDEO_ID?autoplay=1&muted=1" ...></iframe>
```

**Start at 2 minutes, no branding:**
```html
<iframe src="https://nuclom.com/embed/VIDEO_ID?t=120&branding=0" ...></iframe>
```

**Loop with no title:**
```html
<iframe src="https://nuclom.com/embed/VIDEO_ID?loop=1&title=0" ...></iframe>
```

---

## Player Controls

The embedded player includes the following controls:

- **Play/Pause** - Click the video or control button
- **Progress bar** - Seek to any position
- **Volume** - Mute/unmute toggle
- **Fullscreen** - Expand to full screen

### Keyboard Shortcuts

When the embed has focus:

| Key | Action |
|-----|--------|
| `Space` or `K` | Play/Pause |
| `M` | Mute/Unmute |
| `F` | Toggle Fullscreen |
| `←` | Seek back 10 seconds |
| `→` | Seek forward 10 seconds |

---

## JavaScript API

The embed player supports the postMessage API for programmatic control:

### Sending Commands

```javascript
const iframe = document.querySelector('iframe');

// Play the video
iframe.contentWindow.postMessage({ command: 'play' }, '*');

// Pause the video
iframe.contentWindow.postMessage({ command: 'pause' }, '*');

// Seek to a specific time (in seconds)
iframe.contentWindow.postMessage({ command: 'seek', time: 60 }, '*');

// Set muted state
iframe.contentWindow.postMessage({ command: 'mute', muted: true }, '*');
```

### Receiving Events

```javascript
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://nuclom.com') return;

  const { event: eventName, data } = event.data;

  switch (eventName) {
    case 'ready':
      console.log('Player is ready');
      break;
    case 'play':
      console.log('Video started playing');
      break;
    case 'pause':
      console.log('Video paused');
      break;
    case 'timeupdate':
      console.log('Current time:', data.currentTime);
      break;
    case 'ended':
      console.log('Video ended');
      break;
  }
});
```

---

## Using Share Links

To embed a video using a share link:

1. Create a share link from the video's share settings
2. Copy the share link ID (the last part of the URL)
3. Use the ID in your embed URL

```html
<!-- Share link: https://nuclom.com/share/abc123 -->
<iframe src="https://nuclom.com/embed/abc123" ...></iframe>
```

**Note:** Password-protected share links cannot be embedded. The embed will show an error if the share link requires a password.

---

## Security Considerations

### CORS Policy

The embed endpoints support Cross-Origin Resource Sharing (CORS) to allow embedding from any domain.

### Content Security Policy

If your site uses CSP, add the following directives:

```
frame-src https://nuclom.com;
connect-src https://nuclom.com;
```

### X-Frame-Options

Our embed pages have permissive X-Frame-Options to allow embedding. Regular Nuclom pages cannot be embedded.

---

## Analytics

Embed views are tracked automatically and appear in your video analytics:

- **View Count**: Each unique session is counted
- **Source**: Views are labeled as "embed"
- **Referrer**: The embedding page URL is recorded
- **Watch Time**: Duration watched is tracked

Access embed analytics from your video's analytics dashboard.

---

## Styling

### Custom Dimensions

The player is responsive within the iframe. Set dimensions on the iframe element:

```html
<!-- Fixed size -->
<iframe width="800" height="450" ...></iframe>

<!-- Percentage-based -->
<iframe style="width: 100%; height: 400px;" ...></iframe>
```

### Aspect Ratios

Common aspect ratios and their padding percentages for responsive containers:

| Aspect Ratio | Padding Bottom |
|--------------|----------------|
| 16:9 | 56.25% |
| 4:3 | 75% |
| 21:9 | 42.86% |
| 1:1 | 100% |

---

## Rate Limits

Embed API requests are subject to rate limiting:

- **100 requests per minute** per IP address
- **Soft limits** - exceeding may result in temporary slowdowns

---

## Troubleshooting

### Video doesn't play

- Check that the video ID or share link is correct
- Verify the share link hasn't expired or reached its view limit
- Ensure autoplay has `muted=1` if using `autoplay=1`

### Embed shows error

- "Video not found" - Check the video/share link ID
- "This video has expired" - The share link has passed its expiration date
- "View limit reached" - The share link has reached its maximum views

### Controls not showing

- Move mouse over the video to reveal controls
- Controls hide automatically after 3 seconds when playing

---

## API Reference

### GET /api/embed/:id

Get embed video data.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "video_abc123",
    "title": "Product Demo",
    "videoUrl": "https://...",
    "thumbnailUrl": "https://...",
    "duration": "5:32",
    "organization": {
      "name": "Acme Corp",
      "slug": "acme"
    },
    "isShareLink": false
  }
}
```

### POST /api/embed/:id/view

Track a video view.

**Response:**

```json
{
  "success": true
}
```

---

*Last Updated: January 2026*
