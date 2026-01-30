# Campaign Logs Database Migration

This guide explains how to apply the campaign logging tables to your Supabase database.

## What This Migration Does

This migration creates two new tables to track campaign execution and individual SMS message logs:

1. **campaign_executions** - Tracks each time a campaign runs (scheduled or manual)
2. **message_logs** - Tracks individual SMS message sends with delivery status

## How to Apply the Migration

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard at [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Navigate to the **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `campaign_logs_schema.sql` in this directory
5. Copy all the SQL content from that file
6. Paste it into the SQL Editor
7. Click **Run** or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)
8. Verify the tables were created by checking the **Table Editor** in the left sidebar

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Make sure you're in the project root directory
cd /Users/hf/Downloads/sms\ platform\ in\ next\ js/sms-campaign-platform

# Run the migration
supabase db reset  # This will reset your database (use with caution!)

# Or apply the specific migration file
psql -h [YOUR_DB_HOST] -U postgres -d postgres -f database/campaign_logs_schema.sql
```

### Option 3: Manual SQL Execution

1. Connect to your Supabase database using a PostgreSQL client (like pgAdmin or DBeaver)
2. Open and execute the `campaign_logs_schema.sql` file

## Verification

After applying the migration, verify the tables exist:

```sql
-- Check if campaign_executions table exists
SELECT * FROM campaign_executions LIMIT 1;

-- Check if message_logs table exists
SELECT * FROM message_logs LIMIT 1;

-- Verify indexes were created
SELECT indexname FROM pg_indexes
WHERE tablename IN ('campaign_executions', 'message_logs');
```

## What's Included

The schema includes:

- ✅ Two new tables with proper foreign key relationships
- ✅ Indexes for optimized query performance
- ✅ Row Level Security (RLS) policies to ensure users only see their own logs
- ✅ Proper data types for timestamps, costs, and status tracking
- ✅ JSONB field for flexible execution metadata storage

## Next Steps

After applying the migration:

1. **View Campaign Logs**: Click the "View Logs" button (📄 icon) on any campaign in the campaigns list
2. **Test the System**: When campaigns execute, logs will automatically populate these tables
3. **Integrate SMS Provider**: Connect your SMS service (Twilio, MessageBird, etc.) to populate message logs

## Rollback (If Needed)

If you need to remove these tables:

```sql
-- Drop the tables (this will delete all data!)
DROP TABLE IF EXISTS message_logs CASCADE;
DROP TABLE IF EXISTS campaign_executions CASCADE;
```

## Troubleshooting

### Permission Errors

If you get permission errors, make sure:
- You're logged in with a user that has database admin privileges
- RLS policies are correctly configured
- The `auth.uid()` function is available in your Supabase project

### Foreign Key Errors

If you get foreign key constraint errors:
- Make sure the `campaigns` table already exists
- Verify the `campaigns.id` column uses UUID type
- Check that the user_configs and workspace_members tables exist for RLS policies

## Support

If you encounter issues applying this migration, check:
1. Supabase project logs in the dashboard
2. PostgreSQL error messages for specific details
3. Ensure you're using PostgreSQL 12+ (required for Supabase)
