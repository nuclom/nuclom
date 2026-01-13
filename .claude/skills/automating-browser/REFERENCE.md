# agent-browser Command Reference

Complete reference for all agent-browser commands.

## Contents
- Navigation commands
- Element interaction commands
- Data extraction commands
- Wait commands
- Browser configuration commands
- Session management
- Network and storage commands
- Global options

---

## Navigation Commands

### open
Navigate to a URL.
```bash
agent-browser open "https://example.com"
agent-browser open "https://example.com" --wait networkidle
```

### close
Terminate the browser session.
```bash
agent-browser close
```

### back / forward / reload
Navigate browser history.
```bash
agent-browser back
agent-browser forward
agent-browser reload
```

---

## Element Interaction Commands

### click
Click an element.
```bash
agent-browser click @e2
agent-browser click "#submit-btn"
agent-browser click "text=Submit"
```

### dblclick
Double-click an element.
```bash
agent-browser dblclick @e5
```

### fill
Clear and fill an input field (recommended for forms).
```bash
agent-browser fill @e3 "user@example.com"
agent-browser fill "#search" "query text"
```

### type
Type text character by character (simulates real typing).
```bash
agent-browser type @e3 "Hello"
agent-browser type @e3 "Hello" --delay 100  # 100ms between keys
```

### press
Press a keyboard key.
```bash
agent-browser press Enter
agent-browser press Tab
agent-browser press "Control+a"
agent-browser press "Meta+c"
```

### focus
Focus an element.
```bash
agent-browser focus @e4
```

### hover
Hover over an element.
```bash
agent-browser hover @e2
```

### select
Select option(s) from a dropdown.
```bash
agent-browser select @e3 "option1"
agent-browser select @e3 "option1" "option2"  # Multi-select
```

### check / uncheck
Toggle checkboxes.
```bash
agent-browser check @e5
agent-browser uncheck @e5
```

### scroll
Scroll the page or element.
```bash
agent-browser scroll down 500
agent-browser scroll up 200
agent-browser scroll @e3 down 100
```

### scrollintoview
Scroll element into viewport.
```bash
agent-browser scrollintoview @e10
```

### drag
Drag from one element to another.
```bash
agent-browser drag @e3 @e5
agent-browser drag "#source" "#target"
```

### upload
Upload file(s) to a file input.
```bash
agent-browser upload @e4 "/path/to/file.pdf"
agent-browser upload @e4 "file1.jpg" "file2.jpg"
```

---

## Data Extraction Commands

### snapshot
Get accessibility tree with element references.
```bash
agent-browser snapshot              # Full tree
agent-browser snapshot -i           # Interactive elements only (recommended)
agent-browser snapshot -c           # Compact format
agent-browser snapshot -d 3         # Limit depth to 3 levels
agent-browser snapshot -s "#main"   # Scope to selector
agent-browser snapshot -i --json    # Machine-readable output
```

### get
Extract data from elements.
```bash
agent-browser get text @e2          # Text content
agent-browser get html @e2          # Inner HTML
agent-browser get value @e3         # Input value
agent-browser get attr @e2 href     # Attribute value
agent-browser get title             # Page title
agent-browser get url               # Current URL
agent-browser get count ".item"     # Element count
agent-browser get box @e2           # Bounding box coordinates
```

### is
Check element state.
```bash
agent-browser is visible @e2
agent-browser is enabled @e3
agent-browser is checked @e5
```

### screenshot
Capture page screenshot.
```bash
agent-browser screenshot output.png
agent-browser screenshot -f output.png    # Full page
agent-browser screenshot --full output.png
agent-browser screenshot @e2 element.png  # Element only
```

### pdf
Generate PDF of page.
```bash
agent-browser pdf output.pdf
```

---

## Wait Commands

### wait
Wait for various conditions.
```bash
agent-browser wait 2000                    # Wait 2 seconds
agent-browser wait @e2                     # Wait for element
agent-browser wait "text=Loading" hidden   # Wait for text to disappear
agent-browser wait url "**/dashboard"      # Wait for URL pattern
agent-browser wait load                    # Wait for page load
agent-browser wait networkidle             # Wait for network idle
agent-browser wait fn "() => document.readyState === 'complete'"
```

---

## Browser Configuration Commands

### set viewport
Set browser viewport size.
```bash
agent-browser set viewport 1920 1080
agent-browser set viewport 375 667       # Mobile size
```

### set device
Emulate a specific device.
```bash
agent-browser set device "iPhone 14"
agent-browser set device "Pixel 5"
```

### set geo
Set geolocation.
```bash
agent-browser set geo 37.7749 -122.4194  # San Francisco
```

### set offline
Toggle offline mode.
```bash
agent-browser set offline true
agent-browser set offline false
```

### set headers
Set custom HTTP headers.
```bash
agent-browser set headers '{"X-Custom": "value"}'
```

### set credentials
Set HTTP authentication.
```bash
agent-browser set credentials username password
```

---

## Session Management

Sessions provide isolated browser contexts.

```bash
# Create named sessions
agent-browser --session agent1 open "https://site-a.com"
agent-browser --session agent2 open "https://site-b.com"

# Use environment variable
export AGENT_BROWSER_SESSION=agent1
agent-browser click @e2

# Actions are isolated per session
agent-browser --session agent1 screenshot a.png
agent-browser --session agent2 screenshot b.png
```

---

## Tab and Window Management

### tab
Manage browser tabs.
```bash
agent-browser tab new                # New tab
agent-browser tab list               # List tabs
agent-browser tab switch 2           # Switch to tab 2
agent-browser tab close              # Close current tab
```

### window
Manage browser windows.
```bash
agent-browser window new
agent-browser window list
agent-browser window switch 1
```

### frame
Switch to iframe.
```bash
agent-browser frame "#iframe-id"
agent-browser frame main             # Return to main frame
```

---

## Network and Storage Commands

### cookies
Manage cookies.
```bash
agent-browser cookies                # List cookies
agent-browser cookies get name       # Get specific cookie
agent-browser cookies set name value
agent-browser cookies delete name
agent-browser cookies clear
```

### storage
Access browser storage.
```bash
agent-browser storage local          # Get localStorage
agent-browser storage session        # Get sessionStorage
agent-browser storage local get key
agent-browser storage local set key value
```

### network
Monitor and intercept requests.
```bash
agent-browser network requests       # List requests made
agent-browser network route "**/api/*" '{"status": 200, "body": "{}"}'
agent-browser network unroute "**/api/*"
```

---

## Dialog Handling

Handle JavaScript dialogs (alert, confirm, prompt).
```bash
agent-browser dialog accept
agent-browser dialog accept "input text"   # For prompts
agent-browser dialog dismiss
```

---

## Global Options

These options work with any command:

| Option | Description |
|--------|-------------|
| `--json` | Machine-readable JSON output |
| `--session <name>` | Use named browser session |
| `--headed` | Show browser window (not headless) |
| `--debug` | Enable debug output |
| `-f, --full` | Full page for screenshots |

```bash
agent-browser --json snapshot -i
agent-browser --headed open "https://example.com"
agent-browser --debug click @e2
```
