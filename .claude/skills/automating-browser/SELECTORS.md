# Selector Guide

How to target elements in agent-browser.

## Selector Priority

Always prefer selectors in this order:

1. **Refs** (`@e1`, `@e2`) - Most reliable, from snapshot output
2. **Semantic locators** - Accessible and stable
3. **CSS selectors** - When refs unavailable
4. **XPath** - Complex traversals only

---

## Element References (Refs)

Refs are the recommended way to target elements. They're assigned by `snapshot` and are deterministic within a session.

```bash
# Get refs from snapshot
agent-browser snapshot -i
# Output:
# button @e1 "Cancel"
# button @e2 "Submit"
# input @e3 placeholder="Email"

# Use refs in commands
agent-browser click @e2
agent-browser fill @e3 "user@example.com"
```

**Benefits:**
- Deterministic and unique
- Won't break when page structure changes
- AI-friendly (easy to parse from snapshot)

**Limitation:**
- Only valid for current page state
- Run `snapshot` again after navigation or major page changes

---

## Semantic Locators

Target elements by accessible attributes. More stable than CSS.

### By Role
```bash
agent-browser click "role=button"
agent-browser click "role=link"
agent-browser click "role=checkbox"
agent-browser click "role=textbox"
```

### By Label
```bash
agent-browser fill "label=Email" "user@example.com"
agent-browser fill "label=Password" "secret"
agent-browser click "label=Remember me"
```

### By Placeholder
```bash
agent-browser fill "placeholder=Search..." "query"
agent-browser fill "placeholder=Enter your email" "a@b.com"
```

### By Alt Text (Images)
```bash
agent-browser click "alt=Company Logo"
```

### By Title
```bash
agent-browser click "title=Close dialog"
```

### By Test ID
```bash
agent-browser click "testid=submit-button"
agent-browser fill "testid=email-input" "test@example.com"
```

---

## Text-Based Selectors

Match elements by visible text.

### Exact Text
```bash
agent-browser click "text=Submit"
agent-browser click "text=Sign In"
```

### Partial Text
```bash
agent-browser click "text=Learn more"
agent-browser click "text=Accept cookies"
```

### Case-Insensitive
```bash
agent-browser click "text=SUBMIT"    # Matches "Submit", "submit", etc.
```

---

## CSS Selectors

Standard CSS selectors work when refs aren't available.

### By ID
```bash
agent-browser click "#submit-button"
agent-browser fill "#email" "user@example.com"
```

### By Class
```bash
agent-browser click ".btn-primary"
agent-browser get text ".error-message"
```

### By Tag
```bash
agent-browser click "button"
agent-browser get text "h1"
```

### Combined
```bash
agent-browser click "button.primary"
agent-browser fill "input[type=email]" "user@example.com"
agent-browser click "form#login button[type=submit]"
```

### Child/Descendant
```bash
agent-browser click ".modal > button"           # Direct child
agent-browser click ".form-group input"         # Any descendant
agent-browser click "nav a:first-child"         # First link in nav
```

### Attribute Selectors
```bash
agent-browser click "[data-action=submit]"
agent-browser fill "[name=email]" "user@example.com"
agent-browser click "[href*=login]"             # Contains "login"
agent-browser click "[class^=btn-]"             # Starts with "btn-"
```

### Pseudo-Selectors
```bash
agent-browser click "button:first-child"
agent-browser click "li:nth-child(3)"
agent-browser click "input:not([disabled])"
agent-browser get text "tr:last-child td"
```

---

## XPath Selectors

For complex traversals. Prefix with `xpath=`.

```bash
agent-browser click "xpath=//button[contains(text(), 'Submit')]"
agent-browser click "xpath=//div[@class='modal']//button"
agent-browser get text "xpath=//table/tbody/tr[1]/td[2]"
agent-browser click "xpath=//input[@type='checkbox']/parent::label"
```

**When to use XPath:**
- Navigate to parent elements
- Complex text matching
- Positional selection in tables
- When CSS can't express the query

---

## Combining Selectors

### Chaining
```bash
# Click button inside specific container
agent-browser click ".modal >> button.submit"
```

### Multiple Matches
```bash
# Get count of matching elements
agent-browser get count ".list-item"

# Click nth match
agent-browser click ".list-item >> nth=2"
```

---

## Best Practices

| Do | Don't |
|----|-------|
| Use refs from snapshot | Hardcode brittle CSS paths |
| Prefer semantic locators | Use deeply nested selectors |
| Use `testid` for testing | Rely on auto-generated classes |
| Wait for elements | Assume elements exist |

### Resilient Selector Strategy

```bash
# 1. Get snapshot
agent-browser snapshot -i --json

# 2. Find target in output, note the ref
# Example output: button @e5 "Submit Order"

# 3. Use the ref
agent-browser click @e5
```

### Fallback Pattern

When ref isn't available:

```bash
# Try semantic first
agent-browser click "label=Submit Order"

# Then text
agent-browser click "text=Submit Order"

# Then testid
agent-browser click "testid=submit-order"

# Last resort: CSS
agent-browser click "#order-form button[type=submit]"
```
