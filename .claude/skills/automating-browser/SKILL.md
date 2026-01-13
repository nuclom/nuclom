---
name: automating-browser
description: Automate browser interactions using agent-browser CLI for web scraping, testing, and UI automation. Use when the user asks to interact with websites, capture screenshots, fill forms, scrape data, test web pages, or automate browser tasks.
---

# Browser Automation with agent-browser

Fast headless browser automation CLI optimized for AI agents. Uses Playwright under the hood with a Rust CLI for performance.

## Quick Start

```bash
# Navigate and get accessibility snapshot
agent-browser open "https://example.com"
agent-browser snapshot -i --json

# Click using element reference from snapshot
agent-browser click @e2

# Fill form and submit
agent-browser fill @e5 "user@example.com"
agent-browser click @e8
```

## Core Workflow

The recommended pattern for browser automation:

1. **Navigate**: `agent-browser open <url>`
2. **Observe**: `agent-browser snapshot -i --json` - Get interactive elements with refs
3. **Act**: Use refs from snapshot (e.g., `click @e2`, `fill @e5 "text"`)
4. **Verify**: Get new snapshot or extract data with `get`

## Essential Commands

| Command | Purpose |
|---------|---------|
| `open <url>` | Navigate to URL |
| `snapshot -i` | Get interactive elements with refs |
| `click @ref` | Click element |
| `fill @ref "text"` | Fill input field |
| `type @ref "text"` | Type character by character |
| `get text @ref` | Extract text content |
| `screenshot` | Capture page image |
| `wait <selector\|ms>` | Wait for condition |

## Using Element References

Always prefer **refs** (`@e1`, `@e2`) over CSS selectors:

```bash
# Get snapshot first
agent-browser snapshot -i --json
# Output includes refs like: button @e2 "Submit"

# Use ref to click
agent-browser click @e2
```

Refs are deterministic and won't break when page structure changes.

## Sessions for Parallel Work

```bash
# Create isolated browser sessions
agent-browser --session task1 open "https://site-a.com"
agent-browser --session task2 open "https://site-b.com"

# Actions are session-specific
agent-browser --session task1 click @e3
```

## Common Tasks

### Scrape Page Data
```bash
agent-browser open "https://example.com/products"
agent-browser snapshot -i --json
agent-browser get text ".product-title"
agent-browser get html ".product-list"
```

### Fill and Submit Form
```bash
agent-browser open "https://example.com/contact"
agent-browser snapshot -i
agent-browser fill @e3 "John Doe"
agent-browser fill @e4 "john@example.com"
agent-browser fill @e5 "Hello, I have a question..."
agent-browser click @e6
```

### Capture Screenshot
```bash
agent-browser open "https://example.com"
agent-browser wait load
agent-browser screenshot --full output.png
```

### Handle Authentication
```bash
agent-browser open "https://example.com/login"
agent-browser fill "#email" "user@example.com"
agent-browser fill "#password" "password123"
agent-browser click "text=Sign In"
agent-browser wait "text=Dashboard"
```

## Detailed References

**Complete command reference**: See [REFERENCE.md](REFERENCE.md)
**Selector patterns**: See [SELECTORS.md](SELECTORS.md)
**Usage examples**: See [EXAMPLES.md](EXAMPLES.md)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Element not found | Run `snapshot -i` to get current refs |
| Action too fast | Add `wait <selector>` before action |
| Page not loaded | Use `wait load` or `wait networkidle` |
| Wrong element clicked | Use more specific selector or ref |

## Installation

If agent-browser is not installed:

```bash
npm install -g agent-browser
agent-browser install  # Downloads Chromium
```

For Linux with system dependencies:
```bash
agent-browser install --with-deps
```
