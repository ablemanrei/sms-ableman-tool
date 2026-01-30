-- ========================================
-- DIAGNOSTIC SCRIPT FOR SCHEDULE ISSUES
-- ========================================
-- Run this in Supabase SQL Editor to diagnose why your schedule didn't execute

-- 1. Check campaign_schedules table structure
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'campaign_schedules'
ORDER BY ordinal_position;

-- 2. Check your specific campaign and its schedules
SELECT
    c.id as campaign_id,
    c.campaign_name,
    c.is_active as campaign_active,
    cs.id as schedule_id,
    cs.schedule_type,
    cs.schedule_day,
    cs.schedule_time,
    cs.is_active as schedule_active,
    cs.last_executed_at,
    cs.execution_count,
    cs.created_at
FROM campaigns c
LEFT JOIN campaign_schedules cs ON c.id = cs.campaign_id
WHERE c.campaign_name = 'sms test'
ORDER BY cs.created_at DESC;

-- 3. Check if there are any campaign executions for this campaign
SELECT
    id,
    campaign_id,
    execution_type,
    status,
    started_at,
    completed_at,
    total_recipients,
    successful_sends,
    failed_sends,
    error_message
FROM campaign_executions
WHERE campaign_id = (SELECT id FROM campaigns WHERE campaign_name = 'sms test')
ORDER BY started_at DESC
LIMIT 5;

-- 4. Check for old schema columns (these should NOT exist)
SELECT
    column_name
FROM information_schema.columns
WHERE table_name = 'campaign_schedules'
AND column_name IN ('day_of_week', 'time_of_day');

-- 5. Show all active campaigns with their schedules
SELECT
    c.campaign_name,
    c.is_active as campaign_active,
    COUNT(cs.id) as schedule_count,
    COUNT(CASE WHEN cs.is_active THEN 1 END) as active_schedules
FROM campaigns c
LEFT JOIN campaign_schedules cs ON c.id = cs.campaign_id
WHERE c.is_active = true
GROUP BY c.id, c.campaign_name, c.is_active;
