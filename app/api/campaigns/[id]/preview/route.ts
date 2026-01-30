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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  // Logs array to capture all processing steps
  const logs: string[] = [];
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    logs.push(`[${timestamp}] ${message}`);
    console.log(message);
  };

  try {
    addLog('🚀 Starting preview generation...');

    // Fetch campaign details
    addLog('📋 Fetching campaign details...');
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      addLog(`❌ Campaign not found: ${campaignError?.message}`);
      return NextResponse.json(
        { error: 'Campaign not found', details: campaignError?.message, logs },
        { status: 404 }
      );
    }

    addLog(`✅ Campaign found: "${campaign.campaign_name}"`);

    // Fetch the associated config
    addLog('⚙️ Fetching configuration...');
    const { data: config, error: configError } = await supabase
      .from('user_configs')
      .select('*')
      .eq('id', campaign.config_id)
      .single();

    if (configError || !config) {
      addLog(`❌ Configuration not found: ${configError?.message}`);
      return NextResponse.json(
        { error: 'Configuration not found', details: configError?.message, logs },
        { status: 404 }
      );
    }

    addLog(`✅ Configuration: "${config.config_name}" (Board: ${config.board_id}, Group: ${config.group_id})`);

    if (!config.monday_api_key || !config.board_id) {
      addLog('❌ Configuration incomplete (missing API key or board ID)');
      return NextResponse.json(
        { error: 'Campaign configuration is incomplete', details: 'Missing API key or board ID', logs },
        { status: 400 }
      );
    }

    // Fetch items from Monday.com with pagination - filtering by group_id
    let allItems: any[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;
    let pageCount = 0;
    const maxPages = 50;

    addLog('📊 Starting Monday.com pagination...');

    while (hasNextPage && pageCount < maxPages) {
      pageCount++;

      const query: string = `query {
        boards(ids: ${config.board_id}) {
          groups(ids: "${config.group_id}") {
            items_page(limit: 100${cursor ? `, cursor: "${cursor}"` : ''}) {
              cursor
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

      const mondayResponse: any = await axios.post(
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

      const board: any = mondayResponse.data.data.boards?.[0];
      const group: any = board?.groups?.[0];

      if (!group || !group.items_page) {
        if (pageCount === 1) {
          return NextResponse.json(
            { error: 'No items found in the specified group' },
            { status: 404 }
          );
        }
        break;
      }

      const itemsPage: any = group.items_page;
      const items: any[] = itemsPage.items || [];

      allItems = allItems.concat(items);

      addLog(`📄 Page ${pageCount}: Fetched ${items.length} items (Total: ${allItems.length})`);

      // Check if there's a next page
      if (itemsPage.cursor && items.length === 100) {
        cursor = itemsPage.cursor;
      } else {
        hasNextPage = false;
      }
    }

    addLog(`✅ Pagination complete: ${allItems.length} total items from ${pageCount} page(s)`);

    let items = allItems;

    // Filter items based on selected_items if available
    if (campaign.selected_items && campaign.selected_items.length > 0) {
      addLog(`🔍 Applying batch selection filter (${campaign.selected_items.length} selected items)...`);
      items = items.filter((item: any) => campaign.selected_items.includes(item.id));
      addLog(`✅ After batch selection: ${items.length} items`);
    }

    // Apply multiple filters if they exist
    if (campaign.multiple_filters && campaign.multiple_filters.length > 0) {
      const beforeFilter = items.length;
      addLog(`🔍 Applying ${campaign.multiple_filters.length} advanced filter(s)...`);
      campaign.multiple_filters.forEach((filter: any, index: number) => {
        addLog(`   Filter ${index + 1}: ${filter.column_id} ${filter.operator} "${filter.value}"`);
      });
      items = applyMultipleFilters(items, campaign.multiple_filters);
      addLog(`✅ After advanced filters: ${items.length} items (filtered out ${beforeFilter - items.length})`);
    }

    const preview = [];

    // Process each item
    addLog(`🔍 Applying basic filter: ${campaign.status_column} = "${campaign.status_value}"`);
    addLog(`📞 Phone column: ${campaign.phone_column}`);

    let matchedBasicFilter = 0;
    let hasValidPhone = 0;
    let invalidPhones = 0;

    for (const item of items) {
      const statusColumn = item.column_values.find(
        (col: any) => col.id === campaign.status_column
      );
      const phoneColumn = item.column_values.find(
        (col: any) => col.id === campaign.phone_column
      );

      if (statusColumn && statusColumn.text === campaign.status_value && phoneColumn) {
        matchedBasicFilter++;
        const phoneNumber = formatPhoneNumber(phoneColumn.text);

        if (phoneNumber) {
          hasValidPhone++;
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
        } else {
          invalidPhones++;
        }
      }
    }

    addLog(`✅ After basic filter: ${matchedBasicFilter} items matched`);
    addLog(`📱 Valid phone numbers: ${hasValidPhone}${invalidPhones > 0 ? ` (${invalidPhones} invalid phones excluded)` : ''}`);

    const filtersInfo =
      campaign.multiple_filters && campaign.multiple_filters.length > 0
        ? `${campaign.multiple_filters.length} filters: ${campaign.multiple_filters
            .map((f: any) => `${f.column_id} ${f.operator} "${f.value}"`)
            .join(' AND ')}`
        : null;

    addLog(`🎉 Preview generated successfully: ${preview.length} final recipients`);

    return NextResponse.json({
      preview,
      filtersInfo,
      logs,
    });
  } catch (error: any) {
    console.error('Error previewing campaign messages:', error);
    addLog(`❌ Error: ${error.message}`);

    // Provide more specific error details for axios errors
    if (error.response) {
      addLog(`❌ Monday.com API error: ${error.response.status} - ${error.response.data?.message || error.message}`);
      return NextResponse.json(
        {
          error: 'Failed to fetch data from Monday.com',
          details: error.response.data || error.message,
          status: error.response.status,
          logs
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to preview messages', details: error.message, logs },
      { status: 500 }
    );
  }
}
