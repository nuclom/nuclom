# Browser Automation Examples

Practical workflows for common automation tasks.

## Contents
- Web scraping workflows
- Form automation workflows
- Testing workflows
- Multi-page workflows
- Advanced patterns

---

## Web Scraping Workflows

### Scrape Product Listings

```bash
# Navigate to product page
agent-browser open "https://store.example.com/products"
agent-browser wait load

# Get snapshot to understand page structure
agent-browser snapshot -i --json

# Extract data
agent-browser get text ".product-title"
agent-browser get text ".product-price"
agent-browser get attr ".product-link" href

# Screenshot for verification
agent-browser screenshot products.png
```

### Scrape Table Data

```bash
agent-browser open "https://example.com/data-table"
agent-browser wait ".data-table"

# Get row count
agent-browser get count "tbody tr"

# Extract specific cells
agent-browser get text "tbody tr:nth-child(1) td:nth-child(2)"
agent-browser get html "tbody"
```

### Paginated Scraping

```bash
# Loop through pages
agent-browser open "https://example.com/listings?page=1"
agent-browser wait ".listing"
agent-browser get text ".listing"
agent-browser screenshot page1.png

# Check for next page and navigate
agent-browser snapshot -i
agent-browser click "text=Next"
agent-browser wait ".listing"
agent-browser get text ".listing"
```

---

## Form Automation Workflows

### Login Flow

```bash
agent-browser open "https://app.example.com/login"
agent-browser wait load

# Get snapshot to find form elements
agent-browser snapshot -i

# Fill credentials (using refs from snapshot)
agent-browser fill @e3 "user@example.com"
agent-browser fill @e4 "password123"
agent-browser click @e5

# Wait for redirect
agent-browser wait url "**/dashboard"
agent-browser wait "text=Welcome"
```

### Multi-Step Form

Task Progress Checklist:
```
- [ ] Navigate to form
- [ ] Fill step 1 (personal info)
- [ ] Fill step 2 (address)
- [ ] Fill step 3 (payment)
- [ ] Submit and verify
```

```bash
# Step 1: Personal Info
agent-browser open "https://example.com/checkout"
agent-browser snapshot -i
agent-browser fill "label=First Name" "John"
agent-browser fill "label=Last Name" "Doe"
agent-browser fill "label=Email" "john@example.com"
agent-browser click "text=Continue"

# Step 2: Address
agent-browser wait "text=Shipping Address"
agent-browser snapshot -i
agent-browser fill "label=Street" "123 Main St"
agent-browser fill "label=City" "San Francisco"
agent-browser select "label=State" "California"
agent-browser fill "label=ZIP" "94102"
agent-browser click "text=Continue"

# Step 3: Payment
agent-browser wait "text=Payment"
agent-browser snapshot -i
agent-browser fill "label=Card Number" "4111111111111111"
agent-browser fill "label=Expiry" "12/25"
agent-browser fill "label=CVV" "123"
agent-browser click "text=Place Order"

# Verify success
agent-browser wait "text=Order Confirmed"
agent-browser screenshot confirmation.png
```

### File Upload

```bash
agent-browser open "https://example.com/upload"
agent-browser snapshot -i

# Upload file to input
agent-browser upload "input[type=file]" "/path/to/document.pdf"

# Or using ref
agent-browser upload @e3 "/path/to/image.jpg"

# Submit
agent-browser click "text=Upload"
agent-browser wait "text=Upload complete"
```

---

## Testing Workflows

### Visual Regression Testing

```bash
# Capture baseline screenshots
agent-browser open "https://example.com"
agent-browser wait load
agent-browser screenshot --full baseline-home.png

agent-browser open "https://example.com/about"
agent-browser wait load
agent-browser screenshot --full baseline-about.png

# Compare with new version
agent-browser open "https://staging.example.com"
agent-browser wait load
agent-browser screenshot --full test-home.png
```

### Responsive Testing

```bash
# Desktop
agent-browser set viewport 1920 1080
agent-browser open "https://example.com"
agent-browser screenshot desktop.png

# Tablet
agent-browser set viewport 768 1024
agent-browser reload
agent-browser screenshot tablet.png

# Mobile
agent-browser set device "iPhone 14"
agent-browser reload
agent-browser screenshot mobile.png
```

### Form Validation Testing

```bash
agent-browser open "https://example.com/signup"

# Test empty submission
agent-browser click "text=Submit"
agent-browser is visible ".error-message"
agent-browser get text ".error-message"

# Test invalid email
agent-browser fill "label=Email" "invalid-email"
agent-browser click "text=Submit"
agent-browser get text ".error-message"

# Test valid submission
agent-browser fill "label=Email" "valid@example.com"
agent-browser fill "label=Password" "SecurePass123!"
agent-browser click "text=Submit"
agent-browser wait url "**/welcome"
```

---

## Multi-Page Workflows

### E-commerce Purchase Flow

```bash
# Browse and add to cart
agent-browser open "https://store.example.com"
agent-browser click "text=Electronics"
agent-browser wait ".product-grid"
agent-browser click ".product-card >> nth=0"
agent-browser wait ".product-detail"
agent-browser click "text=Add to Cart"
agent-browser wait "text=Added"

# Proceed to checkout
agent-browser click "text=Cart"
agent-browser wait ".cart-items"
agent-browser click "text=Checkout"

# Complete checkout (see multi-step form above)
```

### Session Persistence

```bash
# Login once
agent-browser --session myapp open "https://app.example.com/login"
agent-browser --session myapp fill "#email" "user@example.com"
agent-browser --session myapp fill "#password" "password"
agent-browser --session myapp click "text=Login"
agent-browser --session myapp wait url "**/dashboard"

# Later actions use same session (authenticated)
agent-browser --session myapp open "https://app.example.com/settings"
agent-browser --session myapp open "https://app.example.com/profile"
```

---

## Advanced Patterns

### Handling Popups and Modals

```bash
agent-browser open "https://example.com"

# Wait for and dismiss cookie banner
agent-browser wait "text=Accept Cookies" --timeout 5000
agent-browser click "text=Accept Cookies"

# Handle modal
agent-browser wait ".modal"
agent-browser click ".modal >> text=Close"
```

### Handling Dialogs (alert/confirm/prompt)

```bash
# Accept alert
agent-browser open "https://example.com/with-alert"
agent-browser click "text=Show Alert"
agent-browser dialog accept

# Confirm dialog
agent-browser click "text=Delete Item"
agent-browser dialog accept

# Dismiss confirm
agent-browser click "text=Delete Item"
agent-browser dialog dismiss

# Answer prompt
agent-browser click "text=Enter Name"
agent-browser dialog accept "John Doe"
```

### Working with Iframes

```bash
agent-browser open "https://example.com/embedded"

# Switch to iframe
agent-browser frame "#payment-iframe"
agent-browser fill "label=Card Number" "4111111111111111"
agent-browser click "text=Pay"

# Return to main frame
agent-browser frame main
agent-browser click "text=Continue"
```

### Network Interception

```bash
# Mock API response
agent-browser network route "**/api/user" '{"status": 200, "body": "{\"name\": \"Test User\"}"}'
agent-browser open "https://app.example.com"

# Monitor requests
agent-browser network requests
```

### Parallel Sessions

```bash
# Run multiple isolated browsers
agent-browser --session site1 open "https://example1.com" &
agent-browser --session site2 open "https://example2.com" &
wait

# Interact with each
agent-browser --session site1 screenshot site1.png
agent-browser --session site2 screenshot site2.png

# Clean up
agent-browser --session site1 close
agent-browser --session site2 close
```

### Wait Strategies

```bash
# Wait for element
agent-browser wait ".loading" hidden     # Wait for loading to disappear
agent-browser wait "text=Ready"          # Wait for text to appear

# Wait for URL
agent-browser wait url "**/success"

# Wait for network idle (all requests complete)
agent-browser wait networkidle

# Wait with timeout
agent-browser wait ".slow-element" --timeout 30000

# Custom condition
agent-browser wait fn "() => document.querySelectorAll('.item').length >= 10"
```

### Extracting Structured Data

```bash
# Get JSON output for parsing
agent-browser --json get text ".product" | jq '.value'
agent-browser --json snapshot -i > snapshot.json

# Extract multiple attributes
agent-browser get attr ".product-link" href
agent-browser get text ".product-title"
agent-browser get text ".product-price"
```
