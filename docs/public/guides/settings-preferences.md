# Settings and Preferences Guide

Customize your Nuclom experience with the comprehensive settings and preferences system. This guide covers personal settings, organization configuration, security options, and advanced customization features.

## What You'll Learn

- Personal account settings and preferences
- Organization configuration and management
- Security and privacy settings
- Notification management
- Advanced customization options
- Integration and API settings

## Personal Settings

### Account Information

#### Profile Management

**Basic Profile**

1. Navigate to **Settings** → **Profile**
2. Update your display name
3. Add or change profile picture
4. Set your timezone
5. Update contact information

**Profile Picture**

- **Upload custom image** - JPG, PNG, or GIF (max 5MB)
- **Use Gravatar** - Automatically sync with Gravatar
- **Generated avatar** - Use initials-based avatar
- **Remove picture** - Return to default avatar

**Display Preferences**

- **Display name** - How others see you in comments and mentions
- **Username** - Unique identifier for @mentions
- **Email visibility** - Control who can see your email
- **Profile visibility** - Public, organization members only, or private

#### Account Security

**Password Management**

1. Go to **Settings** → **Security**
2. Click **"Change Password"**
3. Enter current password
4. Set new password (8+ characters, mixed case, numbers)
5. Confirm password change

**Password Requirements**

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Special characters recommended

**Two-Factor Authentication (2FA)**

1. Go to **Settings** → **Security**
2. Click **"Enable 2FA"**
3. Download authenticator app (Google Authenticator, Authy, 1Password)
4. Scan QR code with your authenticator app
5. Enter the 6-digit verification code
6. Save your backup codes securely (these are one-time use codes for account recovery)

**Disabling 2FA**

1. Go to **Settings** → **Security**
2. Click **"Disable 2FA"**
3. Enter a verification code from your authenticator app
4. Confirm the action

**Active Sessions**

View and manage all your active login sessions:

1. Go to **Settings** → **Security**
2. See all active sessions with device info and IP address
3. Click **"Sign out"** next to any session to revoke it
4. Use **"Sign out all other sessions"** to secure your account

### Account Settings

#### Email Management

**Changing Your Email**

1. Go to **Settings** → **Account**
2. Click **"Change Email"**
3. Enter your new email address
4. A verification email will be sent to the new address
5. Click the verification link to complete the change

#### Data Export

**Exporting Your Data (GDPR Compliance)**

1. Go to **Settings** → **Account**
2. Click **"Export Data"**
3. Your data will be downloaded as a JSON file including:
   - Profile information
   - User preferences
   - Videos you've uploaded
   - Comments you've made
   - Video watch progress
   - Notifications
   - API key metadata (without the actual keys)

#### Account Deletion

**Permanently Deleting Your Account**

1. Go to **Settings** → **Account**
2. Under "Danger Zone", click **"Delete Account"**
3. Enter your password
4. Type "delete my account" to confirm
5. Click **"Permanently Delete Account"**

**What Gets Deleted:**
- Your profile and settings
- All videos you've uploaded
- All comments you've made
- Your organization memberships
- API keys and OAuth applications

### Personal Preferences

#### Interface Customization

**Theme Settings**

- **Dark mode** - Easier on eyes in low light
- **Light mode** - Traditional bright interface
- **System** - Follow your device's theme setting
- **High contrast** - Enhanced accessibility

**Language Settings**

- **Interface language** - Choose from 20+ languages
- **Regional format** - Date, time, and number formats
- **Keyboard shortcuts** - Customize key combinations
- **Accessibility** - Screen reader and keyboard navigation support

#### Video Preferences

**Playback Settings**

- **Default quality** - Auto, 4K, 1080p, 720p, 480p
- **Auto-advance** - Automatically play next video in series
- **Playback speed** - Default speed for all videos
- **Volume level** - Remember last volume setting

**Subtitle Preferences**

- **Auto-enable subtitles** - Show subtitles by default
- **Subtitle language** - Preferred language for subtitles
- **Subtitle style** - Font, size, and color customization
- **Transcript visibility** - Show transcript panel by default

#### Collaboration Preferences

**Comment Settings**

- **Default comment visibility** - Public or private
- **Auto-watch videos** - Get notifications for videos you comment on
- **Comment formatting** - Enable markdown formatting
- **Reply notifications** - Get notified of replies to your comments

**Mention Preferences**

- **Mention notifications** - Immediate, digest, or disabled
- **Mention privacy** - Allow mentions from organization members or anyone
- **Auto-complete settings** - Show suggestions when typing @mentions

## Organization Settings

### General Configuration

#### Organization Information

**Basic Details**

1. Navigate to **Settings** → **Organization**
2. Update organization name and description
3. Set organization visibility (Private, Internal, Public)
4. Configure organization logo and branding
5. Set default language and timezone

**Organization Branding**

- **Logo upload** - Custom logo for organization (recommended: 200x200px)
- **Color scheme** - Primary and secondary colors
- **Custom domain** - Use custom domain for organization (Enterprise)
- **Favicon** - Custom favicon for browser tabs

#### Content Settings

**Upload Defaults**

- **Default video quality** - Processing quality for new uploads
- **Auto-transcription** - Enable automatic transcript generation
- **AI summaries** - Generate AI summaries for new videos
- **Default channel** - Automatically assign videos to specific channel

**Content Policies**

- **Moderation** - Require approval for new content
- **Content guidelines** - Organization-specific content standards
- **Retention policy** - Automatic archival and deletion rules
- **Duplicate detection** - Prevent duplicate video uploads

### Access and Security

#### Member Management

**Default Permissions**

- **New member role** - Default role for invited members
- **Invitation settings** - Who can invite new members
- **Self-registration** - Allow domain-based automatic registration
- **Guest access** - Enable temporary access for external users

**Access Controls**

- **IP restrictions** - Limit access to specific IP addresses
- **Geo-restrictions** - Restrict access by geographic location
- **VPN policies** - Require or block VPN usage
- **Device limitations** - Limit concurrent device access

#### Security Policies

**Authentication Requirements**

- **Two-factor authentication** - Require 2FA for all members
- **Password policy** - Enforce password complexity requirements
- **Session management** - Auto-logout after inactivity
- **Login monitoring** - Track and alert on suspicious activity

**Data Protection**

- **Encryption settings** - Enable end-to-end encryption
- **Data retention** - Configure automatic data deletion
- **Backup policies** - Regular automated backups
- **Export restrictions** - Control data export capabilities

### Advanced Organization Settings

#### API and Integrations

**API Keys**

1. Go to **Settings** → **API Keys**
2. Click **"Create API Key"**
3. Enter a name for the key (e.g., "Production API")
4. Select an expiration period (7 days, 30 days, 90 days, 1 year, or never)
5. Click **"Create Key"**
6. **Important:** Copy your API key immediately - you won't be able to see it again!

**Using API Keys**

Include your API key in the `x-api-key` header:
```
curl -X GET "https://api.nuclom.com/v1/videos" \
  -H "x-api-key: nc_your_api_key_here"
```

**Managing API Keys**

- View all API keys with their status, creation date, and last used
- See partial key previews (prefix and first few characters)
- Delete keys that are no longer needed
- Monitor key expiration dates

**API Key Features**

- **Rate Limiting:** 100 requests per minute per key
- **Key Prefix:** All keys start with `nc_`
- **Default Expiration:** 30 days (configurable)

**OAuth Applications**

Create OAuth applications to allow external services to integrate with Nuclom.

1. Go to **Settings** → **OAuth Apps**
2. Click **"Create Application"**
3. Enter the application name and optional icon URL
4. Add redirect URLs (one per line)
5. Click **"Create Application"**
6. **Important:** Copy your client ID and secret immediately!

**OAuth Application Settings**

- **Client ID:** Public identifier for your app
- **Client Secret:** Secret key for server-side authentication (only shown once)
- **Redirect URLs:** Allowed callback URLs for OAuth flow
- **Disable/Enable:** Temporarily disable apps without deleting

**OAuth 2.0 / OpenID Connect Endpoints**

- **Authorization:** `/api/auth/oauth2/authorize`
- **Token:** `/api/auth/oauth2/token`
- **Scopes:** `openid`, `profile`, `email`, `offline_access`

**Authorized Applications**

View and manage applications you've granted access to your account:

1. Go to **Settings** → **OAuth Apps**
2. Under "Authorized Applications", see all apps with access
3. Click **"Revoke"** to remove an application's access

**Available Integrations**

- **Single Sign-On (SSO)** - SAML, OAuth, Active Directory
- **Calendar integration** - Google Calendar, Outlook, Calendly
- **Project management** - Jira, Asana, Trello, Monday.com
- **Communication tools** - Slack, Microsoft Teams, Discord

**Webhook Configuration**

- **Event triggers** - Choose which events send webhooks
- **Endpoint URLs** - Configure where webhooks are sent
- **Authentication** - Set up webhook authentication
- **Retry policies** - Configure retry behavior for failed webhooks

#### Analytics and Reporting

**Organization Analytics**

- **Usage statistics** - Video views, user activity, storage usage
- **Engagement metrics** - Comments, shares, collaboration activity
- **Performance data** - Load times, error rates, user satisfaction
- **Custom reports** - Create custom analytics dashboards

**Export Options**

- **Data export** - Export organization data in various formats
- **Scheduled reports** - Automatically generate and send reports
- **API reporting** - Access analytics data via API
- **Third-party integration** - Send data to external analytics tools

## Notification Settings

### Personal Notifications

#### Email Notifications

**Notification Types**

- **Mentions** - When someone @mentions you
- **Replies** - Replies to your comments
- **Video updates** - New videos in subscribed channels
- **Organization activity** - Major organization changes

**Email Frequency**

- **Real-time** - Immediate email notifications
- **Digest** - Daily or weekly summary emails
- **Disabled** - No email notifications
- **Custom schedule** - Set specific times for notifications

#### In-App Notifications

**Desktop Notifications**

- **Browser notifications** - Push notifications in browser
- **Sound alerts** - Audio notifications for important events
- **Badge counters** - Show notification count in browser tab
- **Popup notifications** - Overlay notifications in application

**Mobile Notifications**

- **Push notifications** - Mobile app notifications
- **Notification grouping** - Group similar notifications
- **Quiet hours** - Disable notifications during specified times
- **Priority levels** - Different notification levels for different events

### Organization Notifications

#### Admin Notifications

**Member Activity**

- **New member joins** - Notify when new members join
- **Role changes** - Notify when member roles change
- **Suspicious activity** - Security alerts and warnings
- **Quota limits** - Storage and usage limit notifications

**Content Notifications**

- **New uploads** - Notify of new video uploads
- **Moderation queue** - Content requiring approval
- **Content reports** - Reported content notifications
- **Bulk operations** - Large-scale content changes

#### Team Notifications

**Collaboration Updates**

- **Project mentions** - Project-specific notifications
- **Channel activity** - New activity in subscribed channels
- **Series updates** - New videos in followed series
- **Deadline reminders** - Upcoming deadlines and due dates

**System Notifications**

- **Maintenance windows** - Scheduled maintenance notifications
- **Feature updates** - New feature announcements
- **Policy changes** - Organization policy updates
- **Performance alerts** - System performance issues

## Advanced Customization

### Interface Customization

#### Layout Options

**Organization Layout**

- **Sidebar position** - Left, right, or collapsible
- **Navigation style** - Horizontal or vertical navigation
- **Content density** - Compact, normal, or spacious
- **Panel configuration** - Customize which panels are visible

**Video Player Customization**

- **Control visibility** - Always visible, auto-hide, or minimal
- **Quality selector** - Show quality options
- **Speed controls** - Enable playback speed adjustment
- **Keyboard shortcuts** - Customize player keyboard shortcuts

#### Custom CSS

**Advanced Styling** (Enterprise)

- **Custom CSS injection** - Add custom styles to organization
- **Brand consistency** - Match your organization's design
- **Accessibility improvements** - Enhance accessibility features
- **User experience optimization** - Customize for your team's needs

### Automation Settings

#### Workflow Automation

**Content Automation**

- **Auto-tagging** - Automatically tag videos based on content
- **Smart organization** - AI-powered content categorization
- **Approval workflows** - Automated content approval processes
- **Notification automation** - Smart notification routing

**User Management Automation**

- **Role assignment** - Automatically assign roles based on criteria
- **Access provisioning** - Automatic access based on department/role
- **Deprovisioning** - Automatic access removal when members leave
- **Compliance automation** - Automated compliance checking

#### Integration Automation

**Third-Party Automation**

- **Calendar sync** - Automatically import meeting recordings
- **Project management** - Create tasks from video comments
- **Communication tools** - Auto-post updates to team channels
- **Analytics sync** - Automatically send data to analytics platforms

## Privacy and Compliance

### Privacy Settings

#### Data Privacy

**Personal Data**

- **Data collection** - Control what data is collected
- **Data sharing** - Manage data sharing with third parties
- **Data retention** - Set personal data retention periods
- **Data export** - Export your personal data

**Content Privacy**

- **Video privacy** - Default privacy settings for uploads
- **Comment privacy** - Control comment visibility
- **Sharing restrictions** - Limit who can share your content
- **Search visibility** - Control whether your content appears in search

#### Compliance Management

**Regulatory Compliance**

- **GDPR compliance** - European data protection compliance
- **CCPA compliance** - California consumer privacy compliance
- **HIPAA compliance** - Healthcare data protection (Enterprise)
- **SOC 2 compliance** - Security and availability standards

**Audit and Reporting**

- **Audit logs** - Complete activity logging
- **Compliance reports** - Regular compliance status reports
- **Data lineage** - Track data movement and access
- **Breach notification** - Automated breach detection and notification

### Security Configuration

#### Advanced Security

**Network Security**

- **SSL/TLS configuration** - Secure data transmission
- **Content Security Policy** - Prevent cross-site scripting
- **IP whitelisting** - Restrict access to approved IP addresses
- **DDoS protection** - Protect against distributed attacks

**Application Security**

- **API security** - Secure API access and authentication
- **Session security** - Secure session management
- **Input validation** - Prevent injection attacks
- **Error handling** - Secure error message handling

#### Monitoring and Alerts

**Security Monitoring**

- **Login monitoring** - Track login attempts and patterns
- **Access monitoring** - Monitor content and feature access
- **Anomaly detection** - Identify unusual behavior patterns
- **Incident response** - Automated incident response procedures

**Alert Configuration**

- **Security alerts** - Immediate notification of security events
- **Compliance alerts** - Notifications of compliance violations
- **Performance alerts** - System performance monitoring
- **Custom alerts** - Create custom alert conditions

## Troubleshooting Settings

### Common Issues

#### Settings Not Saving

**Browser Issues**

- Clear browser cache and cookies
- Disable browser extensions
- Try different browser or incognito mode
- Check JavaScript is enabled

**Network Issues**

- Check internet connection
- Verify firewall settings
- Try different network
- Contact IT support if on corporate network

#### Notification Problems

**Missing Notifications**

- Check notification settings
- Verify email address is correct
- Check spam/junk folders
- Confirm notification preferences

**Too Many Notifications**

- Adjust notification frequency
- Disable unnecessary notifications
- Use digest mode instead of real-time
- Set up notification filtering

### Settings Recovery

#### Backup and Restore

**Settings Backup**

- Export current settings
- Save to secure location
- Regular backup schedule
- Version control for settings

**Settings Restore**

- Import previously saved settings
- Restore from backup
- Reset to default settings
- Partial settings restore

#### Account Recovery

**Password Recovery**

- Use "Forgot Password" feature
- Verify email address
- Follow reset instructions
- Contact support if needed

**Account Access Issues**

- Verify account credentials
- Check 2FA settings
- Review account status
- Contact support for assistance

## Getting Help

### Support Resources

#### Self-Service Help

**Documentation**

- User guides and tutorials
- Video help library
- FAQ and troubleshooting
- Community forums

**In-App Help**

- Context-sensitive help
- Tooltips and guidance
- Search help articles
- Contact support directly

#### Contact Support

**Support Channels**

- Email support: support@nuclom.com
- Live chat (during business hours)
- Phone support (Enterprise customers)
- Community forums and discussions

**When Contacting Support**

- Describe the specific issue
- Include your organization and user details
- Attach screenshots if relevant
- Mention steps already tried

---

**Next:** [Troubleshooting Guide](troubleshooting.md)

_Need help with settings and preferences? Check our [Troubleshooting Guide](troubleshooting.md) or contact support._
