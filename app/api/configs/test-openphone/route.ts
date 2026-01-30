import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { openphone_api_key, sender_phone } = body;

    if (!openphone_api_key || !sender_phone) {
      return NextResponse.json(
        { error: 'Missing required fields: openphone_api_key or sender_phone' },
        { status: 400 }
      );
    }

    // Test the OpenPhone API by fetching phone numbers
    // This validates both the API key and that the sender phone exists
    try {
      const response = await axios.get(
        'https://api.openphone.com/v1/phone-numbers',
        {
          headers: {
            'Authorization': openphone_api_key,
            'Content-Type': 'application/json',
          },
        }
      );

      // Check if the sender phone is in the list of available numbers
      const phoneNumbers = response.data?.data || [];
      const senderPhoneExists = phoneNumbers.some(
        (phone: any) => phone.phoneNumber === sender_phone || phone.formattedNumber === sender_phone
      );

      if (phoneNumbers.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'API key is valid, but no phone numbers found in your account.',
          warning: true,
          availableNumbers: [],
        });
      }

      if (!senderPhoneExists) {
        return NextResponse.json({
          success: true,
          message: `API key is valid. Warning: Sender phone ${sender_phone} not found in your account.`,
          warning: true,
          availableNumbers: phoneNumbers.map((p: any) => p.phoneNumber || p.formattedNumber),
        });
      }

      return NextResponse.json({
        success: true,
        message: 'OpenPhone configuration is valid! API key and sender phone verified.',
        availableNumbers: phoneNumbers.map((p: any) => p.phoneNumber || p.formattedNumber),
      });

    } catch (error: any) {
      if (error.response?.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid OpenPhone API key. Please check your API key and try again.'
          },
          { status: 401 }
        );
      }

      if (error.response?.status === 403) {
        return NextResponse.json(
          {
            success: false,
            error: 'Access forbidden. Your API key may not have the required permissions.'
          },
          { status: 403 }
        );
      }

      throw error;
    }

  } catch (error: any) {
    console.error('Error testing OpenPhone config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test OpenPhone configuration',
        details: error.response?.data || error.message
      },
      { status: 500 }
    );
  }
}
