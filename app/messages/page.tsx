'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Toast from '@/components/ui/Toast';
import SearchableSelect from '@/components/ui/SearchableSelect';
import {
  MessageSquare,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Calendar,
  Phone,
  User,
  X as CloseIcon,
  Download,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { authUtils } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface MessageLog {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  message_content: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  campaign_id: string;
  campaign_name: string;
  campaign_execution_id: string;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'failed'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 30;

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Reset to page 1 when filters change (but not when page changes)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCampaign, filterStatus, filterDateFrom, filterDateTo]);

  // Fetch data when page or filters change
  useEffect(() => {
    fetchData();
  }, [currentPage, searchQuery, filterCampaign, filterStatus, filterDateFrom, filterDateTo]);

  const fetchCampaigns = async () => {
    try {
      const user = authUtils.getUser();
      const workspace = authUtils.getWorkspace();

      if (!user) return;

      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('id, campaign_name')
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`)
        .order('campaign_name');

      setCampaigns(campaignsData || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const user = authUtils.getUser();
      const workspace = authUtils.getWorkspace();

      if (!user) return;

      // Build query with filters
      let query = supabase
        .from('sms_history')
        .select('*', { count: 'exact' })
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`);

      // Apply campaign filter
      if (filterCampaign) {
        query = query.eq('campaign_id', filterCampaign);
      }

      // Apply status filter
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      // Apply date range filters
      if (filterDateFrom) {
        query = query.gte('sent_at', new Date(filterDateFrom).toISOString());
      }
      if (filterDateTo) {
        const endDate = new Date(filterDateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('sent_at', endDate.toISOString());
      }

      // Apply search filter (using ilike for case-insensitive search)
      if (searchQuery) {
        query = query.or(
          `recipient_name.ilike.%${searchQuery}%,recipient_phone.ilike.%${searchQuery}%,message_content.ilike.%${searchQuery}%`
        );
      }

      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: messagesData, error, count } = await query
        .order('sent_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }

      setMessages(messagesData || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setToast({ message: 'Failed to load messages', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setToast({ message: 'Preparing export...', type: 'info' });

      const user = authUtils.getUser();
      const workspace = authUtils.getWorkspace();

      if (!user) return;

      // Build query with same filters (but fetch ALL records for export)
      let query = supabase
        .from('sms_history')
        .select('*')
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`);

      if (filterCampaign) {
        query = query.eq('campaign_id', filterCampaign);
      }
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      if (filterDateFrom) {
        query = query.gte('sent_at', new Date(filterDateFrom).toISOString());
      }
      if (filterDateTo) {
        const endDate = new Date(filterDateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('sent_at', endDate.toISOString());
      }
      if (searchQuery) {
        query = query.or(
          `recipient_name.ilike.%${searchQuery}%,recipient_phone.ilike.%${searchQuery}%,message_content.ilike.%${searchQuery}%`
        );
      }

      const { data: allMessages, error } = await query
        .order('sent_at', { ascending: false })
        .limit(5000); // Reasonable limit for export

      if (error) throw error;

      const csvHeaders = [
        'Date/Time',
        'Campaign',
        'Recipient Name',
        'Phone Number',
        'Message',
        'Status',
        'Error',
      ];

      const csvRows = (allMessages || []).map((msg) => [
        new Date(msg.sent_at).toLocaleString(),
        msg.campaign_name || 'N/A',
        msg.recipient_name || 'Unknown',
        msg.recipient_phone,
        `"${msg.message_content.replace(/"/g, '""')}"`,
        msg.status,
        msg.error_message ? `"${msg.error_message.replace(/"/g, '""')}"` : '',
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map((row) => row.join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `sms-messages-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToast({ message: `${allMessages?.length || 0} messages exported successfully!`, type: 'success' });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setToast({ message: 'Failed to export messages', type: 'error' });
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Statistics
  const stats = {
    total: totalCount,
    sent: messages.filter((m) => m.status === 'sent').length,
    failed: messages.filter((m) => m.status === 'failed').length,
    successRate:
      messages.length > 0
        ? Math.round((messages.filter((m) => m.status === 'sent').length / messages.length) * 100)
        : 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">Message History</h1>
              <p className="text-sm text-neutral-600 mt-1">
                View all SMS messages sent from your campaigns
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="btn-outline flex items-center gap-2 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExportCSV}
                disabled={totalCount === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-600 mb-1">Total Messages</p>
                  <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-600 mb-1">Sent Successfully</p>
                  <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-600 mb-1">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-600 mb-1">Success Rate</p>
                  <p className="text-2xl font-bold text-neutral-900">{stats.successRate}%</p>
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="input-field pl-9 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                    title="Clear search"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Campaign Filter */}
              <div className="relative">
                <SearchableSelect
                  value={filterCampaign}
                  onChange={(value) => setFilterCampaign(value)}
                  options={[
                    { value: '', label: 'All Campaigns' },
                    ...campaigns.map((campaign) => ({
                      value: campaign.id,
                      label: campaign.campaign_name,
                    })),
                  ]}
                  placeholder="All Campaigns"
                />
                {filterCampaign && (
                  <button
                    onClick={() => setFilterCampaign('')}
                    className="absolute right-9 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors z-10"
                    title="Clear filter"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="relative">
                <SearchableSelect
                  value={filterStatus}
                  onChange={(value) => setFilterStatus(value as 'all' | 'sent' | 'failed')}
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'sent', label: 'Sent' },
                    { value: 'failed', label: 'Failed' },
                  ]}
                  placeholder="All Status"
                />
                {filterStatus !== 'all' && (
                  <button
                    onClick={() => setFilterStatus('all')}
                    className="absolute right-9 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors z-10"
                    title="Clear filter"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* From Date */}
              <div className="relative">
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="input-field text-sm"
                  placeholder="From Date"
                />
                {filterDateFrom && (
                  <button
                    onClick={() => setFilterDateFrom('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors z-10"
                    title="Clear date"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* To Date */}
              <div className="relative">
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="input-field text-sm"
                  placeholder="To Date"
                />
                {filterDateTo && (
                  <button
                    onClick={() => setFilterDateTo('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors z-10"
                    title="Clear date"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Results count */}
            <div className="mt-3 pt-3 border-t border-neutral-200">
              <p className="text-xs text-neutral-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalCount)} of{' '}
                {totalCount} messages
              </p>
            </div>
          </div>
        </div>

        {/* Messages Table */}
        {isLoading ? (
          <div className="card p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="card p-12 text-center">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">
              {searchQuery || filterCampaign || filterStatus !== 'all' || filterDateFrom || filterDateTo
                ? 'No messages match your filters'
                : 'No messages yet'}
            </h3>
            <p className="text-neutral-600">
              {searchQuery || filterCampaign || filterStatus !== 'all' || filterDateFrom || filterDateTo
                ? 'Try adjusting your search or filter criteria'
                : 'Messages will appear here once you execute campaigns'}
            </p>
          </div>
        ) : (
          <>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200">
                      <th className="text-left p-4 font-semibold text-neutral-700 text-sm">
                        Date & Time
                      </th>
                      <th className="text-left p-4 font-semibold text-neutral-700 text-sm">
                        Campaign
                      </th>
                      <th className="text-left p-4 font-semibold text-neutral-700 text-sm">
                        Recipient
                      </th>
                      <th className="text-left p-4 font-semibold text-neutral-700 text-sm">
                        Phone
                      </th>
                      <th className="text-left p-4 font-semibold text-neutral-700 text-sm">
                        Message
                      </th>
                      <th className="text-left p-4 font-semibold text-neutral-700 text-sm">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((message) => (
                      <tr
                        key={message.id}
                        className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-neutral-400" />
                            <div>
                              <div className="font-medium text-neutral-900">
                                {new Date(message.sent_at).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-neutral-500">
                                {new Date(message.sent_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-neutral-800">
                            {message.campaign_name || 'N/A'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-neutral-400" />
                            <span className="text-sm text-neutral-900">
                              {message.recipient_name || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-neutral-400" />
                            <span className="text-sm font-mono text-neutral-700">
                              {message.recipient_phone}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="max-w-md">
                            <p className="text-sm text-neutral-700 line-clamp-2">
                              {message.message_content}
                            </p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            {message.status === 'sent' ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="text-sm font-medium text-green-700">Sent</span>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2">
                                  <XCircle className="w-5 h-5 text-red-600" />
                                  <span className="text-sm font-medium text-red-700">Failed</span>
                                </div>
                                {message.error_message && (
                                  <p className="text-xs text-red-600 mt-1 max-w-xs">
                                    {message.error_message}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-neutral-200">
                <p className="text-sm text-neutral-600">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="btn-outline px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-outline px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-outline px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="btn-outline px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
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
