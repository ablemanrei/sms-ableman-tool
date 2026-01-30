-- Fix campaign_schedules table to match frontend data structure
-- This migration updates the schema to properly support once/weekly/monthly schedules

-- Drop the old constraints and columns that don't match our needs
ALTER TABLE campaign_schedules
DROP CONSTRAINT IF EXISTS campaign_schedules_day_of_week_check;

-- Drop old columns if they exist
ALTER TABLE campaign_schedules
DROP COLUMN IF EXISTS day_of_week CASCADE;

ALTER TABLE campaign_schedules
DROP COLUMN IF EXISTS time_of_day CASCADE;

-- Add new columns that match frontend structure
ALTER TABLE campaign_schedules
ADD COLUMN IF NOT EXISTS schedule_day VARCHAR(50),
ADD COLUMN IF NOT EXISTS schedule_time VARCHAR(10),
ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0;

-- Update indexes
DROP INDEX IF EXISTS campaign_schedules_day_time_idx;
CREATE INDEX IF NOT EXISTS idx_schedule_active_type ON campaign_schedules(is_active, schedule_type);
CREATE INDEX IF NOT EXISTS idx_schedule_execution ON campaign_schedules(last_executed_at);

-- Add comments for clarity
COMMENT ON COLUMN campaign_schedules.schedule_day IS 'Date (YYYY-MM-DD) for once, day name (Monday-Sunday) for weekly, day number (1-31) for monthly';
COMMENT ON COLUMN campaign_schedules.schedule_time IS 'Time in HH:MM format (24-hour, EST timezone)';
COMMENT ON COLUMN campaign_schedules.last_executed_at IS 'Timestamp of last execution (prevents duplicate runs for once schedules)';
COMMENT ON COLUMN campaign_schedules.execution_count IS 'Number of times this schedule has been executed';
