'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Toast from '@/components/ui/Toast';
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  Users,
  Play,
  Pause,
  Send,
  Calendar,
  FileText,
  Copy,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  Settings,
  BarChart3,
} from 'lucide-react';
import { authUtils } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function CampaignDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [executions, setExecutions] = useState<any[]>([]);
  const [messageLogs, setMessageLogs] = useState<any[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Preview states
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewFiltersInfo, setPreviewFiltersInfo] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'summary' | 'table' | 'sample'>('summary');
  const [previewPage, setPreviewPage] = useState(1);
  const [previewSearch, setPreviewSearch] = useState('');
  const previewPerPage = 20;

  // Content switcher state for execution logs
  const [activeTab, setActiveTab] = useState<'overview' | 'messages'>('overview');

  // Main view tabs
  const [mainView, setMainView] = useState<'details' | 'preview' | 'executions'>('details');

  // Modal and Toast states
  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  useEffect(() => {
    fetchCampaignDetails();
  }, [campaignId]);

  // Auto-refresh executions every 10 seconds to show real-time updates
  useEffect(() => {
    // Only poll if campaign is active or has pending/running executions
    const shouldPoll = campaign?.is_active ||
                       executions.some(e => e.status === 'pending' || e.status === 'running');

    if (!shouldPoll) return;

    const pollInterval = setInterval(() => {
      fetchCampaignDetails();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [campaign?.is_active, executions]);

  const fetchCampaignDetails = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);

      const user = authUtils.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          user_configs(*),
          campaign_schedules(*),
          campaign_executions(
            id,
            status,
            execution_type,
            started_at,
            completed_at,
            total_recipients,
            successful_sends,
            failed_sends,
            error_message
          )
        `)
        .eq('id', campaignId)
        .single();

      if (error) throw error;

      setCampaign(data);

      // Fetch executions separately with better sorting
      const { data: executionsData, error: execError } = await supabase
        .from('campaign_executions')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('started_at', { ascending: false });

      if (!execError && executionsData) {
        setExecutions(executionsData);
        // Auto-select first execution
        if (executionsData.length > 0) {
          setSelectedExecution(executionsData[0].id);
          fetchMessageLogs(executionsData[0].id);
        }
      }

      if (isManualRefresh) {
        setToast({ message: 'Campaign data refreshed', type: 'success' });
      }

      // Update last refreshed timestamp
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching campaign details:', error);
      setToast({ message: 'Failed to load campaign details', type: 'error' });
    } finally {
      setIsLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchCampaignDetails(true);
  };

  const fetchMessageLogs = async (executionId: string) => {
    try {
      const { data, error } = await supabase
        .from('message_logs')
        .select('*')
        .eq('execution_id', executionId)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setMessageLogs(data || []);
    } catch (error) {
      console.error('Error fetching message logs:', error);
    }
  };

  const exportPreviewToCSV = () => {
    if (previewData.length === 0) return;

    const headers = ['#', 'Name', 'Phone', 'Message', 'Length'];
    const rows = previewData.map((recipient, index) => [
      index + 1,
      recipient.recipientName,
      recipient.phoneNumber,
      recipient.message.replace(/"/g, '""'), // Escape quotes
      recipient.message.length
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${campaign?.campaign_name || 'campaign'}_preview_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToast({
      message: `Exported ${previewData.length} messages to CSV`,
      type: 'success'
    });
  };

  const copyAllMessages = () => {
    const messagesText = previewData.map((recipient, index) =>
      `${index + 1}. ${recipient.recipientName} (${recipient.phoneNumber}):\n${recipient.message}\n`
    ).join('\n');

    navigator.clipboard.writeText(messagesText).then(() => {
      setToast({
        message: 'All messages copied to clipboard',
        type: 'success'
      });
    }).catch(() => {
      setToast({
        message: 'Failed to copy messages',
        type: 'error'
      });
    });
  };

  const fetchPreview = async () => {
    try {
      setIsLoadingPreview(true);
      setShowPreview(true);

      const response = await fetch(
        `/api/campaigns/${campaignId}/preview`,
        { method: 'POST' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load preview');
      }

      setPreviewData(data.preview || []);
      setPreviewFiltersInfo(data.filtersInfo || null);
    } catch (error: any) {
      console.error('Error loading preview:', error);
      setToast({ message: `Failed to load preview: ${error.message}`, type: 'error' });
      setShowPreview(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ is_active: !campaign.is_active })
        .eq('id', campaignId);

      if (error) throw error;

      setCampaign({ ...campaign, is_active: !campaign.is_active });
      setToast({
        message: `Campaign ${!campaign.is_active ? 'activated' : 'deactivated'} successfully`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error toggling campaign:', error);
      setToast({ message: 'Failed to toggle campaign status', type: 'error' });
    }
  };

  const confirmExecuteCampaign = async () => {
    setShowExecuteConfirm(false);

    try {
      setIsSending(true);

      const response = await fetch(
        `/api/campaigns/${campaignId}/execute`,
        { method: 'POST' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute campaign');
      }

      setToast({
        message: `Campaign executed successfully! Sent: ${data.successfulSends}, Failed: ${data.failedSends}`,
        type: 'success'
      });

      // Refresh to show updated execution logs
      fetchCampaignDetails();
    } catch (error: any) {
      console.error('Error executing campaign:', error);
      setToast({ message: `Failed to execute campaign: ${error.message}`, type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);

    // Navigate immediately for instant feel
    router.push('/campaigns');

    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting campaign:', error);
      setToast({ message: 'Failed to delete campaign', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 rounded w-1/3"></div>
          <div className="h-64 bg-neutral-200 rounded"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!campaign) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">Campaign Not Found</h2>
          <p className="text-neutral-600 mb-6">This campaign doesn't exist or you don't have access to it.</p>
          <button onClick={() => router.push('/campaigns')} className="btn-primary">
            Back to Campaigns
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Compact Header */}
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/campaigns')}
                className="p-1.5 hover:bg-neutral-100 rounded transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-neutral-900">{campaign.campaign_name}</h1>
                  <div
                    className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                      campaign.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-neutral-100 text-neutral-800'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${campaign.is_active ? 'bg-green-500' : 'bg-neutral-500'}`}></div>
                    {campaign.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {campaign.user_configs?.config_name} • Created {new Date(campaign.created_at).toLocaleDateString()} • Updated {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="btn-outline flex items-center gap-1.5 text-xs px-2.5 py-1.5"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleToggleActive}
                className={`btn-outline flex items-center gap-1.5 text-xs px-2.5 py-1.5 ${
                  campaign.is_active ? 'text-orange-600 border-orange-600' : 'text-green-600 border-green-600'
                }`}
              >
                {campaign.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {campaign.is_active ? 'Pause' : 'Activate'}
              </button>
              <button
                onClick={() => setShowExecuteConfirm(true)}
                disabled={!campaign.is_active || isSending}
                className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Now
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-outline text-red-600 border-red-600 flex items-center gap-1.5 text-xs px-2.5 py-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="card">
          <div className="flex items-center gap-1 border-b border-neutral-200 px-3 pt-2">
            <button
              onClick={() => setMainView('details')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                mainView === 'details'
                  ? 'border-primary-500 text-primary-700'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setMainView('preview')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                mainView === 'preview'
                  ? 'border-primary-500 text-primary-700'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Preview {showPreview && previewData.length > 0 && `(${previewData.length})`}
            </button>
            <button
              onClick={() => setMainView('executions')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                mainView === 'executions'
                  ? 'border-primary-500 text-primary-700'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Execution History {executions.length > 0 && `(${executions.length})`}
            </button>
          </div>

          <div className="p-4">
            {/* Details Tab */}
            {mainView === 'details' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-3">
                  {/* Configuration */}
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 mb-2 flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5" />
                      Configuration
                    </h3>
                    <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200 space-y-1.5 text-xs">
                      {campaign.description && (
                        <div className="pb-1.5 border-b border-neutral-200">
                          <span className="text-neutral-500">Description:</span>
                          <p className="text-neutral-900 mt-0.5">{campaign.description}</p>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-600">Status Column:</span>
                        <span className="font-mono text-neutral-900 bg-white px-1.5 py-0.5 rounded border border-neutral-200">
                          {campaign.status_column}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-600">Status Value:</span>
                        <span className="font-medium text-neutral-900">{campaign.status_value}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-600">Phone Column:</span>
                        <span className="font-mono text-neutral-900 bg-white px-1.5 py-0.5 rounded border border-neutral-200">
                          {campaign.phone_column}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Message Template */}
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 mb-2 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Message Template
                    </h3>
                    <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200">
                      <p className="text-neutral-900 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                        {campaign.message_template}
                      </p>
                      <div className="mt-2 pt-2 border-t border-neutral-200 text-xs text-neutral-500">
                        Tags like {'{column_id}'} will be replaced
                      </div>
                    </div>
                  </div>

                  {/* Filters */}
                  {campaign.multiple_filters && campaign.multiple_filters.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 mb-2">Filters</h3>
                      <div className="space-y-1">
                        {campaign.multiple_filters.map((filter: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 p-1.5 bg-neutral-50 rounded border border-neutral-200 text-xs"
                          >
                            <span className="font-mono text-neutral-700">{filter.column_id}</span>
                            <span className="text-neutral-500">{filter.operator}</span>
                            <span className="font-medium text-neutral-900">"{filter.value}"</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  {/* Schedule */}
                  {campaign.campaign_schedules && campaign.campaign_schedules.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 mb-2 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Schedule
                      </h3>
                      <div className="space-y-1.5">
                        {campaign.campaign_schedules.map((schedule: any) => (
                          <div
                            key={schedule.id}
                            className={`p-2.5 rounded-lg border text-xs ${
                              schedule.is_active
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-neutral-50 border-neutral-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold uppercase text-neutral-700">
                                {schedule.schedule_type}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-xs ${
                                  schedule.is_active
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-neutral-200 text-neutral-600'
                                }`}
                              >
                                {schedule.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div className="text-neutral-900 font-medium">
                              {schedule.schedule_type === 'once' && (
                                <>{new Date(schedule.schedule_day).toLocaleDateString()} at {schedule.schedule_time}</>
                              )}
                              {schedule.schedule_type === 'weekly' && (
                                <>Every {schedule.schedule_day} at {schedule.schedule_time}</>
                              )}
                              {schedule.schedule_type === 'monthly' && (
                                <>{schedule.schedule_day}th of month at {schedule.schedule_time}</>
                              )}
                            </div>
                            {schedule.last_executed_at && (
                              <div className="text-neutral-500 mt-1">
                                Last: {new Date(schedule.last_executed_at).toLocaleString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  {campaign.campaign_executions && campaign.campaign_executions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 mb-2 flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" />
                        Quick Stats
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg p-2.5 text-white">
                          <div className="text-xs opacity-90">Total Runs</div>
                          <div className="text-xl font-bold">{campaign.campaign_executions.length}</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-2.5 text-white">
                          <div className="text-xs opacity-90">Last Sent</div>
                          <div className="text-xl font-bold">
                            {campaign.campaign_executions.slice(-1)[0]?.successful_sends || 0}
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-2.5 text-white">
                          <div className="text-xs opacity-90">Last Failed</div>
                          <div className="text-xl font-bold">
                            {campaign.campaign_executions.slice(-1)[0]?.failed_sends || 0}
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2.5 text-white">
                          <div className="text-xs opacity-90">Last Run</div>
                          <div className="text-xs font-medium">
                            {new Date(campaign.campaign_executions.slice(-1)[0]?.started_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview Tab */}
            {mainView === 'preview' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    {showPreview && previewData.length > 0 && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-neutral-600">
                          {previewData.length} recipients will receive messages
                        </p>
                        <span className="text-xs text-neutral-400">•</span>
                        <p className="text-xs text-neutral-500">
                          {previewData.filter(r => r.message.length > 160).length} exceed 160 chars
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {showPreview && previewData.length > 0 && (
                      <>
                        <button
                          onClick={copyAllMessages}
                          className="btn-outline flex items-center gap-1.5 text-xs px-3 py-1.5"
                          title="Copy all messages to clipboard"
                        >
                          <Copy className="w-3 h-3" />
                          Copy All
                        </button>
                        <button
                          onClick={exportPreviewToCSV}
                          className="btn-outline flex items-center gap-1.5 text-xs px-3 py-1.5"
                          title="Export to CSV"
                        >
                          <FileText className="w-3 h-3" />
                          Export CSV
                        </button>
                      </>
                    )}
                    <button
                      onClick={fetchPreview}
                      disabled={isLoadingPreview}
                      className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                    >
                      {isLoadingPreview ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                          Loading...
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          {showPreview ? 'Refresh Preview' : 'Load Preview'}
                        </>
                      )}
                    </button>
                  </div>
                </div>

              {!showPreview && !isLoadingPreview && (
                <div className="text-center py-8 bg-neutral-50 rounded-lg border border-neutral-200">
                  <Eye className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
                  <p className="text-sm font-medium text-neutral-700 mb-1">Preview Campaign</p>
                  <p className="text-xs text-neutral-500">
                    See who will receive messages before sending
                  </p>
                </div>
              )}

              {isLoadingPreview && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent mx-auto mb-3"></div>
                  <p className="text-sm text-neutral-600">Fetching from Monday.com...</p>
                </div>
              )}

              {showPreview && !isLoadingPreview && (
                <div className="space-y-3">
                  {/* Filters Info */}
                  {previewFiltersInfo && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-800">
                          <span className="font-medium">Applied filters: </span>
                          {previewFiltersInfo}
                        </div>
                      </div>
                    </div>
                  )}

                  {previewData.length > 0 ? (
                    <>
                      {/* Mode Switcher */}
                      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
                        <button
                          onClick={() => setPreviewMode('summary')}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            previewMode === 'summary'
                              ? 'bg-primary-100 text-primary-700'
                              : 'text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          Summary
                        </button>
                        <button
                          onClick={() => setPreviewMode('table')}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            previewMode === 'table'
                              ? 'bg-primary-100 text-primary-700'
                              : 'text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          Table View
                        </button>
                        <button
                          onClick={() => setPreviewMode('sample')}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            previewMode === 'sample'
                              ? 'bg-primary-100 text-primary-700'
                              : 'text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          Sample ({Math.min(5, previewData.length)})
                        </button>
                      </div>

                      {/* Summary Mode */}
                      {previewMode === 'summary' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg p-3 text-white">
                              <div className="text-xs opacity-90 mb-1">Total Recipients</div>
                              <div className="text-2xl font-bold">{previewData.length}</div>
                            </div>
                            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 text-white">
                              <div className="text-xs opacity-90 mb-1">Avg. Message</div>
                              <div className="text-2xl font-bold">
                                {Math.round(
                                  previewData.reduce((sum, r) => sum + r.message.length, 0) / previewData.length
                                )} chars
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 text-white">
                              <div className="text-xs opacity-90 mb-1">Unique Numbers</div>
                              <div className="text-2xl font-bold">
                                {new Set(previewData.map(r => r.phoneNumber)).size}
                              </div>
                            </div>
                          </div>

                          {/* Sample Message */}
                          <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                            <div className="text-xs font-semibold text-neutral-700 mb-2">Sample Message</div>
                            <div className="bg-white rounded p-2 border border-neutral-200">
                              <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-neutral-100">
                                <Users className="w-3 h-3 text-neutral-500" />
                                <span className="text-xs font-medium text-neutral-900">
                                  {previewData[0].recipientName}
                                </span>
                                <span className="text-xs text-neutral-500 font-mono ml-auto">
                                  {previewData[0].phoneNumber}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-900 leading-relaxed whitespace-pre-wrap">
                                {previewData[0].message}
                              </p>
                              <div className="text-xs text-neutral-400 mt-1.5 pt-1.5 border-t border-neutral-100">
                                {previewData[0].message.length} characters
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Table Mode */}
                      {previewMode === 'table' && (
                        <div>
                          {/* Search */}
                          <div className="mb-2">
                            <input
                              type="text"
                              placeholder="Search by name or phone..."
                              value={previewSearch}
                              onChange={(e) => {
                                setPreviewSearch(e.target.value);
                                setPreviewPage(1);
                              }}
                              className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:border-primary-500"
                            />
                          </div>

                          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                            <table className="w-full text-xs">
                              <thead className="bg-neutral-100 border-b border-neutral-200">
                                <tr>
                                  <th className="text-left p-2 font-semibold text-neutral-700 w-8">#</th>
                                  <th className="text-left p-2 font-semibold text-neutral-700">Name</th>
                                  <th className="text-left p-2 font-semibold text-neutral-700">Phone</th>
                                  <th className="text-left p-2 font-semibold text-neutral-700">Message Preview</th>
                                  <th className="text-right p-2 font-semibold text-neutral-700">Length</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const filtered = previewData.filter(r =>
                                    r.recipientName.toLowerCase().includes(previewSearch.toLowerCase()) ||
                                    r.phoneNumber.includes(previewSearch)
                                  );
                                  const start = (previewPage - 1) * previewPerPage;
                                  const paginated = filtered.slice(start, start + previewPerPage);

                                  return paginated.map((recipient, index) => {
                                    const isLong = recipient.message.length > 160;
                                    return (
                                      <tr key={index} className={`border-b border-neutral-100 hover:bg-neutral-50 ${isLong ? 'bg-yellow-50/30' : ''}`}>
                                        <td className="p-2 text-neutral-500">{start + index + 1}</td>
                                        <td className="p-2 font-medium text-neutral-900">{recipient.recipientName}</td>
                                        <td className="p-2 font-mono text-neutral-700 text-xs">{recipient.phoneNumber}</td>
                                        <td className="p-2 text-neutral-600 max-w-xs">
                                          <div className="truncate group-hover:whitespace-normal" title={recipient.message}>
                                            {recipient.message}
                                          </div>
                                        </td>
                                        <td className="p-2 text-right">
                                          <span className={`text-xs font-mono ${isLong ? 'text-orange-600 font-semibold' : 'text-neutral-500'}`}>
                                            {recipient.message.length}
                                            {isLong && ' ⚠'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination */}
                          {(() => {
                            const filtered = previewData.filter(r =>
                              r.recipientName.toLowerCase().includes(previewSearch.toLowerCase()) ||
                              r.phoneNumber.includes(previewSearch)
                            );
                            const totalPages = Math.ceil(filtered.length / previewPerPage);

                            if (totalPages > 1) {
                              return (
                                <div className="flex items-center justify-between mt-2">
                                  <div className="text-xs text-neutral-600">
                                    Showing {((previewPage - 1) * previewPerPage) + 1} - {Math.min(previewPage * previewPerPage, filtered.length)} of {filtered.length}
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => setPreviewPage(Math.max(1, previewPage - 1))}
                                      disabled={previewPage === 1}
                                      className="px-2 py-1 text-xs border border-neutral-300 rounded hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Prev
                                    </button>
                                    <div className="px-2 py-1 text-xs text-neutral-600">
                                      Page {previewPage} of {totalPages}
                                    </div>
                                    <button
                                      onClick={() => setPreviewPage(Math.min(totalPages, previewPage + 1))}
                                      disabled={previewPage === totalPages}
                                      className="px-2 py-1 text-xs border border-neutral-300 rounded hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      )}

                      {/* Sample Mode */}
                      {previewMode === 'sample' && (
                        <div className="space-y-2">
                          {previewData.slice(0, 5).map((recipient, index) => (
                            <div key={index} className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-neutral-900">{recipient.recipientName}</div>
                                    <div className="text-xs font-mono text-neutral-600">{recipient.phoneNumber}</div>
                                  </div>
                                </div>
                                <div className="text-xs text-neutral-500">{recipient.message.length} chars</div>
                              </div>
                              <div className="bg-white rounded p-2 border border-neutral-200">
                                <p className="text-xs text-neutral-900 leading-relaxed whitespace-pre-wrap">
                                  {recipient.message}
                                </p>
                              </div>
                            </div>
                          ))}
                          {previewData.length > 5 && (
                            <div className="text-center text-xs text-neutral-500 pt-1">
                              + {previewData.length - 5} more recipients
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <AlertCircle className="w-10 h-10 mx-auto text-yellow-500 mb-2" />
                      <p className="font-semibold text-sm text-yellow-800 mb-1">No Recipients Found</p>
                      <p className="text-xs text-yellow-700">
                        No Monday.com items match your campaign criteria
                      </p>
                    </div>
                  )}
                </div>
              )}
              </div>
            )}

            {/* Executions Tab */}
            {mainView === 'executions' && (
              <div>
                {executions.length > 0 ? (
                  <div>
                    {/* Execution Selector */}
                    <div className="flex gap-2 overflow-x-auto pb-3 mb-4 border-b border-neutral-200">
              {executions.map((execution) => (
                <button
                  key={execution.id}
                  onClick={() => {
                    setSelectedExecution(execution.id);
                    fetchMessageLogs(execution.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedExecution === execution.id
                      ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="capitalize">{execution.execution_type}</span>
                    <span className="text-xs text-neutral-500">
                      {new Date(execution.started_at).toLocaleDateString()}
                    </span>
                    {execution.status === 'completed' ? (
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : execution.status === 'failed' ? (
                      <XCircle className="w-3 h-3 text-red-600" />
                    ) : (
                      <Clock className="w-3 h-3 text-yellow-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Selected Execution Details */}
            {selectedExecution && executions.find((e) => e.id === selectedExecution) && (
              <div className="space-y-4">
                {(() => {
                  const execution = executions.find((e) => e.id === selectedExecution)!;
                  return (
                    <>
                      {/* Content Switcher Tabs */}
                      <div className="flex gap-2 border-b border-neutral-200">
                        <button
                          onClick={() => setActiveTab('overview')}
                          className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'overview'
                              ? 'border-primary-500 text-primary-700'
                              : 'border-transparent text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          Overview
                        </button>
                        <button
                          onClick={() => setActiveTab('messages')}
                          className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'messages'
                              ? 'border-primary-500 text-primary-700'
                              : 'border-transparent text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          Messages ({messageLogs.length})
                        </button>
                      </div>

                      {/* Overview Tab */}
                      {activeTab === 'overview' && (
                        <div className="space-y-3">
                          {/* Execution Summary */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-neutral-50 rounded-lg p-3">
                          <div className="text-xs text-neutral-600 mb-0.5">Status</div>
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                execution.status === 'completed'
                                  ? 'bg-green-500'
                                  : execution.status === 'failed'
                                  ? 'bg-red-500'
                                  : 'bg-yellow-500'
                              }`}
                            ></div>
                            <span className="font-semibold text-sm text-neutral-900 capitalize">
                              {execution.status}
                            </span>
                          </div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-xs text-green-700 mb-0.5">Successful</div>
                          <div className="text-xl font-bold text-green-600">
                            {execution.successful_sends || 0}
                          </div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3">
                          <div className="text-xs text-red-700 mb-0.5">Failed</div>
                          <div className="text-xl font-bold text-red-600">
                            {execution.failed_sends || 0}
                          </div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="text-xs text-blue-700 mb-0.5">Total</div>
                          <div className="text-xl font-bold text-blue-600">
                            {execution.total_recipients || 0}
                          </div>
                        </div>
                      </div>

                      {/* Execution Timeline */}
                      <div className="bg-neutral-50 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-neutral-600">Started:</span>
                            <div className="font-medium text-neutral-900 mt-0.5">
                              {new Date(execution.started_at).toLocaleString()}
                            </div>
                          </div>
                          {execution.completed_at && (
                            <>
                              <div>
                                <span className="text-neutral-600">Completed:</span>
                                <div className="font-medium text-neutral-900 mt-0.5">
                                  {new Date(execution.completed_at).toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <span className="text-neutral-600">Duration:</span>
                                <div className="font-medium text-neutral-900 mt-0.5">
                                  {Math.round(
                                    (new Date(execution.completed_at).getTime() -
                                      new Date(execution.started_at).getTime()) /
                                      1000
                                  )}s
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        {execution.error_message && (
                          <div className="mt-2 pt-2 border-t border-neutral-200">
                            <span className="text-xs text-neutral-600">Notes:</span>
                            <div className="text-xs text-neutral-700 mt-0.5">
                              {execution.error_message}
                            </div>
                          </div>
                        )}
                      </div>
                        </div>
                      )}

                      {/* Individual Messages Tab */}
                      {activeTab === 'messages' && (
                        <div>
                          {messageLogs.length > 0 ? (
                            <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-neutral-100 border-b border-neutral-200">
                                  <th className="text-left p-2 font-medium text-neutral-700">
                                    Recipient
                                  </th>
                                  <th className="text-left p-2 font-medium text-neutral-700">
                                    Phone
                                  </th>
                                  <th className="text-left p-2 font-medium text-neutral-700">
                                    Status
                                  </th>
                                  <th className="text-left p-2 font-medium text-neutral-700">
                                    Message
                                  </th>
                                  <th className="text-left p-2 font-medium text-neutral-700">
                                    Sent At
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {messageLogs.map((log) => (
                                  <tr
                                    key={log.id}
                                    className="border-b border-neutral-100 hover:bg-neutral-50"
                                  >
                                    <td className="p-2">
                                      <div className="font-medium text-neutral-900">
                                        {log.recipient_name || 'Unknown'}
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      <div className="font-mono text-xs text-neutral-700">
                                        {log.recipient_phone}
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      <div className="flex items-center gap-1.5">
                                        {log.status === 'sent' ? (
                                          <>
                                            <CheckCircle className="w-3 h-3 text-green-600" />
                                            <span className="text-green-700 font-medium">
                                              Sent
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            <XCircle className="w-3 h-3 text-red-600" />
                                            <span className="text-red-700 font-medium">
                                              Failed
                                            </span>
                                          </>
                                        )}
                                      </div>
                                      {log.error_message && (
                                        <div className="text-xs text-red-600 mt-0.5">
                                          {log.error_message}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-2">
                                      <div className="text-neutral-700 max-w-xs truncate">
                                        {log.message_content}
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      <div className="text-neutral-600">
                                        {log.sent_at
                                          ? new Date(log.sent_at).toLocaleString()
                                          : 'N/A'}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            </div>
                          ) : (
                            <div className="text-center py-6 text-neutral-500">
                              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No message logs found</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 bg-neutral-50 rounded-lg border border-neutral-200">
            <FileText className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
            <p className="font-medium text-sm text-neutral-700 mb-1">No Executions Yet</p>
            <p className="text-xs text-neutral-500">
              Send your campaign to see execution history
            </p>
          </div>
        )}
      </div>
    )}
          </div>
        </div>

        {/* Modals */}
        <ConfirmModal
          isOpen={showExecuteConfirm}
          onClose={() => setShowExecuteConfirm(false)}
          onConfirm={confirmExecuteCampaign}
          title="Execute Campaign Now?"
          message="This will send SMS messages to all matching recipients right now. Are you sure you want to proceed?"
          confirmText="Yes, Send Now"
          cancelText="Cancel"
          type="warning"
        />

        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
          title="Delete Campaign?"
          message={`Are you sure you want to delete "${campaign?.campaign_name}"? This action cannot be undone and all associated data will be permanently deleted.`}
          confirmText="Yes, Delete"
          cancelText="Cancel"
          type="danger"
          isLoading={isDeleting}
        />

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
