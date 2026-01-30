# Fix Schedule Not Executing Issue

## Problem
Your scheduled campaign at 2:44 PM EST didn't execute and the campaign wasn't updated.

## Root Causes (In Order of Likelihood)

### 1. Database Schema Mismatch (Most Likely)
Your `campaign_schedules` table might still have the OLD schema with columns `day_of_week` and `time_of_day`, but the SMS server expects the NEW schema with `schedule_day` and `schedule_time`.

### 2. Schedule Data Format Issue
The schedule time or day might be stored in the wrong format.

### 3. SMS Server Issue
The server might have errors that aren't being logged properly.

## Step-by-Step Fix

### Step 1: Run Diagnostic Script

1. Open Supabase SQL Editor
2. Copy and paste the contents of [`diagnose_schedule_issue.sql`](diagnose_schedule_issue.sql)
3. Run it and look at the results

**What to Look For:**
- **Query 1**: Check if you see `schedule_day` and `schedule_time` columns
  - ❌ If you see `day_of_week` and `time_of_day` instead → **Go to Step 2**
  - ✅ If you see `schedule_day` and `schedule_time` → **Go to Step 3**

- **Query 2**: Check your campaign schedule data
  - Is `campaign_active` = true?
  - Is `schedule_active` = true?
  - Is `schedule_time` in format "HH:MM" (e.g., "14:44")?
  - Is `schedule_day` the correct date (YYYY-MM-DD format for "once")?

- **Query 3**: Check for any executions
  - If there are recent executions with errors, check `error_message`

- **Query 4**: Check for old columns
  - If this returns any rows, you have the old schema → **Go to Step 2**

### Step 2: Update Database Schema (If Needed)

If you still have the old schema, run this migration:

1. Open Supabase SQL Editor
2. Copy and paste the contents of [`FINAL_SCHEDULE_FIX.sql`](FINAL_SCHEDULE_FIX.sql)
3. Run the migration
4. **IMPORTANT**: After running the migration, you need to **recreate your schedule**:
   - Go to your campaign details page
   - Delete the existing schedule
   - Create a new schedule with the correct time

### Step 3: Verify Schedule Format

Run this query to check your schedule format:

```sql
SELECT
    campaign_name,
    schedule_type,
    schedule_day,
    schedule_time,
    is_active
FROM campaigns c
JOIN campaign_schedules cs ON c.id = cs.campaign_id
WHERE c.campaign_name = 'sms test';
```

**Expected Format:**
- `schedule_type`: Should be 'once', 'weekly', or 'monthly'
- `schedule_day`:
  - For **once**: Should be "2026-01-29" (YYYY-MM-DD)
  - For **weekly**: Should be "Wednesday" (full day name)
  - For **monthly**: Should be "29" (day number)
- `schedule_time`: Should be "14:44" (HH:MM in 24-hour format)
- `is_active`: Should be `true`

### Step 4: Check SMS Server Logs

Check if the SMS server is actually checking schedules:

```bash
# In terminal, navigate to sms-server folder
cd "/Users/hf/Downloads/sms platform in next js/sms-campaign-platform/sms-server"

# Check the server process
ps aux | grep "node.*server.js" | grep -v grep

# If server is running but no output, restart it with logging:
# Stop the current server (find the PID from above command)
kill <PID>

# Start server with output to see logs
npm run dev
```

You should see logs like:
```
[CRON] Checking campaigns at 2026-01-29T19:44:00.000Z (EST: Wednesday, 14:44)
```

### Step 5: Manual Testing

Test your campaign manually first:

1. Go to your campaign page
2. Click "Send Now" button
3. Check if messages are sent
4. If manual sending works but scheduling doesn't, the issue is definitely the scheduler

### Step 6: Fix Schedule Time Precision

The scheduler checks times to the **exact minute**. Make sure:

1. Schedule is set to **exactly** 14:44 (not 14:44:30 or 14:44:15)
2. The server time matches EST
3. You're in the correct timezone

To test, set a schedule for **3-5 minutes in the future** and watch the logs.

## Quick Fix If Everything Else Fails

If you can't get scheduled execution working:

1. **Delete the schedule** from your campaign
2. **Run the FINAL_SCHEDULE_FIX.sql migration** again
3. **Create a NEW campaign** (don't edit the existing one)
4. Set the schedule for **5 minutes in the future**
5. Watch the SMS server logs to see if it executes

## Common Mistakes

### ❌ Wrong Time Format
```sql
-- WRONG: Including seconds
schedule_time = '14:44:00'

-- CORRECT: HH:MM only
schedule_time = '14:44'
```

### ❌ Wrong Date Format for "Once" Schedules
```sql
-- WRONG: Using day name for 'once'
schedule_type = 'once'
schedule_day = 'Wednesday'

-- CORRECT: Use date string
schedule_type = 'once'
schedule_day = '2026-01-29'
```

### ❌ Schedule Not Active
```sql
-- Check both campaign AND schedule are active
SELECT
    c.is_active as campaign_active,
    cs.is_active as schedule_active
FROM campaigns c
JOIN campaign_schedules cs ON c.id = cs.campaign_id
WHERE c.campaign_name = 'sms test';

-- Both should be TRUE
```

### ❌ Already Executed Today
For "once" schedules, if `last_executed_at` is set to today, it won't execute again:

```sql
SELECT
    schedule_type,
    last_executed_at,
    DATE(last_executed_at) as execution_date,
    CURRENT_DATE as today
FROM campaign_schedules
WHERE campaign_id = (SELECT id FROM campaigns WHERE campaign_name = 'sms test');

-- If execution_date = today, it won't run again
```

## After Fixing

To verify it's working:

1. Set a schedule for **2-3 minutes from now**
2. Watch the SMS server terminal for:
   ```
   [CRON] Checking campaigns at...
   [CRON] Executing campaign: sms test (Schedule ID: xxx, Type: once)
   ```
3. Check the Messages page for sent messages
4. Check campaign_executions table for new execution record

## Need More Help?

If none of these steps work:

1. Run the diagnostic script and save the results
2. Check SMS server terminal output
3. Take a screenshot of:
   - Your campaign details page (showing schedule)
   - The diagnostic script results
   - The SMS server terminal output
4. Share these for further debugging

## Prevention

To avoid this in the future:

1. **Always use the latest schema** - Run FINAL_SCHEDULE_FIX.sql after any database reset
2. **Test with near-future schedules** - Don't schedule for hours ahead, test with 5-10 minutes
3. **Monitor server logs** - Keep the SMS server terminal open during testing
4. **Check execution history** - Use the Messages and Analytics pages to verify execution
