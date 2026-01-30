// User types
export interface User {
  id: string;
  email: string;
  name: string;
}

// Workspace types
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

// Configuration types
export interface UserConfig {
  id: string;
  user_id: string;
  workspace_id?: string;
  config_name: string;
  description?: string;
  monday_api_key: string;
  sender_phone?: string;
  board_id: string;
  group_id: string;
  openphone_api_key?: string;
  created_at: string;
  updated_at: string;
}

// Campaign types
export interface Campaign {
  id: string;
  user_id: string;
  config_id: string;
  workspace_id?: string;
  campaign_name: string;
  description?: string;
  status_column: string;
  status_value: string;
  phone_column: string;
  message_template: string;
  schedule_type: 'once' | 'weekly' | 'monthly';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  selected_items?: string[];
  state_filter?: any;
  multiple_filters?: Filter[];
  is_template?: boolean;
  template_name?: string;
  last_executed_at?: string;
  execution_count: number;
  terminated_at?: string;
  completed_at?: string;
}

export interface Filter {
  column: string;
  columnTitle: string;
  operator: 'equals' | 'contains' | 'not_equals' | 'not_contains';
  value: string;
}

// Schedule types
export interface CampaignSchedule {
  id: string;
  campaign_id: string;
  day_of_week: number;
  time_of_day: string;
  is_active: boolean;
  schedule_type: 'once' | 'weekly' | 'monthly';
  created_at: string;
  updated_at: string;
}

// SMS History types
export interface SMSHistory {
  id: string;
  user_id: string;
  campaign_id?: string;
  workspace_id?: string;
  recipient_phone: string;
  recipient_name?: string;
  message_content: string;
  status: 'sent' | 'failed';
  sent_at: string;
  monday_item_id?: string;
  monday_item_name?: string;
  campaign_name?: string;
  error_message?: string;
}

// Integration types
export interface Integration {
  id: string;
  user_id: string;
  config_id: string;
  integration_name: string;
  description?: string;
  status_column: string;
  status_values: string[];
  phone_column: string;
  attempt_column: string;
  completion_status: string;
  total_messages: number;
  max_attempts: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Stats types
export interface DashboardStats {
  totalMessagesSent: number;
  totalConfigurations: number;
  activeCampaigns: number;
  lastActivity: string | null;
  recentMessages: SMSHistory[];
  campaignStats: CampaignStat[];
}

export interface CampaignStat {
  campaign_id: string;
  campaign_name: string;
  messages_sent: number;
  messages_failed: number;
  last_executed_at?: string;
}
