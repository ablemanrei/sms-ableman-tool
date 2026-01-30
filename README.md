# SMS Monday - Campaign Management Platform

A modern Next.js application for managing SMS campaigns integrated with Monday.com and OpenPhone.

## Features

- **Dashboard**: Real-time overview of campaigns, messages, and statistics
- **Configurations**: Manage Monday.com and OpenPhone API configurations with CRUD operations
- **Workspace Support**: Users in the same workspace can view and manage shared campaigns
- **Beautiful UI**: Modern design based on professional seller platform patterns
- **Responsive**: Works seamlessly on desktop, tablet, and mobile devices

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **State Management**: React Hooks + localStorage

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase account with database set up

### Installation

1. Clone the repository or navigate to the project directory:
   ```bash
   cd sms-campaign-platform
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - The `.env.local` file should already contain your Supabase credentials
   - If not, create it with:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
sms-campaign-platform/
├── app/                      # Next.js App Router pages
│   ├── dashboard/           # Dashboard page
│   ├── configurations/      # Configurations CRUD
│   ├── campaigns/           # Campaigns (coming soon)
│   ├── messages/            # Message history (coming soon)
│   ├── analytics/           # Analytics (coming soon)
│   ├── templates/           # Templates (coming soon)
│   └── login/               # Authentication
├── components/
│   ├── layout/              # Layout components (Sidebar, DashboardLayout)
│   └── ui/                  # Reusable UI components (Modal, etc.)
├── lib/
│   ├── supabase.ts          # Supabase client
│   ├── types.ts             # TypeScript types
│   └── auth.ts              # Authentication utilities
└── public/                  # Static assets
```

## Database Schema

The application uses the following main tables:

- **workspaces**: Workspace definitions
- **workspace_members**: User-workspace relationships
- **user_configs**: Monday.com and OpenPhone configurations
- **campaigns**: SMS campaign definitions
- **campaign_schedules**: Campaign scheduling information
- **sms_history**: Message delivery logs
- **integrations**: Integration settings

## Deployment

### Deploy to Railway (Recommended)

This frontend should be deployed alongside your existing Express backend:

1. Create a new service in Railway
2. Connect your GitHub repository
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

The backend with node-cron should remain a separate service to ensure continuous cron job execution.

### Build for Production

```bash
npm run build
npm start
```

## Development Notes

- **Authentication**: Currently uses simple email-based login. Passwords should be hashed in production.
- **Workspace Model**: Users can belong to workspaces and see each other's campaigns
- **API Integration**: Backend API endpoints should be configured to match your Express server URL
- **Cron Jobs**: Keep the Express backend separate for reliable scheduling

## Next Steps

1. **Campaigns Page**: Build full campaign management with scheduling
2. **Messages Page**: Display message history with filtering
3. **Analytics Page**: Add charts and statistics
4. **Templates Page**: Create reusable message templates
5. **Connect to Backend**: Integrate with your Express API for campaign execution

## UI Design Credits

The UI design is inspired by modern SaaS platforms with:
- Primary Color: #112F58 (Dark Blue)
- Secondary Color: #472F97 (Purple)
- Clean, professional card-based layouts
- Smooth animations and transitions
- Mobile-first responsive design

## License

MIT

## Support

For issues or questions, please contact your development team.
