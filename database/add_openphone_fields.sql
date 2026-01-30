-- Add OpenPhone configuration fields to user_configs table
-- Run this migration to enable SMS sending functionality

ALTER TABLE user_configs
ADD COLUMN IF NOT EXISTS openphone_api_key VARCHAR(255),
ADD COLUMN IF NOT EXISTS sender_phone VARCHAR(20);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_configs_user_id ON user_configs(user_id);

COMMENT ON COLUMN user_configs.openphone_api_key IS 'OpenPhone API key for SMS sending';
COMMENT ON COLUMN user_configs.sender_phone IS 'OpenPhone sender phone number (E.164 format: +1234567890)';
