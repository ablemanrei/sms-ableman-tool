# ⏰ Timezone Configuration - EST

Your SMS campaign platform now uses **Eastern Standard Time (EST)** for all scheduling.

## ✅ What's Been Updated

### 1. Frontend (Next.js)
- ✅ Schedule section shows "Time (EST)" label
- ✅ Blue info box explains all times are in EST
- ✅ Both campaign creation page and edit modal updated

### 2. Backend (SMS Server)
- ✅ Cron job uses `America/New_York` timezone
- ✅ All schedule checks use EST time
- ✅ Health check endpoint shows EST time
- ✅ Server logs show EST time in cron execution

## 🚀 How It Works

### Schedule Execution

When you set a schedule:
- **Time entered**: 9:00 AM
- **Time interpreted**: 9:00 AM EST
- **Cron executes**: At 9:00 AM EST (regardless of server timezone)

### Example:

**Weekly Schedule:**
- Day: Monday
- Time: 09:00
- **Result**: Campaign executes every Monday at 9:00 AM EST

**Once Schedule:**
- Date: 2026-02-01
- Time: 14:30
- **Result**: Campaign executes on February 1, 2026 at 2:30 PM EST

## 🔧 Testing Timezone

### Check Server Timezone:

```bash
curl http://localhost:3001/health
```

**Response includes:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-28T...",
  "est_time": "1/28/2026, 3:30:00 PM",
  "timezone": "America/New_York (EST)",
  "version": "2.0.0",
  "provider": "OpenPhone"
}
```

### Check Cron Logs:

When the cron runs, you'll see:
```
[CRON] Checking campaigns at 2026-01-28T20:30:00.000Z (EST: Tuesday, 15:30)
```

## ⚠️ Important Notes

### 1. Daylight Saving Time
- America/New_York automatically handles DST
- EST (winter): UTC-5
- EDT (summer): UTC-4
- Your schedules always execute at the same local time

### 2. Server Deployment
If deploying to Railway or other hosting:
- Server may run in UTC or another timezone
- **Cron still executes in EST** (configured in code)
- No manual timezone conversion needed

### 3. Schedule Display
- All times shown to users are in EST
- When viewing logs, times are in EST
- No confusion about timezone conversion

## 🎯 Schedule Types & Timezone

### Once (Send Once)
- Picks a **specific date and time in EST**
- Example: Feb 15, 2026 at 10:00 AM EST
- Executes exactly once at that EST time

### Weekly
- Picks a **day of week and time in EST**
- Example: Every Monday at 9:00 AM EST
- Repeats every week at that EST time

### Monthly
- Picks a **day of month and time in EST**
- Example: 1st of every month at 8:00 AM EST
- Repeats every month at that EST time

## ✅ What Users See

### Campaign Creation:
```
Schedule Type: Weekly
Day of Week: Monday
Time (EST): 09:00
  Eastern Standard Time

⏰ Timezone: All times are in EST (Eastern Standard Time)
```

### Scheduled Times List:
```
Every Monday at 09:00
```

### Campaign Logs:
```
Started at: 2026-01-28 09:00:00 (EST)
```

## 🔍 Troubleshooting

### Campaign not executing at expected time?

**Check:**
1. SMS server is running
2. Campaign is active (green dot)
3. Check SMS server logs for cron execution
4. Verify your local time vs EST

**Example:**
- You're in PST (UTC-8)
- Schedule: Monday 9:00 AM EST
- That's Monday 6:00 AM PST for you
- Server executes at 9:00 AM EST regardless of your timezone

### How to verify EST execution?

**Option 1 - Health Check:**
```bash
curl http://localhost:3001/health
```
Shows current EST time

**Option 2 - Server Logs:**
Check terminal running SMS server:
```
[CRON] Checking campaigns at ... (EST: Monday, 09:00)
```

**Option 3 - Campaign Logs:**
Go to campaign → View Logs → See execution timestamp in EST

## 📊 Timezone Comparison

| Your Location | Your Time | EST Time | Campaign Executes |
|---------------|-----------|----------|-------------------|
| EST (New York) | 9:00 AM | 9:00 AM | ✅ Now |
| PST (LA) | 6:00 AM | 9:00 AM | ✅ Now |
| GMT (London) | 2:00 PM | 9:00 AM | ✅ Now |
| IST (India) | 7:30 PM | 9:00 AM | ✅ Now |

All campaigns execute at **9:00 AM EST** regardless of your location!

## 🎓 Best Practices

1. **Set schedules in EST** - Always think in EST when creating schedules
2. **Test with health check** - Verify server timezone before deploying
3. **Check cron logs** - Monitor logs to see exact execution times
4. **Document for team** - Share this guide with team members
5. **Consider your audience** - If your recipients are in EST, they'll receive messages at the scheduled EST time

## 🚀 Ready to Go!

Your platform is now fully configured for EST timezone:
- ✅ Frontend shows EST labels
- ✅ Backend runs on EST cron
- ✅ All schedules execute in EST
- ✅ No manual timezone conversion needed

**Start the servers and test it!** 🎉
