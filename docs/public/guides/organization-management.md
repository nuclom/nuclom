# Organization Management

Organizations are the foundation of your Nuclom experience. This guide covers everything you need to know about creating, managing, and optimizing your organizations.

## What You'll Learn

- Understanding organization structure and hierarchy
- Creating and configuring organizations
- Managing organization settings and permissions
- Organizing content with channels and series
- Organization switching and navigation
- Best practices for organization organization

## Understanding Organizations

### What is a Organization?

A organization is a dedicated environment for your video collaboration. Each organization:

- Contains all your videos, channels, and series
- Has its own set of members and permissions
- Maintains separate settings and preferences
- Provides isolated collaboration space

### Organization Types

**Personal Organizations**

- Created automatically with your account
- Perfect for individual projects
- Can be shared with specific team members
- Ideal for testing and personal content

**Team Organizations**

- Designed for collaborative work
- Multiple members with different roles
- Advanced permission management
- Suitable for departments or projects

**Organization Organizations**

- Enterprise-level collaboration
- Advanced security and compliance features
- Centralized member management
- Audit trails and analytics

## Creating a Organization

### Step 1: Access Organization Creation

1. Click the **organization switcher** in the top navigation
2. Select **"Create Organization"** from the dropdown
3. Or use the command bar: **⌘K** → type "create organization"

### Step 2: Basic Information

**Organization Name**

- Choose a descriptive name (e.g., "Marketing Team 2025")
- Can be changed later in settings
- Visible to all organization members

**Organization Slug**

- Creates your organization URL: `nuclom.com/your-slug`
- Must be unique across all of Nuclom
- Use lowercase letters, numbers, and hyphens only
- Cannot be changed after creation

**Description** (Optional)

- Explain the organization purpose
- Helps team members understand the organization scope
- Visible on the organization homepage

### Step 3: Initial Setup

**Organization Type**

- **Team** - For collaborative work (recommended)
- **Personal** - For individual use

**Privacy Settings**

- **Private** - Only invited members can access
- **Internal** - Anyone in your organization can request access
- **Public** - Anyone can discover and request access

**Default Permissions**

- Set default permissions for new members
- Can be adjusted later in organization settings

## Organization Structure

### Hierarchical Organization

```
Organization
├── Videos (all videos in the organization)
├── Channels (topical organization)
│   ├── Marketing Videos
│   ├── Product Demos
│   └── Training Materials
├── Series (sequential organization)
│   ├── Onboarding Series
│   ├── Feature Tutorials
│   └── Weekly Updates
└── Members (organization access)
    ├── Owners
    ├── Admins
    └── Members
```

### Content Organization

**Videos**

- Primary content in your organization
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

## Managing Organization Settings

### Accessing Settings

1. Navigate to your organization
2. Click **Settings** in the navigation menu
3. Or use command bar: **⌘K** → "settings"

### General Settings

**Basic Information**

- **Name** - Update organization name
- **Description** - Modify organization description
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

1. Go to **Channels** in your organization
2. Click **"Create Channel"**
3. Enter channel name and description
4. Set channel privacy (if different from organization)
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

1. Navigate to **Series** in your organization
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

## Organization Switching

### Using the Organization Switcher

The organization switcher in the top navigation allows you to:

- **View all organizations** - See all organizations you have access to
- **Switch between organizations** - Click to navigate to different organization
- **Create new organizations** - Quick access to organization creation
- **Search organizations** - Find specific organizations quickly

### Keyboard Navigation

**Quick Switching**

- **⌘1-9** - Switch to recent organizations
- **⌘⇧W** - Open organization switcher
- **⌘K** → "switch to [organization name]" - Switch via command bar

### Recent Organizations

Nuclom remembers your recently visited organizations:

- Accessible from the organization switcher
- Keyboard shortcuts for quick access
- Automatically updated based on usage

## Best Practices

### Naming Conventions

**Organization Names**

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
Marketing Organization
├── Campaigns Channel
├── Social Media Channel
├── Analytics Channel
└── Brand Guidelines Series
```

**By Project**

```
Project Alpha Organization
├── Development Updates Channel
├── User Testing Channel
├── Launch Preparation Series
└── Post-Launch Analysis Series
```

**By Content Type**

```
Training Organization
├── New Employee Onboarding Series
├── Software Training Channel
├── Compliance Training Channel
└── Leadership Development Series
```

### Permission Management

**Role-Based Access**

- **Owners** - Full control over organization
- **Admins** - Manage content and members
- **Members** - Create and view content
- **Viewers** - View-only access

**Content-Specific Permissions**

- Channel-level permissions
- Series-level permissions
- Video-level permissions
- Comment and collaboration permissions

## Advanced Features

### Organization Analytics

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
- Google Organization integration
- Custom identity providers

**API Access**

- REST API for custom integrations
- Webhook support for real-time updates
- Bulk operations and automation

### Backup and Export

**Data Export**

- Export video metadata
- Download all organization content
- Migration tools for platform changes

**Backup Options**

- Automatic cloud backups
- Manual backup creation
- Restoration procedures

## Troubleshooting

### Common Issues

**Cannot Create Organization**

- Check if you have permission to create organizations
- Verify organization slug is unique
- Ensure you're not at organization limit

**Missing Videos or Channels**

- Verify you're in the correct organization
- Check permission settings
- Review channel/series filters

**Organization Not Loading**

- Clear browser cache and cookies
- Check internet connection
- Try different browser or incognito mode

### Getting Help

**In-App Support**

- Use the command bar to search for help
- Check organization settings for diagnostic information
- Access help documentation directly

**Contact Support**

- Email: support@nuclom.com
- Include organization slug and specific issue details
- Provide screenshots if relevant

---

**Next:** [Video Organization Guide](video-organization.md)

_Need help with organization management? Check our [Troubleshooting Guide](troubleshooting.md) or contact support._
