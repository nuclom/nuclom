# Analysis: Code Reviewer Agent

## Impact Assessment

### MEDIUM IMPACT - RECOMMEND IMPLEMENTING

## Summary

A dedicated code-reviewer agent provides systematic, comprehensive reviews with project-specific checklist coverage. While we have related agents (code-simplifier, refactoring-specialist), neither provides structured review with severity categorization.

## Before vs After Comparison

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| Checklist items | 5-15 (variable) | 30+ (consistent) | 2-6x coverage |
| Effect-TS checks | Sometimes | Always (8 items) | Complete coverage |
| Security checks | Minimal | 6 items always | Systematic |
| Severity levels | None | 3 levels | Prioritization |
| Fix examples | Sometimes | Always | Actionable |
| Output structure | Variable | Standardized | Predictable |

## Differentiation from Existing Agents

### code-simplifier
- **Purpose**: Simplify and clean code
- **Scope**: Recently modified code
- **Output**: Simplified code

### refactoring-specialist
- **Purpose**: Restructure and optimize
- **Scope**: Targeted improvements
- **Output**: Refactored code

### code-reviewer (NEW)
- **Purpose**: Comprehensive quality verification
- **Scope**: Full checklist coverage
- **Output**: Categorized findings with fixes

These agents complement each other:
1. Write code
2. **code-reviewer**: Verify it meets standards
3. **code-simplifier**: Clean up if needed
4. **refactoring-specialist**: Restructure if needed

## Key Benefits

### 1. Systematic Coverage
The checklist ensures nothing is forgotten:
- 8 Effect-TS checks
- 7 React checks
- 6 security checks
- 5 code quality checks

### 2. Project-Specific
Checks are tailored to Nuclom:
- Repository pattern usage
- Effect-TS patterns
- `userExtensions` table usage
- `Data.TaggedError` usage

### 3. Severity Categorization
Helps prioritize fixes:
- **Critical**: Must fix before merge
- **Warning**: Should fix
- **Suggestion**: Nice to have

### 4. Actionable Output
Every issue includes:
- File:line location
- Clear description
- Code example fix
- Why it matters

## Use Cases

### 1. Pre-Commit Review
```
[After writing code]
Let me run the code-reviewer agent to verify this follows project standards.
```

### 2. PR Review
```
/pr-review
[Invokes code-reviewer agent for comprehensive review]
```

### 3. Self-Check
```
Before I commit, let me have the code-reviewer check this endpoint.
```

### 4. Onboarding
New developers learn project patterns through review feedback.

## Potential Concerns

| Concern | Mitigation |
|---------|------------|
| Review too long | Severity helps prioritize |
| Too rigid | Agent applies judgment within checklist |
| Overlap with other agents | Clear differentiation of purpose |
| Maintenance | Checklist needs occasional updates |

## Integration with Other Recommendations

This agent works well with:
- **Recommendation 2 (/pr-review)**: Command invokes this agent
- **Recommendation 1 (auto-format)**: Review assumes code is formatted
- **Recommendation 3 (branch protection)**: Review happens on feature branches

## Recommendation

**IMPLEMENT - MEDIUM PRIORITY**

- Effort: Medium (create agent file)
- Risk: Low (adds capability, doesn't restrict)
- Benefit: Medium-High (systematic quality)

This is valuable but lower priority than hooks and commands because:
1. Existing agents provide partial coverage
2. Hooks provide more automated value
3. Commands enable the agent usage

**Implementation Order:**
1. Hooks (auto-format, branch protection) - Automatic
2. Commands (/pr-review) - User-triggered
3. Code-reviewer agent - Completes the system

## Conclusion

The code-reviewer agent fills a gap in our agent lineup. While code-simplifier and refactoring-specialist focus on transformation, code-reviewer focuses on verification. Together they form a complete code quality system.
