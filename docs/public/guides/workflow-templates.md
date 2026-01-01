# Video Workflow Templates

Workflow templates help you streamline video processing by applying pre-configured settings automatically. Use templates to ensure consistent AI processing, subtitle generation, and sharing settings across your videos.

## Overview

Workflow templates define:
- **AI Processing** - Transcription, summaries, chapters, action items
- **Subtitle Languages** - Which languages to generate subtitles for
- **Sharing Settings** - Auto-generate share links with specific permissions
- **Notifications** - Alert team members when processing completes
- **Custom Prompts** - Tailor AI output to your specific needs

---

## Built-in Templates

Nuclom includes six pre-built templates optimized for common use cases:

### Meeting Recap

Perfect for team meetings, standups, and client calls.

**Features:**
- Extracts action items with owners
- Identifies key decisions
- Creates chapter markers for topics
- Single language subtitles (English)

**Best for:** Internal meetings, client calls, standups, retrospectives

### Tutorial / How-To

Optimized for step-by-step instructional content.

**Features:**
- Chapter detection for steps
- Code snippet detection
- Multi-language subtitles (5 languages)
- Summary focused on learning objectives

**Best for:** Software tutorials, how-to guides, educational content

### Product Demo

Designed for promotional and sales content.

**Features:**
- Feature highlights in chapters
- Auto-generated share link (30 days)
- Marketing-friendly summaries
- Call-to-action extraction

**Best for:** Sales demos, feature walkthroughs, product launches

### Training Session

Comprehensive template for educational content.

**Features:**
- Learning objectives extraction
- Exercise and homework detection
- 8 language subtitle support
- Code snippet detection

**Best for:** Employee training, courses, workshops

### Team Onboarding

Welcome videos for new team members.

**Features:**
- Setup task extraction
- Resource list detection
- Auto-shareable with view access
- Chapter markers for topics

**Best for:** Welcome videos, process documentation, orientation content

### Marketing Content

Promotional videos for external sharing.

**Features:**
- SEO-optimized summaries
- 5 language subtitles
- Auto-share enabled
- Hashtag suggestions

**Best for:** Social media, promotional videos, announcements

---

## Using Templates

### When Uploading

1. Click **New Video** in your dashboard
2. Select or drag your video file
3. Choose a **Workflow Template** from the dropdown
4. The template settings will be applied automatically
5. Click **Upload** to start processing

### Apply to Existing Video

1. Open the video you want to process
2. Click the **Settings** icon (gear)
3. Select **Apply Template**
4. Choose your template
5. Confirm to start processing

### View Applied Template

1. Open a video
2. Click **Video Info** or check the sidebar
3. The template used is shown under **Workflow**

---

## Creating Custom Templates

Create templates tailored to your team's specific needs.

### Step 1: Access Template Settings

1. Go to **Settings** > **Workflow Templates**
2. Click **Create Template**

### Step 2: Configure Settings

**Basic Information:**
- **Name** - Descriptive template name
- **Description** - What this template is for
- **Type** - Category (meeting, tutorial, demo, etc.)
- **Icon** - Visual identifier

**AI Processing:**
- **Auto-transcribe** - Generate transcript automatically
- **Generate summary** - Create AI summary
- **Extract chapters** - Detect key moments
- **Extract action items** - Find tasks and to-dos
- **Detect code snippets** - Identify code blocks

**Subtitles:**
- Select languages for automatic subtitle generation
- Available: English, Spanish, French, German, Portuguese, Japanese, Chinese, Korean, and more

**Sharing:**
- **Auto-share** - Create share link on processing complete
- **Access level** - View, comment, or download
- **Expiration** - Days until link expires

**Notifications:**
- **Notify on complete** - Send notification when processing finishes

**Custom Prompts:**
- **Summary prompt** - Customize how summaries are generated
- **Action items prompt** - Customize action item extraction

### Step 3: Save Template

Click **Save Template** to make it available for your organization.

---

## Template Settings Reference

### AI Processing Options

| Setting | Description | Default |
|---------|-------------|---------|
| `autoTranscribe` | Generate transcript from audio | `true` |
| `generateSummary` | Create AI-powered summary | `true` |
| `extractChapters` | Detect chapter markers | `true` |
| `extractActionItems` | Find tasks and action items | Varies |
| `detectCodeSnippets` | Identify code in video | `false` |

### Subtitle Languages

Available languages:
- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Portuguese (pt)
- Japanese (ja)
- Chinese (zh)
- Korean (ko)
- Italian (it)
- Dutch (nl)

### Auto-Share Settings

| Setting | Description | Options |
|---------|-------------|---------|
| `enabled` | Auto-create share link | `true` / `false` |
| `accessLevel` | Permission level | `view`, `comment`, `download` |
| `expiresInDays` | Link expiration | Number or `null` (never) |

### Custom Prompts

Customize AI behavior with specific instructions:

**Summary Prompt Example:**
```
Generate a meeting summary that includes:
1. Key decisions made
2. Action items with owners
3. Topics discussed
4. Next steps and deadlines
```

**Action Items Prompt Example:**
```
Extract all action items, including:
- The specific task
- Who is responsible
- Due date if mentioned
- Priority if indicated
```

---

## API Reference

### List Templates

```
GET /api/workflow-templates
```

Query parameters:
- `organizationId` - Filter by organization
- `type` - Filter by template type
- `system` - Include system templates (`true`/`false`)

### Get Template

```
GET /api/workflow-templates/:id
```

### Create Template

```
POST /api/workflow-templates
```

Body:
```json
{
  "name": "My Custom Template",
  "description": "For weekly team updates",
  "type": "meeting_recap",
  "icon": "Users",
  "organizationId": "org_xxx",
  "config": {
    "autoTranscribe": true,
    "generateSummary": true,
    "extractChapters": true,
    "extractActionItems": true,
    "subtitleLanguages": ["en", "es"]
  }
}
```

### Update Template

```
PATCH /api/workflow-templates/:id
```

### Delete Template

```
DELETE /api/workflow-templates/:id
```

### Apply Template

```
POST /api/workflow-templates/:id
```

Increments usage count and returns template config.

---

## Best Practices

### Template Naming

- Use descriptive names: "Weekly Sales Call" vs "Template 1"
- Include the use case: "Product Demo - Short Form"
- Add version if iterating: "Onboarding v2"

### Subtitle Strategy

- Start with your primary audience language
- Add languages based on viewer demographics
- More languages = longer processing time

### Custom Prompts

- Be specific about what you want extracted
- Include formatting preferences
- Test prompts with sample videos first

### Share Settings

- Use expiration for sensitive content
- Choose minimum access level needed
- Consider password protection for confidential videos

---

## Troubleshooting

### Template not applying

- Ensure you have the correct organization selected
- Check that the template is active
- Verify processing credits are available

### Custom prompts not working

- Prompts should be clear and specific
- Avoid conflicting instructions
- Test with shorter videos first

### Missing features in output

- Some features require longer videos
- Code detection needs visible code
- Action items require spoken tasks

---

*Last Updated: January 2026*
