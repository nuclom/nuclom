# AI/LLM Documentation Instructions

This file contains specific instructions for AI/LLM systems when working with the project documentation.

## General Principles

1. **Always read before writing** - Check existing documentation before making changes
2. **Maintain consistency** - Follow established formats and structures
3. **Cross-reference** - Link related documentation sections
4. **Verify accuracy** - Check code when documenting technical details
5. **Use clear language** - Write for both humans and AI systems

## Before Making Changes

1. **Read the main README** in the docs folder
2. **Check existing files** in the relevant section
3. **Understand the current structure** and organization
4. **Look for related documentation** that might need updates

## Documentation Standards

### Format
- Use Markdown for all documentation
- Include clear headings and structure
- Use code blocks for examples
- Add links to related files and code

### Content
- Start with a brief overview
- Include prerequisites where applicable
- Provide step-by-step instructions
- Add troubleshooting information
- Include code examples

### Updates
- Update multiple related files when making changes
- Keep table of contents current
- Test examples and instructions
- Update cross-references and links

## Section-Specific Instructions

### API Documentation (`docs/api/`)
- Verify endpoints exist in the codebase
- Include request/response examples
- Document all parameters and types
- Update schemas when models change

### Guides (`docs/guides/`)
- Use step-by-step format
- Include prerequisites
- Provide working code examples
- Add troubleshooting tips

### Reference (`docs/reference/`)
- Extract information from actual code
- Use consistent formatting
- Include default values
- Link to source code

### Architecture (`docs/architecture/`)
- Create diagrams when helpful
- Document decisions with rationale
- Include context and trade-offs
- Update with major system changes

## File Naming

- Use lowercase with hyphens: `getting-started.md`
- Be descriptive: `database-schema.md` not `db.md`
- Group related files in subdirectories
- Use README.md for section overviews

## When to Update Documentation

- When adding new features
- When changing APIs or interfaces
- When fixing bugs that affect usage
- When updating dependencies
- When changing deployment procedures
- When making architectural decisions

## Quality Checklist

Before completing documentation updates:

- [ ] Read existing documentation
- [ ] Verify technical accuracy
- [ ] Test code examples
- [ ] Update cross-references
- [ ] Check formatting and links
- [ ] Update table of contents
- [ ] Consider related sections that need updates
