# Workspace Management

Workspaces are the foundation of your Nuclom experience. This guide covers everything you need to know about creating, managing, and optimizing your workspaces.

## What You'll Learn

- Understanding workspace structure and hierarchy
- Creating and configuring workspaces
- Managing workspace settings and permissions
- Organizing content with channels and series
- Workspace switching and navigation
- Best practices for workspace organization

## Understanding Workspaces

### What is a Workspace?

A workspace is a dedicated environment for your video collaboration. Each workspace:
- Contains all your videos, channels, and series
- Has its own set of members and permissions
- Maintains separate settings and preferences
- Provides isolated collaboration space

### Workspace Types

**Personal Workspaces**
- Created automatically with your account
- Perfect for individual projects
- Can be shared with specific team members
- Ideal for testing and personal content

**Team Workspaces**
- Designed for collaborative work
- Multiple members with different roles
- Advanced permission management
- Suitable for departments or projects

**Organization Workspaces**
- Enterprise-level collaboration
- Advanced security and compliance features
- Centralized member management
- Audit trails and analytics

## Creating a Workspace

### Step 1: Access Workspace Creation

1. Click the **workspace switcher** in the top navigation
2. Select **"Create Workspace"** from the dropdown
3. Or use the command bar: **⌘K** → type "create workspace"

### Step 2: Basic Information

**Workspace Name**
- Choose a descriptive name (e.g., "Marketing Team 2025")
- Can be changed later in settings
- Visible to all workspace members

**Workspace Slug**
- Creates your workspace URL: `nuclom.com/your-slug`
- Must be unique across all of Nuclom
- Use lowercase letters, numbers, and hyphens only
- Cannot be changed after creation

**Description** (Optional)
- Explain the workspace purpose
- Helps team members understand the workspace scope
- Visible on the workspace homepage

### Step 3: Initial Setup

**Workspace Type**
- **Team** - For collaborative work (recommended)
- **Personal** - For individual use

**Privacy Settings**
- **Private** - Only invited members can access
- **Internal** - Anyone in your organization can request access
- **Public** - Anyone can discover and request access

**Default Permissions**
- Set default permissions for new members
- Can be adjusted later in workspace settings

## Workspace Structure

### Hierarchical Organization

```
Workspace
├── Videos (all videos in the workspace)
├── Channels (topical organization)
│   ├── Marketing Videos
│   ├── Product Demos
│   └── Training Materials
├── Series (sequential organization)
│   ├── Onboarding Series
│   ├── Feature Tutorials
│   └── Weekly Updates
└── Members (workspace access)
    ├── Owners
    ├── Admins
    └── Members
```

### Content Organization

**Videos**
- Primary content in your workspace
- Can belong to channels and series
- Searchable by title, description, and transcript

**Channels**
- Group videos by topic or project
- Similar to folders or categories
- Help organize content logically

**Series**
- Sequential video content
- Maintain viewing order
- Perfect for tutorials or ongoing projects

## Managing Workspace Settings

### Accessing Settings

1. Navigate to your workspace
2. Click **Settings** in the navigation menu
3. Or use command bar: **⌘K** → "settings"

### General Settings

**Basic Information**
- **Name** - Update workspace name
- **Description** - Modify workspace description
- **Slug** - Cannot be changed after creation

**Visibility**
- **Private** - Invitation only
- **Internal** - Organization members can request access
- **Public** - Anyone can discover and request access

### Video Settings

**Upload Defaults**
- **Default channel** - Auto-assign new videos to a channel
- **Quality settings** - Default video processing quality
- **Transcription** - Enable/disable automatic transcription
- **AI Summary** - Enable/disable AI-generated summaries

**Playback Settings**
- **Default quality** - Set initial playback quality
- **Auto-play** - Enable/disable auto-play for series
- **Comments** - Enable/disable commenting by default

### Security Settings

**Access Control**
- **Two-factor authentication** - Require 2FA for all members
- **Session timeout** - Automatic logout after inactivity
- **IP restrictions** - Limit access to specific IP ranges

**Content Protection**
- **Download permissions** - Allow/restrict video downloads
- **Watermarking** - Add watermarks to videos
- **Screen recording detection** - Alert when screen recording is detected

## Channels and Series

### Creating Channels

**Via Main Navigation**
1. Go to **Channels** in your workspace
2. Click **"Create Channel"**
3. Enter channel name and description
4. Set channel privacy (if different from workspace)
5. Click **"Create"**

**Via Command Bar**
1. Press **⌘K**
2. Type "create channel"
3. Follow the prompts

### Channel Management

**Channel Settings**
- **Name and description** - Update channel information
- **Privacy** - Public, private, or restricted
- **Permissions** - Who can add videos to the channel
- **Moderation** - Review requirements for new videos

**Adding Videos to Channels**
- During upload process
- From video settings page
- Bulk operations from video list

### Creating Series

**Series Setup**
1. Navigate to **Series** in your workspace
2. Click **"Create Series"**
3. Enter series name and description
4. Set series order (manual or automatic)
5. Add initial videos or leave empty

**Series Organization**
- **Manual ordering** - Drag and drop videos
- **Automatic ordering** - Sort by date, title, or custom criteria
- **Series progression** - Track viewer progress through series

### Managing Series

**Adding Videos**
- Drag videos from the video list
- Use the "Add to Series" option in video settings
- Bulk add from search results

**Series Settings**
- **Auto-advance** - Automatically play next video
- **Progress tracking** - Monitor viewer completion
- **Completion certificates** - Generate certificates for series completion

## Workspace Switching

### Using the Workspace Switcher

The workspace switcher in the top navigation allows you to:
- **View all workspaces** - See all workspaces you have access to
- **Switch between workspaces** - Click to navigate to different workspace
- **Create new workspaces** - Quick access to workspace creation
- **Search workspaces** - Find specific workspaces quickly

### Keyboard Navigation

**Quick Switching**
- **⌘1-9** - Switch to recent workspaces
- **⌘⇧W** - Open workspace switcher
- **⌘K** → "switch to [workspace name]" - Switch via command bar

### Recent Workspaces

Nuclom remembers your recently visited workspaces:
- Accessible from the workspace switcher
- Keyboard shortcuts for quick access
- Automatically updated based on usage

## Best Practices

### Naming Conventions

**Workspace Names**
- Use descriptive, specific names
- Include team/department/project information
- Example: "Marketing Team 2025", "Product Engineering"

**Channel Names**
- Be specific about content type
- Use consistent naming patterns
- Example: "Weekly Updates", "Feature Demos", "Bug Reports"

**Series Names**
- Indicate content sequence or progression
- Include version numbers if applicable
- Example: "Onboarding v2.0", "Q1 2025 Updates"

### Organization Strategies

**By Department**
```
Marketing Workspace
├── Campaigns Channel
├── Social Media Channel
├── Analytics Channel
└── Brand Guidelines Series
```

**By Project**
```
Project Alpha Workspace
├── Development Updates Channel
├── User Testing Channel
├── Launch Preparation Series
└── Post-Launch Analysis Series
```

**By Content Type**
```
Training Workspace
├── New Employee Onboarding Series
├── Software Training Channel
├── Compliance Training Channel
└── Leadership Development Series
```

### Permission Management

**Role-Based Access**
- **Owners** - Full control over workspace
- **Admins** - Manage content and members
- **Members** - Create and view content
- **Viewers** - View-only access

**Content-Specific Permissions**
- Channel-level permissions
- Series-level permissions
- Video-level permissions
- Comment and collaboration permissions

## Advanced Features

### Workspace Analytics

**Usage Statistics**
- Video view counts and engagement
- Member activity and participation
- Content performance metrics
- Storage usage and optimization

**Reporting**
- Custom reports for stakeholders
- Scheduled report delivery
- Export options for external analysis

### Integration Options

**Single Sign-On (SSO)**
- SAML 2.0 support
- Active Directory integration
- Google Workspace integration
- Custom identity providers

**API Access**
- REST API for custom integrations
- Webhook support for real-time updates
- Bulk operations and automation

### Backup and Export

**Data Export**
- Export video metadata
- Download all workspace content
- Migration tools for platform changes

**Backup Options**
- Automatic cloud backups
- Manual backup creation
- Restoration procedures

## Troubleshooting

### Common Issues

**Cannot Create Workspace**
- Check if you have permission to create workspaces
- Verify workspace slug is unique
- Ensure you're not at workspace limit

**Missing Videos or Channels**
- Verify you're in the correct workspace
- Check permission settings
- Review channel/series filters

**Workspace Not Loading**
- Clear browser cache and cookies
- Check internet connection
- Try different browser or incognito mode

### Getting Help

**In-App Support**
- Use the command bar to search for help
- Check workspace settings for diagnostic information
- Access help documentation directly

**Contact Support**
- Email: support@nuclom.com
- Include workspace slug and specific issue details
- Provide screenshots if relevant

---

**Next:** [Video Organization Guide](video-organization.md)

*Need help with workspace management? Check our [Troubleshooting Guide](troubleshooting.md) or contact support.*
