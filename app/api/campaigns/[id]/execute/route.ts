import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Helper function to format phone numbers
function formatPhoneNumber(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  if (phone.startsWith('+')) {
    return phone;
  }
  return null;
}

// Helper function to process message template
function processMessageTemplate(template: string, columnValues: any[]): string {
  let processedMessage = template;
  const regex = /\{([^}]+)\}/g;
  processedMessage = processedMessage.replace(regex, (match, columnId) => {
    const column = columnValues.find(col => col.id === columnId);
    return column && column.text ? column.text : match;
  });
  return processedMessage;
}

// Helper function to apply multiple filters
function applyMultipleFilters(items: any[], filters: any[]): any[] {
  return items.filter(item => {
    return filters.every(filter => {
      const column = item.column_values.find((col: any) => col.id === filter.column_id);
      if (!column) return false;
      const columnValue = column.text || '';
      const filterValue = filter.value;
      switch (filter.operator) {
        case 'equals': return columnValue === filterValue;
        case 'not_equals': return columnValue !== filterValue;
        case 'contains': return columnValue.toLowerCase().includes(filterValue.toLowerCase());
        case 'not_contains': return !columnValue.toLowerCase().includes(filterValue.toLowerCase());
        case 'starts_with': return columnValue.toLowerCase().startsWith(filterValue.toLowerCase());
        case 'ends_with': return columnValue.toLowerCase().endsWith(filterValue.toLowerCase());
        case 'is_empty': return columnValue === '';
        case 'is_not_empty': return columnValue !== '';
        default: return true;
      }
    });
  });
}

// Helper function to send SMS via OpenPhone
async function sendSMS(phoneNumber: string, message: string, openphoneApiKey: string, senderPhone: string) {
  try {
    const response = await axios.post(
      'https://api.openphone.com/v1/messages',
      {
        to: [phoneNumber],
        from: senderPhone,
        content: message,
      },
      {
        headers: {
          'Authorization': openphoneApiKey,
          'Content-Type': 'application/json',
        },
      }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error.response?.data || error.message };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  try {
    // Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Fetch config
    const { data: config, error: configError } = await supabase
      .from('user_configs')
      .select('*')
      .eq('id', campaign.config_id)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Create execution record
    const { data: execution, error: executionError } = await supabase
      .from('campaign_executions')
      .insert({
        campaign_id: campaignId,
        execution_type: 'manual',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (executionError || !execution) {
      return NextResponse.json(
        { error: 'Failed to create execution record' },
        { status: 500 }
      );
    }

    // Fetch items from Monday.com
    const query = `query {
      boards(ids: ${config.board_id}) {
        items_page(limit: 500) {
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }`;

    const mondayResponse = await axios.post(
      'https://api.monday.com/v2',
      { query },
      {
        headers: {
          'Authorization': config.monday_api_key,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!mondayResponse.data?.data) {
      await supabase
        .from('campaign_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: 'Failed to fetch data from Monday.com',
        })
        .eq('id', execution.id);

      return NextResponse.json(
        { error: 'Failed to fetch data from Monday.com' },
        { status: 500 }
      );
    }

    let items = mondayResponse.data.data.boards[0].items_page.items;

    // Apply filters
    if (campaign.selected_items && campaign.selected_items.length > 0) {
      items = items.filter((item: any) => campaign.selected_items.includes(item.id));
    }

    if (campaign.multiple_filters && campaign.multiple_filters.length > 0) {
      items = applyMultipleFilters(items, campaign.multiple_filters);
    }

    // Process and send messages
    let successfulSends = 0;
    let failedSends = 0;
    const messageLogs = [];

    for (const item of items) {
      const statusColumn = item.column_values.find((col: any) => col.id === campaign.status_column);
      const phoneColumn = item.column_values.find((col: any) => col.id === campaign.phone_column);

      if (statusColumn && statusColumn.text === campaign.status_value && phoneColumn) {
        const phoneNumber = formatPhoneNumber(phoneColumn.text);

        if (phoneNumber) {
          const processedMessage = processMessageTemplate(campaign.message_template, item.column_values);
          const nameColumns = item.column_values.filter((col: any) =>
            col.id.includes('name') || col.id.includes('text')
          );
          const recipientName = nameColumns.length > 0 ? nameColumns[0].text : 'Unknown';

          // Send SMS
          const result = await sendSMS(phoneNumber, processedMessage, config.openphone_api_key, config.sender_phone);

          if (result.success) {
            successfulSends++;
            messageLogs.push({
              execution_id: execution.id,
              campaign_id: campaignId,
              recipient_name: recipientName,
              recipient_phone: phoneNumber,
              message_content: processedMessage,
              status: 'sent',
              sent_at: new Date().toISOString(),
            });
          } else {
            failedSends++;
            messageLogs.push({
              execution_id: execution.id,
              campaign_id: campaignId,
              recipient_name: recipientName,
              recipient_phone: phoneNumber,
              message_content: processedMessage,
              status: 'failed',
              error_message: JSON.stringify(result.error),
              sent_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Insert message logs
    if (messageLogs.length > 0) {
      await supabase.from('message_logs').insert(messageLogs);
    }

    // Update execution record
    await supabase
      .from('campaign_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_recipients: successfulSends + failedSends,
        successful_sends: successfulSends,
        failed_sends: failedSends,
      })
      .eq('id', execution.id);

    return NextResponse.json({
      success: true,
      executionId: execution.id,
      totalRecipients: successfulSends + failedSends,
      successfulSends,
      failedSends,
    });

  } catch (error: any) {
    console.error('Error executing campaign:', error);
    return NextResponse.json(
      { error: 'Failed to execute campaign', details: error.message },
      { status: 500 }
    );
  }
}
