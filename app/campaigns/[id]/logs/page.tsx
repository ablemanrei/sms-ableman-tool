'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  MessageSquare,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface Campaign {
  id: string;
  campaign_name: string;
  status: string;
}

interface CampaignExecution {
  id: string;
  campaign_id: string;
  execution_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_recipients: number;
  successful_sends: number;
  failed_sends: number;
  error_message: string | null;
  execution_details: any;
  created_at: string;
}

interface MessageLog {
  id: string;
  campaign_id: string;
  execution_id: string;
  recipient_phone: string;
  recipient_name: string | null;
  message_content: string;
  status: string;
  sms_provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  cost_amount: number | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export default function CampaignLogsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [executions, setExecutions] = useState<CampaignExecution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaign();
    fetchExecutions();
  }, [campaignId]);

  const fetchCampaign = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, campaign_name, status')
        .eq('id', campaignId)
        .single();

      if (error) throw error;
      setCampaign(data);
    } catch (error: any) {
      console.error('Error fetching campaign:', error);
    }
  };

  const fetchExecutions = async () => {
    setIsLoadingExecutions(true);
    try {
      const { data, error } = await supabase
        .from('campaign_executions')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('started_at', { ascending: false });

      if (error) throw error;
      setExecutions(data || []);
    } catch (error: any) {
      console.error('Error fetching executions:', error);
    } finally {
      setIsLoadingExecutions(false);
    }
  };

  const fetchMessageLogs = async (executionId: string) => {
    setIsLoadingMessages(true);
    setSelectedExecution(executionId);
    try {
      const { data, error } = await supabase
        .from('message_logs')
        .select('*')
        .eq('execution_id', executionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessageLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching message logs:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'running':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-neutral-600 bg-neutral-50 border-neutral-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'sent':
      case 'delivered':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'failed':
      case 'undelivered':
        return <XCircle className="w-4 h-4" />;
      case 'running':
      case 'pending':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateSuccessRate = (execution: CampaignExecution) => {
    if (execution.total_recipients === 0) return 0;
    return Math.round(
      (execution.successful_sends / execution.total_recipients) * 100
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Campaigns
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">
                Campaign Execution Logs
              </h1>
              {campaign && (
                <p className="text-neutral-600 mt-1">{campaign.campaign_name}</p>
              )}
            </div>
          </div>
        </div>

        {/* Executions List */}
        <div className="bg-white border border-neutral-200 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
              <Send className="w-5 h-5" />
              Execution History
            </h2>
          </div>

          {isLoadingExecutions ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              <p className="text-neutral-600 mt-4">Loading executions...</p>
            </div>
          ) : executions.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-600">No execution history yet</p>
              <p className="text-sm text-neutral-500 mt-2">
                This campaign hasn't been executed yet
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {executions.map((execution) => (
                <div key={execution.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            execution.status
                          )}`}
                        >
                          {getStatusIcon(execution.status)}
                          {execution.status.charAt(0).toUpperCase() +
                            execution.status.slice(1)}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {execution.execution_type.charAt(0).toUpperCase() +
                            execution.execution_type.slice(1)}{' '}
                          execution
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-neutral-500">Started</p>
                          <p className="text-sm font-medium text-neutral-800">
                            {formatDate(execution.started_at)}
                          </p>
                        </div>
                        {execution.completed_at && (
                          <div>
                            <p className="text-xs text-neutral-500">Completed</p>
                            <p className="text-sm font-medium text-neutral-800">
                              {formatDate(execution.completed_at)}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-neutral-500">Recipients</p>
                          <p className="text-sm font-medium text-neutral-800">
                            {execution.total_recipients}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500">Success Rate</p>
                          <p className="text-sm font-medium text-neutral-800">
                            {calculateSuccessRate(execution)}%
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-6 text-sm">
                        <div className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{execution.successful_sends} sent</span>
                        </div>
                        {execution.failed_sends > 0 && (
                          <div className="flex items-center gap-1.5 text-red-600">
                            <XCircle className="w-4 h-4" />
                            <span>{execution.failed_sends} failed</span>
                          </div>
                        )}
                      </div>

                      {execution.error_message && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-xs font-medium text-red-800 mb-1">
                            Error Message
                          </p>
                          <p className="text-sm text-red-700">
                            {execution.error_message}
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        if (selectedExecution === execution.id) {
                          setSelectedExecution(null);
                          setMessageLogs([]);
                        } else {
                          fetchMessageLogs(execution.id);
                        }
                      }}
                      className="ml-4 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      View Messages
                      {selectedExecution === execution.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Message Logs */}
                  {selectedExecution === execution.id && (
                    <div className="mt-6 pt-6 border-t border-neutral-200">
                      <h3 className="text-sm font-semibold text-neutral-800 mb-4">
                        Individual Message Logs
                      </h3>
                      {isLoadingMessages ? (
                        <div className="text-center py-8">
                          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                        </div>
                      ) : messageLogs.length === 0 ? (
                        <p className="text-sm text-neutral-500 text-center py-8">
                          No message logs found
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-neutral-50 border-y border-neutral-200">
                              <tr>
                                <th className="text-left px-4 py-3 font-medium text-neutral-700">
                                  Recipient
                                </th>
                                <th className="text-left px-4 py-3 font-medium text-neutral-700">
                                  Phone
                                </th>
                                <th className="text-left px-4 py-3 font-medium text-neutral-700">
                                  Status
                                </th>
                                <th className="text-left px-4 py-3 font-medium text-neutral-700">
                                  Sent At
                                </th>
                                <th className="text-left px-4 py-3 font-medium text-neutral-700">
                                  Provider
                                </th>
                                <th className="text-left px-4 py-3 font-medium text-neutral-700">
                                  Cost
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200">
                              {messageLogs.map((log) => (
                                <tr
                                  key={log.id}
                                  className="hover:bg-neutral-50 transition-colors"
                                >
                                  <td className="px-4 py-3">
                                    {log.recipient_name || '-'}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs">
                                    {log.recipient_phone}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                                        log.status
                                      )}`}
                                    >
                                      {getStatusIcon(log.status)}
                                      {log.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-neutral-600">
                                    {log.sent_at ? formatDate(log.sent_at) : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-neutral-600">
                                    {log.sms_provider || '-'}
                                  </td>
                                  <td className="px-4 py-3 text-neutral-600">
                                    {log.cost_amount
                                      ? `$${log.cost_amount.toFixed(4)}`
                                      : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
