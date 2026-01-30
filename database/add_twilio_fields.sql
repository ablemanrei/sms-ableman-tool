-- Add Twilio configuration fields to user_configs table
-- Run this migration to enable SMS sending functionality

ALTER TABLE user_configs
ADD COLUMN IF NOT EXISTS twilio_account_sid VARCHAR(255),
ADD COLUMN IF NOT EXISTS twilio_auth_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS twilio_phone_number VARCHAR(20);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_configs_user_id ON user_configs(user_id);

COMMENT ON COLUMN user_configs.twilio_account_sid IS 'Twilio Account SID for SMS sending';
COMMENT ON COLUMN user_configs.twilio_auth_token IS 'Twilio Auth Token for SMS sending';
COMMENT ON COLUMN user_configs.twilio_phone_number IS 'Twilio phone number to send SMS from (E.164 format: +1234567890)';
