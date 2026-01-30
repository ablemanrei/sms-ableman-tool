-- Campaign Templates Table Migration
-- This table stores reusable campaign configurations

-- Create campaign_templates table
CREATE TABLE IF NOT EXISTS public.campaign_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL,
  description TEXT,
  config_id UUID NOT NULL REFERENCES public.user_configs(id) ON DELETE CASCADE,
  status_column TEXT NOT NULL,
  status_value TEXT NOT NULL,
  phone_column TEXT NOT NULL,
  message_template TEXT NOT NULL,
  multiple_filters JSONB DEFAULT '[]'::jsonb,
  schedule_type TEXT NOT NULL DEFAULT 'once' CHECK (schedule_type IN ('once', 'weekly', 'monthly')),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_templates_user_id ON public.campaign_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_workspace_id ON public.campaign_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_config_id ON public.campaign_templates(config_id);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_created_at ON public.campaign_templates(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own templates or workspace templates
CREATE POLICY "Users can view their own templates" ON public.campaign_templates
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR workspace_id IN (
      SELECT workspace_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Users can insert their own templates
CREATE POLICY "Users can insert their own templates" ON public.campaign_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update their own templates" ON public.campaign_templates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete their own templates" ON public.campaign_templates
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.campaign_templates IS 'Stores reusable campaign configuration templates';
COMMENT ON COLUMN public.campaign_templates.template_name IS 'Name of the template';
COMMENT ON COLUMN public.campaign_templates.description IS 'Optional description of what this template is for';
COMMENT ON COLUMN public.campaign_templates.config_id IS 'Reference to the Monday.com configuration';
COMMENT ON COLUMN public.campaign_templates.message_template IS 'SMS message template with dynamic tags';
COMMENT ON COLUMN public.campaign_templates.multiple_filters IS 'JSON array of advanced filter conditions';
COMMENT ON COLUMN public.campaign_templates.schedule_type IS 'Type of schedule: once, weekly, or monthly';
