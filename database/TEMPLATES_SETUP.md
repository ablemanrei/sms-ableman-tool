# Campaign Templates Feature

## Overview
The Campaign Templates feature allows users to save and reuse campaign configurations, making it faster to create new campaigns with similar settings.

## Database Setup

### Step 1: Run the Migration
Execute the SQL migration to create the `campaign_templates` table:

```bash
# Using psql
psql -U your_username -d your_database -f database/create_campaign_templates_table.sql

# Or using Supabase SQL Editor
# Copy and paste the contents of create_campaign_templates_table.sql
```

### Step 2: Verify Table Creation
Check that the table was created successfully:

```sql
SELECT * FROM campaign_templates LIMIT 1;
```

## Features

### 1. Templates List Page (`/templates`)
- View all saved templates
- Search templates by name, description, or message content
- Statistics cards showing:
  - Total templates
  - Templates with filters
  - Recurring templates
  - Templates created this month
- Quick actions:
  - Use template (creates new campaign)
  - Edit template
  - Duplicate template
  - Delete template
- Export templates to CSV

### 2. Create Template Page (`/templates/new`)
- 4-step wizard interface:
  1. **Basic Info**: Name, description, configuration, schedule type
  2. **Basic Filters**: Status column, status value, phone column
  3. **Advanced Filters**: Multiple conditional filters
  4. **Message**: SMS message template with dynamic tags
- Optimistic UI updates
- Form validation
- Success/error toast notifications

### 3. Edit Template Page (`/templates/[id]`)
- Same interface as create page
- Pre-populated with existing template data
- Delete template option
- Automatic Monday.com column loading

## How It Works

### Creating a Template
1. Navigate to `/templates`
2. Click "Create Template"
3. Fill in basic information:
   - Template name (required)
   - Configuration (required)
   - Description (optional)
   - Schedule type (once/weekly/monthly)
4. Set up filters:
   - Status column and value
   - Phone column
   - Advanced filters (optional)
5. Create message template with dynamic tags
6. Save template

### Using a Template
1. Go to `/templates`
2. Find the template you want to use
3. Click "Use Template"
4. A new campaign will be created with the template's configuration
5. You'll be redirected to the campaign edit page

### Template Benefits
- **Save Time**: Quickly create campaigns with pre-configured settings
- **Consistency**: Ensure campaigns follow the same structure
- **Reusability**: Use the same configuration across multiple campaigns
- **Sharing**: Workspace-wide templates accessible to all team members

## Database Schema

```sql
campaign_templates
├── id (UUID, Primary Key)
├── template_name (TEXT, NOT NULL)
├── description (TEXT)
├── config_id (UUID, Foreign Key → user_configs)
├── status_column (TEXT, NOT NULL)
├── status_value (TEXT, NOT NULL)
├── phone_column (TEXT, NOT NULL)
├── message_template (TEXT, NOT NULL)
├── multiple_filters (JSONB)
├── schedule_type (TEXT, CHECK: once/weekly/monthly)
├── user_id (UUID, Foreign Key → users)
├── workspace_id (UUID, Foreign Key → workspaces)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

## Row Level Security (RLS)

The table has RLS enabled with the following policies:
- Users can view their own templates or workspace templates
- Users can insert their own templates
- Users can update their own templates
- Users can delete their own templates

## API Endpoints Used

### Fetch Templates
```typescript
const { data, error } = await supabase
  .from('campaign_templates')
  .select(`
    *,
    user_configs!inner(config_name)
  `)
  .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`)
  .order('created_at', { ascending: false });
```

### Create Template
```typescript
const { error } = await supabase
  .from('campaign_templates')
  .insert(templateData);
```

### Update Template
```typescript
const { error } = await supabase
  .from('campaign_templates')
  .update(templateData)
  .eq('id', templateId);
```

### Delete Template
```typescript
const { error } = await supabase
  .from('campaign_templates')
  .delete()
  .eq('id', templateId);
```

## UI Components Used

- **DashboardLayout**: Main layout wrapper
- **ConfirmModal**: Delete confirmation dialog
- **Toast**: Success/error notifications
- **SearchableSelect**: Dropdown with search functionality
- Lucide React icons

## File Structure

```
app/
├── templates/
│   ├── page.tsx              # Templates list
│   ├── new/
│   │   └── page.tsx         # Create template
│   └── [id]/
│       └── page.tsx         # Edit template

database/
├── create_campaign_templates_table.sql
└── TEMPLATES_SETUP.md
```

## Testing

### Manual Testing Checklist
- [ ] Create a new template
- [ ] View template in list
- [ ] Edit template
- [ ] Duplicate template
- [ ] Use template to create campaign
- [ ] Delete template
- [ ] Search templates
- [ ] Export templates to CSV
- [ ] Test with workspace templates
- [ ] Verify RLS policies work correctly

## Troubleshooting

### Template Not Appearing in List
- Check RLS policies are enabled
- Verify user_id matches current user
- Check workspace_id if using workspaces

### Monday.com Columns Not Loading
- Verify configuration has valid API key
- Check board_id and group_id are correct
- Ensure Monday.com API is accessible

### Template Creation Fails
- Check all required fields are filled
- Verify config_id exists in user_configs table
- Check database constraints

## Future Enhancements

Possible improvements:
- Template categories/tags
- Template sharing between workspaces
- Template versioning
- Template usage analytics
- Template preview before using
- Bulk template operations
