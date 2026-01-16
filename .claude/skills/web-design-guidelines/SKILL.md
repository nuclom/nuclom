---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices". Covers accessibility, focus states, forms, animation, typography, images, performance, navigation, dark mode, touch, and i18n.
argument-hint: <file-or-pattern>
metadata:
  author: vercel
  version: "1.0.0"
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines. This skill audits UI code for 100+ rules covering accessibility, performance, and UX.

## Categories Covered

- **Accessibility** - aria-labels, semantic HTML, keyboard handlers
- **Focus States** - visible focus, focus-visible patterns
- **Forms** - autocomplete, validation, error handling
- **Animation** - prefers-reduced-motion, compositor-friendly transforms
- **Typography** - curly quotes, ellipsis, tabular-nums
- **Images** - dimensions, lazy loading, alt text
- **Performance** - virtualization, layout thrashing, preconnect
- **Navigation & State** - URL reflects state, deep-linking
- **Dark Mode & Theming** - color-scheme, theme-color meta
- **Touch & Interaction** - touch-action, tap-highlight
- **Locale & i18n** - Intl.DateTimeFormat, Intl.NumberFormat

## How It Works

1. Fetch the latest guidelines from the source URL below
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

Fetch fresh guidelines before each review:

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

Use WebFetch to retrieve the latest rules. The fetched content contains all the rules and output format instructions.

## Usage

When a user provides a file or pattern argument:
1. Fetch guidelines from the source URL above
2. Read the specified files
3. Apply all rules from the fetched guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.

## Quick Reference Rules

These are the most commonly applicable rules for React/Next.js applications:

### Accessibility

- All interactive elements must have accessible names (aria-label or visible text)
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<article>`)
- Images require alt text (empty `alt=""` for decorative images)
- Form inputs need associated labels
- Color contrast must meet WCAG AA (4.5:1 for text, 3:1 for large text)
- Keyboard navigation must work for all interactive elements

### Focus States

```css
/* Always visible focus indicator */
:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

/* Remove default but only when using mouse */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Forms

- Use `autocomplete` attribute for common fields (name, email, tel, address)
- Show validation errors inline, not just on submit
- Mark required fields clearly
- Provide helpful error messages, not just "Invalid input"

### Animation

```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Use compositor-friendly properties */
.animated {
  /* Good: GPU-accelerated */
  transform: translateX(100px);
  opacity: 0.5;

  /* Avoid: triggers layout/paint */
  /* left: 100px; */
  /* width: 200px; */
}
```

### Typography

- Use curly quotes (" " ' ') not straight quotes (" ')
- Use proper ellipsis character (...) not three periods (...)
- Use `tabular-nums` for numbers in tables/columns
- Set appropriate `line-height` (1.5 for body text)

### Images

```tsx
// Always specify dimensions to prevent layout shift
<Image
  src="/photo.jpg"
  alt="Description of the image"
  width={800}
  height={600}
  loading="lazy" // Default in Next.js Image
/>

// Decorative images
<Image src="/decoration.svg" alt="" aria-hidden="true" />
```

### Performance

- Use virtualization for lists > 100 items
- Avoid layout thrashing (batch DOM reads, then writes)
- Preconnect to required origins

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="dns-prefetch" href="https://analytics.example.com" />
```

### Navigation & State

- URL should reflect current state (filters, pagination, selections)
- Support deep linking to specific states
- Use `router.push` with shallow routing for UI state

```tsx
// URL reflects filter state
const handleFilter = (filter: string) => {
  router.push(`?filter=${filter}`, { shallow: true })
}
```

### Dark Mode

```css
/* Support system preference */
:root {
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a1a;
    --text: #ffffff;
  }
}
```

```html
<!-- Update theme-color for mobile browsers -->
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)" />
```

### Touch & Interaction

```css
/* Disable tap highlight on mobile */
button {
  -webkit-tap-highlight-color: transparent;
}

/* Prevent scroll interference */
.horizontal-scroll {
  touch-action: pan-x;
}

/* Minimum touch target size (44x44px) */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}
```

### Locale & i18n

```typescript
// Use Intl APIs for formatting
const formatDate = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)

const formatCurrency = (amount: number, locale: string, currency: string) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(amount)

// Don't hardcode date/number formats
// Bad: `${date.getMonth()}/${date.getDate()}/${date.getFullYear()}`
// Good: formatDate(date, 'en-US')
```

## Output Format

When reporting issues, use this format:

```
file.tsx:42 - Missing alt text on image
file.tsx:87 - Button missing accessible name
file.css:15 - Missing prefers-reduced-motion media query
```

Group by severity:
1. **Critical** - Accessibility blockers, broken functionality
2. **Warning** - Best practice violations, potential issues
3. **Suggestion** - Enhancements, optimizations

## See Also

- [Web Interface Guidelines](https://rauno.me/interfaces)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
