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

// Helper function to process test message template
function processTestMessageTemplate(template: string): string {
  let processedMessage = template;
  const regex = /\{([^}]+)\}/g;
  processedMessage = processedMessage.replace(regex, (match, columnId) => {
    return '[TEST]';
  });
  return processedMessage;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone_number, message_template, config_id } = body;

    if (!phone_number || !message_template || !config_id) {
      return NextResponse.json(
        { error: 'Missing required fields: phone_number, message_template, or config_id' },
        { status: 400 }
      );
    }

    // Fetch config
    const { data: config, error: configError } = await supabase
      .from('user_configs')
      .select('*')
      .eq('id', config_id)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    if (!config.openphone_api_key || !config.sender_phone) {
      return NextResponse.json(
        { error: 'OpenPhone configuration is incomplete. Please add OpenPhone API key and sender phone.' },
        { status: 400 }
      );
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone_number);
    if (!formattedPhone) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Please use 10-digit US number or international format with +' },
        { status: 400 }
      );
    }

    // Process message template (replace placeholders with [TEST])
    const processedMessage = processTestMessageTemplate(message_template);

    // Send test SMS
    const result = await sendSMS(formattedPhone, processedMessage, config.openphone_api_key, config.sender_phone);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test message sent successfully',
        phone: formattedPhone,
        content: processedMessage,
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to send test message', details: result.error },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Error sending test message:', error);
    return NextResponse.json(
      { error: 'Failed to send test message', details: error.message },
      { status: 500 }
    );
  }
}
