'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Toast from '@/components/ui/Toast';
import {
  BarChart3,
  TrendingUp,
  MessageSquare,
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  RefreshCw,
  Download,
  Filter,
  Clock,
} from 'lucide-react';
import { authUtils } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function AnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Date filters
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Last 30 days
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Data
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
    successRate: 0,
    totalExecutions: 0,
    avgMessagesPerCampaign: 0,
  });

  const [campaignStats, setCampaignStats] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateFrom, dateTo]);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const user = authUtils.getUser();
      const workspace = authUtils.getWorkspace();

      if (!user) return;

      // Fetch campaigns
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, campaign_name, is_active')
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`);

      // Fetch messages in date range
      const { data: messages } = await supabase
        .from('sms_history')
        .select('*')
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`)
        .gte('sent_at', `${dateFrom}T00:00:00`)
        .lte('sent_at', `${dateTo}T23:59:59`);

      // Fetch executions
      const { data: executions } = await supabase
        .from('campaign_executions')
        .select(`
          *,
          campaigns!inner(user_id, workspace_id)
        `)
        .or(
          `campaigns.user_id.eq.${user.id},campaigns.workspace_id.eq.${workspace?.id || ''}`,
          { foreignTable: 'campaigns' }
        )
        .gte('started_at', `${dateFrom}T00:00:00`)
        .lte('started_at', `${dateTo}T23:59:59`);

      // Calculate overall stats
      const totalMessages = messages?.length || 0;
      const successfulMessages = messages?.filter(m => m.status === 'sent').length || 0;
      const failedMessages = messages?.filter(m => m.status !== 'sent').length || 0;
      const successRate = totalMessages > 0 ? Math.round((successfulMessages / totalMessages) * 100) : 0;

      setStats({
        totalCampaigns: campaigns?.length || 0,
        activeCampaigns: campaigns?.filter(c => c.is_active).length || 0,
        totalMessages,
        successfulMessages,
        failedMessages,
        successRate,
        totalExecutions: executions?.length || 0,
        avgMessagesPerCampaign: campaigns?.length ? Math.round(totalMessages / campaigns.length) : 0,
      });

      // Calculate per-campaign stats
      const campaignStatsMap = new Map();
      messages?.forEach(msg => {
        if (!msg.campaign_id) return;

        if (!campaignStatsMap.has(msg.campaign_id)) {
          campaignStatsMap.set(msg.campaign_id, {
            campaign_id: msg.campaign_id,
            campaign_name: msg.campaign_name || 'Unknown',
            total: 0,
            sent: 0,
            failed: 0,
            successRate: 0,
          });
        }

        const stat = campaignStatsMap.get(msg.campaign_id);
        stat.total++;
        if (msg.status === 'sent') stat.sent++;
        else stat.failed++;
      });

      const campaignStatsArray = Array.from(campaignStatsMap.values())
        .map(stat => ({
          ...stat,
          successRate: stat.total > 0 ? Math.round((stat.sent / stat.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      setCampaignStats(campaignStatsArray);

      // Calculate daily stats
      const dailyStatsMap = new Map();
      messages?.forEach(msg => {
        const date = new Date(msg.sent_at).toISOString().split('T')[0];

        if (!dailyStatsMap.has(date)) {
          dailyStatsMap.set(date, {
            date,
            total: 0,
            sent: 0,
            failed: 0,
          });
        }

        const stat = dailyStatsMap.get(date);
        stat.total++;
        if (msg.status === 'sent') stat.sent++;
        else stat.failed++;
      });

      const dailyStatsArray = Array.from(dailyStatsMap.values())
        .sort((a, b) => a.date.localeCompare(b.date));

      setDailyStats(dailyStatsArray);

    } catch (error) {
      console.error('Error fetching analytics:', error);
      setToast({ message: 'Failed to load analytics', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const csvHeaders = ['Campaign', 'Total Messages', 'Successful', 'Failed', 'Success Rate'];
      const csvRows = campaignStats.map(stat => [
        stat.campaign_name,
        stat.total,
        stat.sent,
        stat.failed,
        `${stat.successRate}%`,
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `analytics-${dateFrom}-to-${dateTo}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToast({ message: 'Analytics exported successfully!', type: 'success' });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setToast({ message: 'Failed to export analytics', type: 'error' });
    }
  };

  // Calculate max for chart scaling
  const maxDailyMessages = Math.max(...dailyStats.map(d => d.total), 1);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">Analytics</h1>
              <p className="text-sm text-neutral-600 mt-1">
                Insights and performance metrics for your campaigns
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchAnalytics}
                disabled={isLoading}
                className="btn-outline flex items-center gap-2 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExportCSV}
                disabled={campaignStats.length === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-neutral-600" />
              <span className="text-sm font-medium text-neutral-700">Date Range:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input-field text-sm"
                />
                <span className="text-neutral-500">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => {
                    const date = new Date();
                    date.setDate(date.getDate() - 7);
                    setDateFrom(date.toISOString().split('T')[0]);
                    setDateTo(new Date().toISOString().split('T')[0]);
                  }}
                  className="text-xs bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded transition-colors"
                >
                  Last 7 days
                </button>
                <button
                  onClick={() => {
                    const date = new Date();
                    date.setDate(date.getDate() - 30);
                    setDateFrom(date.toISOString().split('T')[0]);
                    setDateTo(new Date().toISOString().split('T')[0]);
                  }}
                  className="text-xs bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded transition-colors"
                >
                  Last 30 days
                </button>
                <button
                  onClick={() => {
                    const date = new Date();
                    date.setDate(date.getDate() - 90);
                    setDateFrom(date.toISOString().split('T')[0]);
                    setDateTo(new Date().toISOString().split('T')[0]);
                  }}
                  className="text-xs bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded transition-colors"
                >
                  Last 90 days
                </button>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="card p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-neutral-600">Total Campaigns</span>
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-neutral-900">{stats.totalCampaigns}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  {stats.activeCampaigns} active
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-neutral-600">Total Messages</span>
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-neutral-900">{stats.totalMessages}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  {stats.totalExecutions} executions
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-neutral-600">Success Rate</span>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-green-600">{stats.successRate}%</div>
                <div className="text-xs text-neutral-500 mt-1">
                  {stats.successfulMessages} successful
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-neutral-600">Avg per Campaign</span>
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-neutral-900">{stats.avgMessagesPerCampaign}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  messages per campaign
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Messages Chart */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Daily Message Volume
                </h3>
                {dailyStats.length > 0 ? (
                  <div className="space-y-2">
                    {dailyStats.map((day) => (
                      <div key={day.date} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-neutral-600">{new Date(day.date).toLocaleDateString()}</span>
                          <span className="font-medium text-neutral-900">{day.total} messages</span>
                        </div>
                        <div className="flex gap-1 h-6">
                          <div
                            className="bg-green-500 rounded transition-all"
                            style={{ width: `${(day.sent / maxDailyMessages) * 100}%` }}
                            title={`${day.sent} sent`}
                          />
                          <div
                            className="bg-red-500 rounded transition-all"
                            style={{ width: `${(day.failed / maxDailyMessages) * 100}%` }}
                            title={`${day.failed} failed`}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-4 text-xs text-neutral-600 pt-2 border-t border-neutral-200">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span>Sent</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span>Failed</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-neutral-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No data for selected period</p>
                  </div>
                )}
              </div>

              {/* Success vs Failed */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                  Message Status Breakdown
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-neutral-700">Successful</span>
                      </div>
                      <span className="text-2xl font-bold text-green-600">{stats.successfulMessages}</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all"
                        style={{ width: `${stats.successRate}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="text-sm font-medium text-neutral-700">Failed</span>
                      </div>
                      <span className="text-2xl font-bold text-red-600">{stats.failedMessages}</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-3">
                      <div
                        className="bg-red-500 h-3 rounded-full transition-all"
                        style={{ width: `${100 - stats.successRate}%` }}
                      />
                    </div>
                  </div>

                  {stats.totalMessages > 0 && (
                    <div className="pt-4 border-t border-neutral-200">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-neutral-900 mb-1">
                          {stats.successRate}%
                        </div>
                        <div className="text-sm text-neutral-600">Overall Success Rate</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Campaign Performance Table */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Top Campaigns by Volume
              </h3>
              {campaignStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200">
                        <th className="text-left p-3 font-semibold text-neutral-700 text-sm">
                          Campaign
                        </th>
                        <th className="text-right p-3 font-semibold text-neutral-700 text-sm">
                          Total
                        </th>
                        <th className="text-right p-3 font-semibold text-neutral-700 text-sm">
                          Sent
                        </th>
                        <th className="text-right p-3 font-semibold text-neutral-700 text-sm">
                          Failed
                        </th>
                        <th className="text-right p-3 font-semibold text-neutral-700 text-sm">
                          Success Rate
                        </th>
                        <th className="text-left p-3 font-semibold text-neutral-700 text-sm">
                          Performance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignStats.map((stat) => (
                        <tr key={stat.campaign_id} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="p-3">
                            <span className="font-medium text-neutral-900">{stat.campaign_name}</span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-medium text-neutral-900">{stat.total}</span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-green-600">{stat.sent}</span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-red-600">{stat.failed}</span>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`font-semibold ${
                              stat.successRate >= 80 ? 'text-green-600' :
                              stat.successRate >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {stat.successRate}%
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="w-full bg-neutral-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  stat.successRate >= 80 ? 'bg-green-500' :
                                  stat.successRate >= 60 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${stat.successRate}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No campaign data available</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Toast */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
