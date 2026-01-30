-- ========================================
-- FINAL SCHEDULE FIX - Run this in Supabase SQL Editor
-- ========================================
-- This fixes the campaign_schedules table schema to match frontend
-- and adds execution tracking to prevent duplicate runs

-- Step 1: Drop old constraints
ALTER TABLE campaign_schedules
DROP CONSTRAINT IF EXISTS campaign_schedules_day_of_week_check;

-- Step 2: Drop old columns that don't match frontend
ALTER TABLE campaign_schedules
DROP COLUMN IF EXISTS day_of_week CASCADE;

ALTER TABLE campaign_schedules
DROP COLUMN IF EXISTS time_of_day CASCADE;

-- Step 3: Add new columns that match frontend data structure
ALTER TABLE campaign_schedules
ADD COLUMN IF NOT EXISTS schedule_day VARCHAR(50);

ALTER TABLE campaign_schedules
ADD COLUMN IF NOT EXISTS schedule_time VARCHAR(10);

ALTER TABLE campaign_schedules
ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE campaign_schedules
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0;

-- Step 4: Update indexes for better performance
DROP INDEX IF EXISTS campaign_schedules_day_time_idx;

CREATE INDEX IF NOT EXISTS idx_schedule_active_type
ON campaign_schedules(is_active, schedule_type);

CREATE INDEX IF NOT EXISTS idx_schedule_execution
ON campaign_schedules(last_executed_at);

-- Step 5: Add helpful comments
COMMENT ON COLUMN campaign_schedules.schedule_day IS 'Format depends on schedule_type: Date (YYYY-MM-DD) for once, Day name (Monday-Sunday) for weekly, Day number (1-31) for monthly';

COMMENT ON COLUMN campaign_schedules.schedule_time IS 'Time in HH:MM format (24-hour), always interpreted as EST timezone';

COMMENT ON COLUMN campaign_schedules.last_executed_at IS 'Timestamp of last execution - prevents duplicate runs for once schedules';

COMMENT ON COLUMN campaign_schedules.execution_count IS 'Number of times this schedule has been executed';

-- Step 6: Verify the schema
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'campaign_schedules'
ORDER BY ordinal_position;
