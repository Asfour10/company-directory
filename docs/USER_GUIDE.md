# Company Directory User Guide

## Table of Contents

- [Getting Started](#getting-started)
- [User Roles and Permissions](#user-roles-and-permissions)
- [Accessing the Directory](#accessing-the-directory)
- [Employee Directory Features](#employee-directory-features)
- [Profile Management](#profile-management)
- [Search and Discovery](#search-and-discovery)
- [Organizational Chart](#organizational-chart)
- [Admin Features](#admin-features)
- [SSO Configuration](#sso-configuration)
- [Mobile Usage](#mobile-usage)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Getting Started

### What is Company Directory?

Company Directory is a secure, multi-tenant employee directory system that helps organizations manage and discover employee information. It provides a centralized location for employee profiles, contact information, organizational structure, and team collaboration.

### Key Features

- **Employee Profiles**: Comprehensive employee information with photos, contact details, and skills
- **Advanced Search**: Fast, intelligent search across all employee data
- **Organizational Chart**: Visual representation of company hierarchy
- **Custom Fields**: Configurable fields specific to your organization
- **Multi-tenant Security**: Complete data isolation between organizations
- **SSO Integration**: Single sign-on with popular identity providers
- **Mobile Responsive**: Full functionality on desktop and mobile devices
- **Analytics Dashboard**: Usage insights and directory statistics
- **Audit Logging**: Complete audit trail of all changes

## User Roles and Permissions

### User Roles

#### **User** (Default Role)
- View all employee profiles
- Edit own profile information
- Search and browse directory
- View organizational chart
- Access mobile features

#### **Manager**
- All User permissions
- Edit direct reports' profiles
- View team analytics
- Manage team organizational structure

#### **Admin**
- All Manager permissions
- Create, edit, and deactivate any employee profile
- Bulk import/export employee data
- Manage custom fields
- View audit logs
- Access analytics dashboard
- Configure directory settings

#### **Super Admin**
- All Admin permissions
- Manage tenant branding and settings
- Configure SSO integration
- Manage billing and subscriptions
- Access system-wide analytics
- Manage user roles and permissions

### Permission Matrix

| Feature | User | Manager | Admin | Super Admin |
|---------|------|---------|-------|-------------|
| View profiles | ✅ | ✅ | ✅ | ✅ |
| Edit own profile | ✅ | ✅ | ✅ | ✅ |
| Edit direct reports | ❌ | ✅ | ✅ | ✅ |
| Edit any profile | ❌ | ❌ | ✅ | ✅ |
| Create profiles | ❌ | ❌ | ✅ | ✅ |
| Deactivate profiles | ❌ | ❌ | ✅ | ✅ |
| Bulk import | ❌ | ❌ | ✅ | ✅ |
| Custom fields | ❌ | ❌ | ✅ | ✅ |
| Audit logs | ❌ | ❌ | ✅ | ✅ |
| Analytics | ❌ | Limited | ✅ | ✅ |
| Branding | ❌ | ❌ | ❌ | ✅ |
| SSO config | ❌ | ❌ | ❌ | ✅ |
| Billing | ❌ | ❌ | ❌ | ✅ |

## Accessing the Directory

### Login Methods

#### SSO Login (Recommended)
1. Navigate to your company's directory URL: `https://yourcompany.directory-platform.com`
2. Click "Sign in with [Your SSO Provider]"
3. Complete authentication with your corporate credentials
4. You'll be automatically redirected to the directory

#### Direct Login (If Configured)
1. Navigate to your company's directory URL
2. Enter your email and password
3. Click "Sign In"

### First-Time Setup

When you first access the directory:

1. **Complete Your Profile**: Add your photo, contact information, and skills
2. **Explore the Directory**: Browse employee profiles and get familiar with the interface
3. **Try the Search**: Use the search bar to find colleagues
4. **View the Org Chart**: Understand your company's structure

## Employee Directory Features

### Directory Homepage

The main directory page displays:

- **Search Bar**: Quick access to find employees
- **Employee Grid/List**: All employees with photos and basic info
- **Filters**: Department, title, location, and other criteria
- **Sort Options**: Name, department, title, or join date
- **Pagination**: Navigate through large employee lists

### Employee Cards

Each employee card shows:
- Profile photo (if uploaded)
- Full name and preferred name
- Job title and department
- Contact information (email, phone)
- Office location
- Skills and expertise
- Manager information

### Quick Actions

From any employee card:
- **View Full Profile**: Click the card to see complete information
- **Send Email**: Click email address to compose message
- **Call**: Click phone number to initiate call (mobile)
- **View Reports**: See direct reports and team structure

## Profile Management

### Viewing Profiles

#### Your Own Profile
1. Click your name/photo in the top navigation
2. Select "My Profile" from the dropdown
3. View your complete profile information

#### Other Profiles
1. Search for or browse to find the employee
2. Click their profile card
3. View their complete profile in a modal or dedicated page

### Editing Profiles

#### Edit Your Own Profile
1. Navigate to your profile
2. Click "Edit Profile" button
3. Update any editable fields:
   - Contact information (phone, email)
   - Office location
   - Bio and skills
   - Custom fields (if configured)
4. Upload or change profile photo
5. Click "Save Changes"

#### Edit as Manager/Admin
1. Navigate to the employee's profile
2. Click "Edit Profile" (if you have permission)
3. Update allowed fields based on your role
4. Add notes or comments (admin only)
5. Save changes

### Profile Photos

#### Upload Photo
1. Go to your profile edit page
2. Click "Upload Photo" or the camera icon
3. Select an image file (JPG, PNG, max 2MB)
4. Crop and adjust as needed
5. Save changes

**Photo Guidelines:**
- Professional headshot preferred
- Clear, well-lit image
- Face should be clearly visible
- Appropriate business attire
- Maximum file size: 2MB
- Supported formats: JPG, PNG, GIF

### Custom Fields

Your organization may have configured custom fields such as:
- Employee ID
- Start date
- Department code
- Certifications
- Emergency contact
- Preferred pronouns

These fields appear in your profile and can be edited based on your permissions.

## Search and Discovery

### Basic Search

1. **Quick Search**: Type in the search bar at the top of any page
2. **Auto-complete**: Suggestions appear as you type
3. **Instant Results**: Results update in real-time
4. **Search Scope**: Searches names, titles, departments, skills, and custom fields

### Advanced Search

#### Search Filters
- **Department**: Filter by specific departments
- **Title**: Filter by job titles or roles
- **Location**: Filter by office location
- **Skills**: Filter by specific skills or expertise
- **Manager**: Filter by reporting manager

#### Search Tips
- **Partial Matching**: Type part of a name or word
- **Multiple Terms**: Use spaces to search multiple terms
- **Fuzzy Search**: System handles typos and similar spellings
- **Skill Search**: Search by technical skills or expertise areas

### Search Examples

| What you want to find | Search terms |
|----------------------|--------------|
| All engineers | "engineer" or "engineering" |
| People in marketing | "marketing" |
| JavaScript developers | "javascript" or "js" |
| People named John | "john" |
| Managers | "manager" |
| New York office | "new york" |
| People with MBA | "mba" |

### Search Results

Results show:
- **Relevance Score**: Most relevant matches first
- **Match Highlighting**: Search terms highlighted in results
- **Quick Actions**: Email, view profile, see reports
- **Pagination**: Navigate through multiple result pages

## Organizational Chart

### Viewing the Org Chart

1. Click "Org Chart" in the main navigation
2. View the hierarchical structure of your organization
3. Use zoom controls to adjust view level
4. Click on any employee to view their profile

### Org Chart Features

#### Navigation
- **Zoom In/Out**: Adjust detail level
- **Pan**: Move around large organizational structures
- **Search**: Find specific employees within the chart
- **Expand/Collapse**: Show or hide team branches

#### Employee Nodes
Each employee node displays:
- Profile photo
- Name and title
- Department
- Number of direct reports
- Quick action buttons

#### Interactive Features
- **Click to View Profile**: Click any employee for full profile
- **Expand Teams**: Click to show/hide direct reports
- **Manager Path**: See reporting chain to top of organization
- **Team View**: Focus on specific team or department

### Mobile Org Chart

On mobile devices:
- **Touch Navigation**: Pinch to zoom, swipe to pan
- **Simplified View**: Optimized layout for small screens
- **Quick Actions**: Tap for profile, email, or call
- **Search Integration**: Find and navigate to specific employees

## Admin Features

*Note: These features are only available to users with Admin or Super Admin roles.*

### Employee Management

#### Creating New Employees

1. Navigate to "Admin" → "Employee Management"
2. Click "Add New Employee"
3. Fill in required information:
   - First and last name
   - Email address
   - Job title and department
   - Manager (optional)
4. Add optional information:
   - Phone number
   - Office location
   - Skills and bio
   - Custom field values
5. Click "Create Employee"

#### Bulk Import

1. Go to "Admin" → "Bulk Import"
2. Download the CSV template
3. Fill in employee data following the template format
4. Upload the completed CSV file
5. Review validation results
6. Confirm import to create/update employees

**CSV Template Fields:**
- firstName (required)
- lastName (required)
- email (required)
- title (required)
- department (required)
- phone (optional)
- officeLocation (optional)
- managerEmail (optional)
- skills (optional, comma-separated)
- bio (optional)
- Custom fields (as configured)

#### Managing Existing Employees

1. Navigate to "Admin" → "Employee Management"
2. Find the employee using search or filters
3. Click "Edit" to modify their information
4. Click "Deactivate" to remove them from the directory
5. View "Audit History" to see all changes

### Custom Fields Management

#### Creating Custom Fields

1. Go to "Admin" → "Custom Fields"
2. Click "Add Custom Field"
3. Configure field properties:
   - **Field Name**: Internal identifier (no spaces)
   - **Display Name**: User-friendly label
   - **Field Type**: Text, Number, Date, Dropdown, Multi-select
   - **Required**: Whether field must be filled
   - **Options**: For dropdown/multi-select fields
4. Set display order
5. Click "Create Field"

#### Field Types

- **Text**: Single-line text input
- **Number**: Numeric values only
- **Date**: Date picker
- **Dropdown**: Single selection from predefined options
- **Multi-select**: Multiple selections from predefined options

#### Managing Custom Fields

- **Edit**: Modify field properties (limited after creation)
- **Reorder**: Change display order in profiles
- **Delete**: Remove field (warning: data will be lost)
- **Usage Statistics**: See how many profiles use each field

### Analytics Dashboard

#### Overview Metrics

The analytics dashboard shows:
- **Total Employees**: Current active employee count
- **Profile Completeness**: Average completion percentage
- **Active Users**: Users who logged in recently
- **Search Activity**: Number of searches performed
- **Most Viewed Profiles**: Popular employee profiles
- **Top Search Terms**: Common search queries

#### Detailed Analytics

- **User Activity**: Login patterns and usage trends
- **Search Analytics**: Query performance and popular terms
- **Profile Analytics**: View counts and update frequency
- **Department Distribution**: Employee count by department
- **Role Distribution**: Employee count by job title

#### Exporting Data

1. Select date range for analytics
2. Choose metrics to include
3. Click "Export" to download CSV report
4. Use data for reporting or analysis

### Audit Logs

#### Viewing Audit Logs

1. Navigate to "Admin" → "Audit Logs"
2. Use filters to narrow results:
   - Date range
   - User who made changes
   - Type of change (create, update, delete)
   - Specific employee affected
3. View detailed change history

#### Audit Log Information

Each log entry shows:
- **Timestamp**: When the change occurred
- **User**: Who made the change
- **Action**: Type of change (create, update, delete)
- **Entity**: What was changed (employee, custom field, etc.)
- **Field**: Specific field that was modified
- **Old Value**: Previous value
- **New Value**: New value
- **IP Address**: Where the change originated

#### Exporting Audit Logs

1. Set desired filters
2. Click "Export to CSV"
3. Download complete audit trail
4. Use for compliance or investigation purposes

### Tenant Settings

#### Branding Configuration

1. Go to "Admin" → "Tenant Settings" → "Branding"
2. Upload company logo (max 2MB, PNG/JPG)
3. Set primary brand color (hex code)
4. Set accent color for highlights
5. Preview changes
6. Save configuration

#### Data Retention Settings

1. Navigate to "Admin" → "Tenant Settings" → "Data Retention"
2. Configure retention periods:
   - Audit logs (minimum 2 years)
   - Analytics data (30 days to 7 years)
   - Inactive employee data
3. Set automatic cleanup schedules
4. Save settings

## SSO Configuration

*Note: SSO configuration requires Super Admin privileges.*

### Supported Providers

- **Azure Active Directory (Azure AD)**
- **Google Workspace (G Suite)**
- **Okta**
- **JumpCloud**
- **Generic SAML 2.0**
- **Generic OIDC/OAuth 2.0**

### Azure AD Configuration

#### In Azure AD Portal

1. Go to Azure AD → App registrations
2. Click "New registration"
3. Configure application:
   - Name: "Company Directory"
   - Redirect URI: `https://yourcompany.directory-platform.com/api/auth/sso/azure-ad/callback`
4. Note the Application (client) ID
5. Create a client secret
6. Configure API permissions (User.Read, Directory.Read.All)

#### In Company Directory

1. Go to "Admin" → "SSO Configuration"
2. Select "Azure AD" as provider
3. Enter configuration:
   - **Client ID**: From Azure AD app registration
   - **Client Secret**: From Azure AD app registration
   - **Tenant ID**: Your Azure AD tenant ID
   - **Domain**: Your organization's domain
4. Test the configuration
5. Save settings

### Google Workspace Configuration

#### In Google Cloud Console

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID
3. Configure application:
   - Application type: Web application
   - Authorized redirect URIs: `https://yourcompany.directory-platform.com/api/auth/sso/google/callback`
4. Note the Client ID and Client Secret

#### In Company Directory

1. Go to "Admin" → "SSO Configuration"
2. Select "Google Workspace" as provider
3. Enter configuration:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console
   - **Domain**: Your G Suite domain
4. Test the configuration
5. Save settings

### Okta Configuration

#### In Okta Admin Console

1. Go to Applications → Create App Integration
2. Select "OIDC - OpenID Connect"
3. Select "Web Application"
4. Configure application:
   - Name: "Company Directory"
   - Sign-in redirect URIs: `https://yourcompany.directory-platform.com/api/auth/sso/okta/callback`
   - Sign-out redirect URIs: `https://yourcompany.directory-platform.com/logout`
5. Note the Client ID and Client Secret

#### In Company Directory

1. Go to "Admin" → "SSO Configuration"
2. Select "Okta" as provider
3. Enter configuration:
   - **Client ID**: From Okta application
   - **Client Secret**: From Okta application
   - **Domain**: Your Okta domain (e.g., yourcompany.okta.com)
4. Test the configuration
5. Save settings

### SCIM Provisioning (Optional)

SCIM (System for Cross-domain Identity Management) allows automatic user provisioning and deprovisioning.

#### Enable SCIM

1. Go to "Admin" → "SSO Configuration" → "SCIM"
2. Enable SCIM provisioning
3. Note the SCIM endpoint URL and bearer token
4. Configure in your SSO provider

#### SCIM Features

- **Automatic User Creation**: New users created when added to SSO
- **Profile Updates**: Changes in SSO sync to directory
- **Deprovisioning**: Users deactivated when removed from SSO
- **Group Mapping**: Map SSO groups to directory roles

### Testing SSO

1. Open an incognito/private browser window
2. Navigate to your directory URL
3. Click "Sign in with [SSO Provider]"
4. Complete authentication flow
5. Verify successful login and profile creation

### Troubleshooting SSO

#### Common Issues

**"Invalid redirect URI"**
- Verify redirect URI matches exactly in SSO provider
- Check for trailing slashes or protocol mismatches

**"Invalid client credentials"**
- Verify Client ID and Client Secret are correct
- Check if client secret has expired

**"User not found"**
- Verify user exists in SSO provider
- Check domain restrictions
- Ensure user has necessary permissions

**"Permission denied"**
- Check API permissions in SSO provider
- Verify admin consent has been granted
- Check user assignment to application

## Mobile Usage

### Mobile Features

The Company Directory is fully responsive and provides all features on mobile devices:

- **Touch-Optimized Interface**: Designed for finger navigation
- **Responsive Design**: Adapts to all screen sizes
- **Offline Capability**: Basic functionality when offline
- **Native App Feel**: Smooth animations and transitions

### Mobile Navigation

#### Main Navigation
- **Hamburger Menu**: Access all features from collapsible menu
- **Search Bar**: Always accessible at top of screen
- **Quick Actions**: Swipe gestures for common tasks
- **Bottom Navigation**: Key features accessible with thumb

#### Touch Gestures
- **Tap**: Select items, open profiles
- **Long Press**: Access context menus
- **Swipe**: Navigate between sections
- **Pinch**: Zoom in organizational chart
- **Pull to Refresh**: Update content

### Mobile-Specific Features

#### Quick Actions
- **Call**: Tap phone numbers to initiate calls
- **Email**: Tap email addresses to compose messages
- **Maps**: Tap addresses to open in maps app
- **Share**: Share profiles via native sharing

#### Camera Integration
- **Photo Upload**: Use camera to take profile photos
- **QR Codes**: Scan QR codes for quick profile access
- **Document Scanning**: Scan business cards for contact import

### Mobile Performance

- **Fast Loading**: Optimized for 3G networks
- **Efficient Caching**: Reduced data usage
- **Progressive Loading**: Content loads as you scroll
- **Offline Support**: View recently accessed profiles offline

## Troubleshooting

### Common Issues

#### Cannot Log In

**SSO Login Issues:**
1. Verify you're using the correct company URL
2. Check if your account exists in the SSO provider
3. Try clearing browser cache and cookies
4. Contact your IT administrator if issues persist

**Password Login Issues:**
1. Use "Forgot Password" to reset your password
2. Check if your account has been deactivated
3. Verify you're using the correct email address

#### Profile Not Loading

1. Refresh the page (F5 or Ctrl+R)
2. Check your internet connection
3. Try a different browser
4. Clear browser cache and cookies
5. Contact support if issue persists

#### Search Not Working

1. Try different search terms
2. Check spelling and try partial matches
3. Clear search filters
4. Refresh the page
5. Report persistent issues to administrators

#### Photos Not Uploading

1. Check file size (must be under 2MB)
2. Verify file format (JPG, PNG, GIF only)
3. Try a different image
4. Check internet connection
5. Try using a different browser

### Browser Compatibility

#### Supported Browsers
- **Chrome**: Version 90+
- **Firefox**: Version 88+
- **Safari**: Version 14+
- **Edge**: Version 90+

#### Unsupported Browsers
- Internet Explorer (all versions)
- Chrome versions below 90
- Firefox versions below 88

### Performance Issues

#### Slow Loading
1. Check internet connection speed
2. Close unnecessary browser tabs
3. Disable browser extensions temporarily
4. Try using a different network
5. Contact IT if issues persist

#### Mobile Performance
1. Close other apps to free memory
2. Check cellular/WiFi signal strength
3. Update your mobile browser
4. Clear browser cache
5. Restart your device if necessary

### Getting Help

#### Self-Service Options
1. Check this user guide
2. Review FAQ section below
3. Use in-app help tooltips
4. Check system status page

#### Contact Support
- **Email**: support@directory-platform.com
- **Help Desk**: Available through admin panel
- **Documentation**: Additional guides at docs.directory-platform.com

## FAQ

### General Questions

**Q: How do I change my profile photo?**
A: Go to your profile, click "Edit Profile," then click "Upload Photo" or the camera icon. Select an image file under 2MB and save your changes.

**Q: Can I see who viewed my profile?**
A: Profile view tracking is available to administrators for analytics purposes, but individual users cannot see who viewed their profile for privacy reasons.

**Q: How do I update my manager information?**
A: Manager relationships are typically managed by administrators. Contact your HR department or system administrator to update reporting relationships.

**Q: Can I export the employee directory?**
A: Data export is available to administrators only. Regular users can view and search the directory but cannot export the complete dataset for privacy and security reasons.

### Search Questions

**Q: Why don't I see certain employees in search results?**
A: You may not see inactive/deactivated employees, or there may be permission restrictions. All active employees should be visible to all users.

**Q: How do I search for people with specific skills?**
A: Type the skill name in the search bar, or use the skills filter in advanced search. The system searches through all skills listed in employee profiles.

**Q: Can I save my search results?**
A: The system remembers your recent searches, but you cannot save permanent search queries. Use bookmarks to save specific employee profiles.

### Technical Questions

**Q: Why is the site loading slowly?**
A: Slow loading can be caused by internet connection issues, browser problems, or high system usage. Try refreshing the page, clearing your cache, or using a different browser.

**Q: Does the directory work on mobile devices?**
A: Yes, the directory is fully responsive and works on all mobile devices. You can access all features through your mobile browser.

**Q: Can I use the directory offline?**
A: Limited offline functionality is available for recently viewed profiles. Full functionality requires an internet connection.

**Q: Is my data secure?**
A: Yes, all data is encrypted in transit and at rest. The system uses enterprise-grade security measures and complies with data protection regulations.

### Admin Questions

**Q: How do I add new employees to the directory?**
A: Administrators can add employees individually through the "Employee Management" section or use bulk import with a CSV file.

**Q: Can I customize the fields shown in employee profiles?**
A: Yes, administrators can create custom fields through the "Custom Fields" management section. These fields can be required or optional.

**Q: How do I set up single sign-on (SSO)?**
A: SSO configuration requires Super Admin privileges. Go to "SSO Configuration" and follow the setup guide for your identity provider.

**Q: Can I see who made changes to employee profiles?**
A: Yes, all changes are logged in the audit system. Administrators can view detailed audit logs showing who made what changes and when.

### Billing Questions

**Q: How is pricing calculated?**
A: Pricing is typically based on the number of active employees in your directory. Contact your account manager for specific pricing details.

**Q: What happens if we exceed our user limit?**
A: The system will prevent adding new employees once you reach your limit. You'll need to upgrade your subscription or deactivate unused accounts.

**Q: Can we change our subscription plan?**
A: Yes, Super Admins can upgrade or downgrade subscription plans through the billing section. Changes typically take effect at the next billing cycle.

---

For additional support or questions not covered in this guide, please contact your system administrator or our support team at support@directory-platform.com.