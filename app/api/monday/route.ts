import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { api_key, query, variables } = body;

    if (!api_key || !query) {
      return NextResponse.json(
        { error: 'Missing required fields: api_key or query' },
        { status: 400 }
      );
    }

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: api_key,
      },
      body: JSON.stringify(variables ? { query, variables } : { query }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Monday proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to reach Monday.com API', details: error.message },
      { status: 502 }
    );
  }
}
