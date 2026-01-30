'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  MessageSquare,
  Settings,
  Send,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
} from 'lucide-react';
import { authUtils } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { DashboardStats } from '@/lib/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalMessagesSent: 0,
    totalConfigurations: 0,
    activeCampaigns: 0,
    lastActivity: null,
    recentMessages: [],
    campaignStats: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const user = authUtils.getUser();
      const workspace = authUtils.getWorkspace();

      if (!user) return;

      // Fetch configurations count
      const { count: configCount } = await supabase
        .from('user_configs')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`);

      // Fetch active campaigns count
      const { count: campaignCount } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`);

      // Fetch total messages sent
      const { count: messagesCount } = await supabase
        .from('sms_history')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`);

      // Fetch recent messages
      const { data: recentMessages } = await supabase
        .from('sms_history')
        .select('*')
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`)
        .order('sent_at', { ascending: false })
        .limit(5);

      // Fetch last activity
      const { data: lastActivity } = await supabase
        .from('sms_history')
        .select('sent_at')
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();

      setStats({
        totalMessagesSent: messagesCount || 0,
        totalConfigurations: configCount || 0,
        activeCampaigns: campaignCount || 0,
        lastActivity: lastActivity?.sent_at || null,
        recentMessages: recentMessages || [],
        campaignStats: [],
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const statCards = [
    {
      icon: MessageSquare,
      label: 'Messages Sent',
      value: stats.totalMessagesSent.toLocaleString(),
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      icon: Settings,
      label: 'Configurations',
      value: stats.totalConfigurations.toString(),
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      icon: Send,
      label: 'Active Campaigns',
      value: stats.activeCampaigns.toString(),
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      icon: Activity,
      label: 'Last Activity',
      value: stats.lastActivity
        ? new Date(stats.lastActivity).toLocaleDateString()
        : 'No activity',
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-800">Dashboard</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Welcome back! Here's your SMS campaign overview.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/configurations"
              className="btn-outline flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Configuration</span>
            </Link>
            <Link
              href="/campaigns"
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Campaign</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-12 w-12 bg-neutral-200 rounded-lg mb-4"></div>
                <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-neutral-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className="card p-6 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div
                    className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center mb-4`}
                  >
                    <Icon className={`w-6 h-6 ${stat.textColor}`} />
                  </div>
                  <p className="text-sm text-neutral-600 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-neutral-800">
                    {stat.value}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 card">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-800 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Messages
              </h3>
              <Link
                href="/messages"
                className="text-sm text-primary-500 hover:text-primary-600"
              >
                View All
              </Link>
            </div>
            <div className="divide-y divide-neutral-200">
              {stats.recentMessages.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                  <p>No messages sent yet</p>
                  <p className="text-sm mt-1">
                    Create a campaign to start sending messages
                  </p>
                </div>
              ) : (
                stats.recentMessages.map((message) => (
                  <div key={message.id} className="p-4 hover:bg-neutral-50">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.status === 'sent'
                            ? 'bg-green-100'
                            : 'bg-red-100'
                        }`}
                      >
                        {message.status === 'sent' ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="font-medium text-sm text-neutral-800">
                            {message.recipient_name || message.recipient_phone}
                          </p>
                          <span
                            className={`status-badge ${
                              message.status === 'sent'
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : 'bg-red-100 text-red-700 border-red-200'
                            }`}
                          >
                            {message.status}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600 line-clamp-1">
                          {message.message_content}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {formatDate(message.sent_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card">
            <div className="p-4 border-b border-neutral-200">
              <h3 className="font-semibold text-neutral-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Quick Stats
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-600">Success Rate</span>
                  <span className="text-sm font-semibold text-green-600">
                    100%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full w-full"></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-600">
                    Campaign Health
                  </span>
                  <span className="text-sm font-semibold text-blue-600">
                    Active
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full w-3/4"></div>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-200">
                <Link
                  href="/analytics"
                  className="text-sm text-primary-500 hover:text-primary-600 flex items-center gap-1"
                >
                  <span>View detailed analytics</span>
                  <TrendingUp className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
