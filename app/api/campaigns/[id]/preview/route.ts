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

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Check if it's a valid US/Canada number (10 or 11 digits)
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // If it already has a + prefix, return as is
  if (phone.startsWith('+')) {
    return phone;
  }

  return null;
}

// Helper function to process message template
function processMessageTemplate(template: string, columnValues: any[]): string {
  let processedMessage = template;

  // Replace all {column_id} placeholders with actual values
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
        case 'equals':
          return columnValue === filterValue;
        case 'not_equals':
          return columnValue !== filterValue;
        case 'contains':
          return columnValue.toLowerCase().includes(filterValue.toLowerCase());
        case 'not_contains':
          return !columnValue.toLowerCase().includes(filterValue.toLowerCase());
        case 'starts_with':
          return columnValue.toLowerCase().startsWith(filterValue.toLowerCase());
        case 'ends_with':
          return columnValue.toLowerCase().endsWith(filterValue.toLowerCase());
        case 'is_empty':
          return columnValue === '';
        case 'is_not_empty':
          return columnValue !== '';
        default:
          return true;
      }
    });
  });
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
        { error: 'Campaign not found', details: campaignError?.message },
        { status: 404 }
      );
    }

    // Fetch the associated config
    const { data: config, error: configError } = await supabase
      .from('user_configs')
      .select('*')
      .eq('id', campaign.config_id)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Configuration not found', details: configError?.message },
        { status: 404 }
      );
    }

    if (!config.monday_api_key || !config.board_id) {
      return NextResponse.json(
        { error: 'Campaign configuration is incomplete', details: 'Missing API key or board ID' },
        { status: 400 }
      );
    }

    // Fetch items from Monday.com - filtering by group_id
    const query = `query {
      boards(ids: ${config.board_id}) {
        groups(ids: "${config.group_id}") {
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

    if (!mondayResponse.data || !mondayResponse.data.data) {
      return NextResponse.json(
        { error: 'Failed to fetch data from Monday.com' },
        { status: 500 }
      );
    }

    const board = mondayResponse.data.data.boards?.[0];
    const group = board?.groups?.[0];

    if (!group || !group.items_page || !group.items_page.items) {
      return NextResponse.json(
        { error: 'No items found in the specified group' },
        { status: 404 }
      );
    }

    let items = group.items_page.items;

    // Filter items based on selected_items if available
    if (campaign.selected_items && campaign.selected_items.length > 0) {
      items = items.filter((item: any) => campaign.selected_items.includes(item.id));
    }

    // Apply multiple filters if they exist
    if (campaign.multiple_filters && campaign.multiple_filters.length > 0) {
      items = applyMultipleFilters(items, campaign.multiple_filters);
    }

    const preview = [];

    // Process each item
    for (const item of items) {
      const statusColumn = item.column_values.find(
        (col: any) => col.id === campaign.status_column
      );
      const phoneColumn = item.column_values.find(
        (col: any) => col.id === campaign.phone_column
      );

      if (statusColumn && statusColumn.text === campaign.status_value && phoneColumn) {
        const phoneNumber = formatPhoneNumber(phoneColumn.text);

        if (phoneNumber) {
          const processedMessage = processMessageTemplate(
            campaign.message_template,
            item.column_values
          );

          const nameColumns = item.column_values.filter(
            (col: any) => col.id.includes('name') || col.id.includes('text')
          );
          const recipientName = nameColumns.length > 0 ? nameColumns[0].text : 'Unknown';

          preview.push({
            itemName: item.name,
            phoneNumber: phoneNumber,
            message: processedMessage,
            recipientName: recipientName,
          });
        }
      }
    }

    const filtersInfo =
      campaign.multiple_filters && campaign.multiple_filters.length > 0
        ? `${campaign.multiple_filters.length} filters: ${campaign.multiple_filters
            .map((f: any) => `${f.column_id} ${f.operator} "${f.value}"`)
            .join(' AND ')}`
        : null;

    return NextResponse.json({
      preview,
      filtersInfo,
    });
  } catch (error: any) {
    console.error('Error previewing campaign messages:', error);

    // Provide more specific error details for axios errors
    if (error.response) {
      return NextResponse.json(
        {
          error: 'Failed to fetch data from Monday.com',
          details: error.response.data || error.message,
          status: error.response.status
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to preview messages', details: error.message },
      { status: 500 }
    );
  }
}
