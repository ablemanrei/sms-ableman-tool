-- Drop existing tables if they exist (to ensure clean creation)
DROP TABLE IF EXISTS message_logs CASCADE;
DROP TABLE IF EXISTS campaign_executions CASCADE;

-- Campaign Execution Logs Table
-- Tracks each time a campaign runs (scheduled or manual)
CREATE TABLE campaign_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  execution_type VARCHAR(20) NOT NULL, -- 'scheduled', 'manual'
  status VARCHAR(20) NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  successful_sends INTEGER DEFAULT 0,
  failed_sends INTEGER DEFAULT 0,
  error_message TEXT,
  execution_details JSONB, -- Store additional execution metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Logs Table
-- Tracks individual SMS message sends
CREATE TABLE message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES campaign_executions(id) ON DELETE CASCADE,
  recipient_phone VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(255),
  message_content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'pending', 'sent', 'failed', 'delivered', 'undelivered'
  sms_provider VARCHAR(50), -- 'twilio', 'messagebird', etc.
  provider_message_id VARCHAR(255), -- ID from SMS provider
  error_message TEXT,
  cost_amount DECIMAL(10, 4), -- Cost of sending this message
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_campaign_executions_campaign_id ON campaign_executions(campaign_id);
CREATE INDEX idx_campaign_executions_status ON campaign_executions(status);
CREATE INDEX idx_campaign_executions_started_at ON campaign_executions(started_at);

CREATE INDEX idx_message_logs_campaign_id ON message_logs(campaign_id);
CREATE INDEX idx_message_logs_execution_id ON message_logs(execution_id);
CREATE INDEX idx_message_logs_status ON message_logs(status);
CREATE INDEX idx_message_logs_sent_at ON message_logs(sent_at);
