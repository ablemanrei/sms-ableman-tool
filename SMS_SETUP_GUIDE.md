# SMS Sending Setup Guide

This guide explains the complete SMS sending system for your SMS Monday platform.

## What's Been Added

### 1. Recipient Count Preview ✅
- **Location**: Campaign creation page → Review section
- **Features**:
  - Shows exact number of recipients who match your filters
  - Updates automatically when filters change
  - Green card display with icon
  - Shows "X people will receive this message"

### 2. Separate SMS Server ✅
- **Location**: `/sms-server/` directory
- **Features**:
  - Standalone Node.js Express server
  - Automated campaign execution with node-cron
  - OpenPhone SMS integration
  - Monday.com data fetching with pagination
  - Campaign and message logging
  - Can be hosted separately on Railway

## Setup Instructions

### Step 1: Database Migrations

Run these SQL files in your Supabase SQL Editor:

#### A. Campaign Logs Schema (if not already done)
```bash
database/campaign_logs_schema.sql
```

#### B. OpenPhone Fields Migration
```bash
database/add_openphone_fields.sql
```

This adds two new fields to `user_configs`:
- `openphone_api_key`
- `sender_phone`

### Step 2: Update Configuration Page

You need to add OpenPhone fields to your configuration form:

**File**: `app/configurations/page.tsx` (or wherever you edit configurations)

Add these fields to the configuration form:

```jsx
{/* OpenPhone Configuration */}
<div className="col-span-2">
  <h3 className="text-lg font-semibold text-neutral-800 mb-4">
    SMS Provider (OpenPhone)
  </h3>
</div>

<div>
  <label className="block text-sm font-medium text-neutral-700 mb-2">
    OpenPhone API Key
  </label>
  <input
    type="password"
    value={formData.openphone_api_key || ''}
    onChange={(e) =>
      setFormData({ ...formData, openphone_api_key: e.target.value })
    }
    placeholder="op_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    className="input-field"
  />
  <p className="text-xs text-neutral-500 mt-1">
    Get your API key from OpenPhone Dashboard → Settings → API Keys
  </p>
</div>

<div>
  <label className="block text-sm font-medium text-neutral-700 mb-2">
    Sender Phone Number
  </label>
  <input
    type="text"
    value={formData.sender_phone || ''}
    onChange={(e) =>
      setFormData({ ...formData, sender_phone: e.target.value })
    }
    placeholder="+1234567890"
    className="input-field"
  />
  <p className="text-xs text-neutral-500 mt-1">
    Format: +[country code][number] (e.g., +14155551234)
  </p>
</div>
```

### Step 3: Deploy SMS Server to Railway

#### A. Install Dependencies Locally (First Time)
```bash
cd sms-server
npm install
```

#### B. Test Locally
```bash
# Copy environment file
cp .env.example .env

# Edit .env with your Supabase credentials
# Then start the server
npm run dev
```

Server should start on `http://localhost:3001`

#### C. Deploy to Railway

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add SMS server with OpenPhone"
   git push
   ```

2. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure Settings**
   - Go to Settings → Build
   - Set **Root Directory** to: `sms-server`
   - Set **Start Command** to: `npm start`

4. **Add Environment Variables**
   ```
   PORT=3001
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   ```

5. **Deploy**
   - Railway will auto-deploy
   - You'll get a URL like: `https://sms-monday-server.railway.app`

### Step 4: Connect Next.js App to SMS Server

Add environment variable to your Next.js `.env.local`:

```env
NEXT_PUBLIC_SMS_SERVER_URL=https://your-sms-server.railway.app
```

### Step 5: Add "Execute Campaign" Button

Update your campaigns page to trigger SMS sending:

```jsx
// Add this function to campaigns page
const executeCampaign = async (campaignId) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SMS_SERVER_URL}/api/campaigns/${campaignId}/execute`,
      { method: 'POST' }
    );

    const data = await response.json();

    if (data.success) {
      alert('Campaign execution started! Check logs for progress.');
    }
  } catch (error) {
    console.error('Error executing campaign:', error);
    alert('Failed to execute campaign');
  }
};

// Add button to campaign card
<button
  onClick={() => executeCampaign(campaign.id)}
  disabled={!campaign.is_active}
  className="btn-primary flex items-center gap-2"
>
  <Send className="w-4 h-4" />
  Send Now
</button>
```

## How It Works

### Manual Execution Flow
1. User clicks "Send Now" button
2. Next.js app calls SMS server API: `POST /api/campaigns/:id/execute`
3. Server creates execution record in `campaign_executions` table
4. Server fetches Monday.com data with pagination
5. Server filters recipients based on campaign filters
6. Server sends SMS to each recipient via OpenPhone
7. Server logs each message in `message_logs` table
8. Execution record updated with results

### Scheduled Execution Flow
1. Cron job runs every minute on SMS server
2. Checks all active campaigns with schedules
3. Matches current time/day against schedules
4. Automatically executes matching campaigns
5. Same process as manual execution

### Recipient Counting Flow
1. User navigates to Review section in campaign creation
2. App fetches Monday.com items (already loaded)
3. Applies status filter + phone filter + advanced filters
4. Counts matching items
5. Displays count in green card

## Testing the System

### 1. Test Recipient Count
1. Create a new campaign
2. Set filters (status, phone, advanced)
3. Go to Review section
4. Should see "X people will receive this message"

### 2. Test Local SMS Server
```bash
cd sms-server
npm run dev

# In another terminal, test health endpoint
curl http://localhost:3001/health

# Test campaign execution (replace campaign-id)
curl -X POST http://localhost:3001/api/campaigns/[campaign-id]/execute
```

### 3. Test Full Flow
1. Create a configuration with OpenPhone credentials
2. Create a campaign with that configuration
3. Activate the campaign
4. Click "Send Now" button
5. Check logs page for execution status
6. Check OpenPhone dashboard for SMS delivery

## Monitoring

### View Campaign Executions
- Go to campaign → Click "View Logs" button (📄 icon)
- See all executions with status, recipient counts, timestamps

### View Individual Messages
- In logs page → Click "View Messages" on any execution
- See each SMS sent with status and delivery info

### Check SMS Server Logs
- Railway Dashboard → Your Project → Deployments → View Logs
- See cron job execution, campaign processing, errors

## Troubleshooting

### Recipient count shows 0
- Check Monday.com data is loading (columns dropdown should have options)
- Verify status value matches exactly (case-sensitive)
- Check phone column is selected and has valid data

### SMS not sending
1. Verify OpenPhone API key in configuration
2. Check phone number format: +[country code][number]
3. Check OpenPhone account has active subscription
4. Review `message_logs` table for error messages
5. Check OpenPhone dashboard for API key validity

### Scheduled campaigns not executing
1. Check SMS server is running (Railway logs)
2. Verify campaign `is_active = true`
3. Check schedule time format (HH:MM)
4. Railway uses UTC timezone by default

### SMS server not starting on Railway
1. Check environment variables are set
2. Verify Root Directory is set to `sms-server`
3. Check Railway logs for specific errors
4. Ensure Supabase service key (not anon key)

## Getting OpenPhone API Key

1. Sign up at [OpenPhone](https://www.openphone.com/)
2. Go to Settings → API Keys
3. Click "Create API Key"
4. Copy the API key (starts with `op_`)
5. Note your phone number in E.164 format (e.g., +14155551234)
6. Add both to your configuration in the SMS Monday platform

## Cost Estimates

- **Railway**: Free tier ~$5 credit/month, then ~$5-10/month
- **OpenPhone**: Check OpenPhone pricing page
- **Supabase**: Free tier sufficient for most use cases

## Security Notes

⚠️ **Important**:
- Never commit `.env` files
- Use Supabase SERVICE_KEY for SMS server (not anon key)
- OpenPhone API keys stored in database (consider encryption)
- SMS server validates campaign ownership before execution
- Rate limit recommendations: Add to prevent abuse

## Next Steps

1. ✅ Apply database migrations
2. ✅ Add OpenPhone fields to configuration page
3. ✅ Deploy SMS server to Railway
4. ✅ Test recipient count in campaign creation
5. ✅ Test manual campaign execution
6. ✅ Set up scheduled campaigns and test cron execution
7. ✅ Monitor logs and refine as needed

## Support

If you encounter issues:
1. Check Railway logs for SMS server errors
2. Check browser console for Next.js errors
3. Review Supabase logs for database issues
4. Check OpenPhone dashboard for SMS delivery status

For questions, refer to:
- `sms-server/README.md` - Detailed server documentation
- `database/campaign_logs_schema.sql` - Database schema
- OpenPhone docs: https://www.openphone.com/docs
