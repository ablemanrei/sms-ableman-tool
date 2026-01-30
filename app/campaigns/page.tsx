'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Toast from '@/components/ui/Toast';
import {
  Plus,
  MessageSquare,
  Edit,
  Trash2,
  Play,
  Pause,
  Eye,
  Copy,
  Clock,
  Send,
  Users,
  Filter,
  CheckCircle,
  XCircle,
  Calendar,
  ChevronRight,
  AlertCircle,
  Grid3x3,
  List,
  Search,
  X as CloseIcon,
  FileText,
} from 'lucide-react';
import { authUtils } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Campaign, UserConfig } from '@/lib/types';
import SearchableSelect from '@/components/ui/SearchableSelect';

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [configurations, setConfigurations] = useState<UserConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [sendingCampaigns, setSendingCampaigns] = useState<Set<string>>(new Set());

  // Modal and toast state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [campaignToExecute, setCampaignToExecute] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // View and filter state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterConfig, setFilterConfig] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 30;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    campaign_name: '',
    description: '',
    config_id: '',
    status_column: '',
    status_value: '',
    phone_column: '',
    message_template: '',
    selected_items: [] as string[],
    multiple_filters: [] as any[],
    schedules: [] as any[],
    schedule_type: 'once' as 'once' | 'weekly' | 'monthly',
    schedule_day: '',
    schedule_time: '09:00',
  });

  // Monday.com data
  const [mondayItems, setMondayItems] = useState<any[]>([]);
  const [mondayColumns, setMondayColumns] = useState<any[]>([]);
  const [isLoadingMonday, setIsLoadingMonday] = useState(false);

  useEffect(() => {
    fetchConfigurations();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterConfig, filterStatus, filterDateFrom, filterDateTo]);

  // Fetch data when page or filters change
  useEffect(() => {
    fetchData();
  }, [currentPage, searchQuery, filterConfig, filterStatus, filterDateFrom, filterDateTo]);

  const fetchConfigurations = async () => {
    try {
      const user = authUtils.getUser();
      const workspace = authUtils.getWorkspace();

      if (!user) return;

      const { data: configs } = await supabase
        .from('user_configs')
        .select('*')
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`)
        .order('created_at', { ascending: false });

      setConfigurations(configs || []);
    } catch (error) {
      console.error('Error fetching configurations:', error);
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
        .from('campaigns')
        .select(`
          *,
          user_configs(config_name),
          campaign_schedules(
            id,
            schedule_type,
            schedule_day,
            schedule_time,
            is_active,
            last_executed_at,
            execution_count
          ),
          campaign_executions(
            id,
            status,
            started_at,
            completed_at,
            successful_sends,
            failed_sends
          )
        `, { count: 'exact' })
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`);

      // Apply filters
      if (filterConfig && filterConfig !== 'all') {
        query = query.eq('config_id', filterConfig);
      }

      if (filterStatus === 'active') {
        query = query.eq('is_active', true);
      } else if (filterStatus === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (filterDateFrom) {
        query = query.gte('created_at', new Date(filterDateFrom).toISOString());
      }

      if (filterDateTo) {
        const endDate = new Date(filterDateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      if (searchQuery) {
        query = query.ilike('campaign_name', `%${searchQuery}%`);
      }

      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: campaignsData, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setCampaigns(campaignsData || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
      setToast({ message: 'Failed to load campaigns', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenWizard = (campaign?: Campaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setWizardData({
        campaign_name: campaign.campaign_name,
        description: campaign.description || '',
        config_id: campaign.config_id,
        status_column: campaign.status_column,
        status_value: campaign.status_value,
        phone_column: campaign.phone_column,
        message_template: campaign.message_template,
        selected_items: campaign.selected_items || [],
        multiple_filters: campaign.multiple_filters || [],
        schedules: campaign.schedules || [],
        schedule_type: campaign.schedule_type || 'once',
        schedule_day: '',
        schedule_time: '09:00',
      });
      fetchMondayData(campaign.config_id);
    } else {
      setEditingCampaign(null);
      setWizardData({
        campaign_name: '',
        description: '',
        config_id: '',
        status_column: '',
        status_value: '',
        phone_column: '',
        message_template: '',
        selected_items: [],
        multiple_filters: [],
        schedules: [],
        schedule_type: 'once',
        schedule_day: '',
        schedule_time: '09:00',
      });
    }
    setCurrentStep(1);
    setIsWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setIsWizardOpen(false);
    setEditingCampaign(null);
    setCurrentStep(1);
    setMondayItems([]);
    setMondayColumns([]);
  };

  const handleNextStep = async () => {
    if (currentStep === 1 && wizardData.config_id && mondayColumns.length === 0) {
      await fetchMondayData(wizardData.config_id);
    }
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleAddFilter = () => {
    setWizardData({
      ...wizardData,
      multiple_filters: [
        ...wizardData.multiple_filters,
        { column_id: '', operator: 'equals', value: '' },
      ],
    });
  };

  const handleRemoveFilter = (index: number) => {
    setWizardData({
      ...wizardData,
      multiple_filters: wizardData.multiple_filters.filter((_, i) => i !== index),
    });
  };

  const handleUpdateFilter = (index: number, field: string, value: string) => {
    const updatedFilters = [...wizardData.multiple_filters];
    updatedFilters[index] = { ...updatedFilters[index], [field]: value };
    setWizardData({ ...wizardData, multiple_filters: updatedFilters });
  };

  const handleAddSchedule = () => {
    if (!wizardData.schedule_day || !wizardData.schedule_time) {
      setToast({ message: 'Please select day and time', type: 'warning' });
      return;
    }

    const newSchedule = {
      schedule_type: wizardData.schedule_type,
      schedule_day: wizardData.schedule_day,
      schedule_time: wizardData.schedule_time,
    };

    setWizardData({
      ...wizardData,
      schedules: [...wizardData.schedules, newSchedule],
      schedule_day: '',
      schedule_time: '09:00',
    });
  };

  const handleRemoveSchedule = (index: number) => {
    setWizardData({
      ...wizardData,
      schedules: wizardData.schedules.filter((_, i) => i !== index),
    });
  };

  const fetchMondayData = async (configId: string) => {
    setIsLoadingMonday(true);
    try {
      const config = configurations.find((c) => c.id === configId);
      console.log('Config found:', config);

      if (!config) {
        console.error('No configuration found for ID:', configId);
        setToast({ message: 'Configuration not found. Please select a valid configuration.', type: 'error' });
        setIsLoadingMonday(false);
        return;
      }

      if (!config.board_id || !config.group_id || !config.monday_api_key) {
        console.error('Configuration missing required fields:', {
          board_id: config.board_id,
          group_id: config.group_id,
          has_api_key: !!config.monday_api_key,
        });
        setToast({ message: 'Configuration is incomplete. Please update it with Monday.com credentials.', type: 'error' });
        setIsLoadingMonday(false);
        return;
      }

      // Fetch board structure
      const structureQuery = `
        query {
          boards(ids: [${config.board_id}]) {
            columns {
              id
              title
              type
            }
            groups(ids: ["${config.group_id}"]) {
              id
              title
              items_page(limit: 100) {
                items {
                  id
                  name
                  column_values {
                    id
                    text
                    type
                  }
                }
              }
            }
          }
        }
      `;

      console.log('Fetching Monday.com data with query:', structureQuery);

      const response = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: config.monday_api_key,
        },
        body: JSON.stringify({ query: structureQuery }),
      });

      const result = await response.json();
      console.log('Monday.com API response:', result);

      if (result.errors) {
        console.error('Monday.com API errors:', result.errors);
        throw new Error(result.errors[0].message);
      }

      const board = result.data?.boards?.[0];
      const columns = board?.columns || [];
      const items = board?.groups?.[0]?.items_page?.items || [];

      console.log('Extracted columns:', columns);
      console.log('Extracted items:', items);

      setMondayColumns(columns);
      setMondayItems(items);
    } catch (error: any) {
      console.error('Error fetching Monday.com data:', error);
      setToast({ message: `Error loading Monday.com data: ${error.message}`, type: 'error' });
    } finally {
      setIsLoadingMonday(false);
    }
  };

  const handleSaveCampaign = async () => {
    try {
      const user = authUtils.getUser();
      const workspace = authUtils.getWorkspace();

      if (!user) return;

      const campaignData = {
        campaign_name: wizardData.campaign_name,
        description: wizardData.description,
        config_id: wizardData.config_id,
        status_column: wizardData.status_column,
        status_value: wizardData.status_value,
        phone_column: wizardData.phone_column,
        message_template: wizardData.message_template,
        selected_items: wizardData.selected_items,
        multiple_filters: wizardData.multiple_filters,
        schedule_type: wizardData.schedule_type,
        user_id: user.id,
        workspace_id: workspace?.id || null,
        is_active: false,
      };

      if (editingCampaign) {
        const { error } = await supabase
          .from('campaigns')
          .update(campaignData)
          .eq('id', editingCampaign.id);

        if (error) throw error;

        // Update schedules if any
        if (wizardData.schedules.length > 0) {
          // Delete old schedules
          await supabase
            .from('campaign_schedules')
            .delete()
            .eq('campaign_id', editingCampaign.id);

          // Insert new schedules
          const schedules = wizardData.schedules.map((schedule) => ({
            campaign_id: editingCampaign.id,
            ...schedule,
          }));
          await supabase.from('campaign_schedules').insert(schedules);
        }

        setSuccessMessage('Campaign updated successfully!');
      } else {
        const { data, error } = await supabase
          .from('campaigns')
          .insert(campaignData)
          .select();

        if (error) throw error;

        // Insert schedules if any
        if (wizardData.schedules.length > 0 && data && data[0]) {
          const schedules = wizardData.schedules.map((schedule) => ({
            campaign_id: data[0].id,
            ...schedule,
          }));
          await supabase.from('campaign_schedules').insert(schedules);
        }

        setSuccessMessage('Campaign created successfully!');
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      handleCloseWizard();
      fetchData();
    } catch (error) {
      console.error('Error saving campaign:', error);
      setToast({ message: 'Error saving campaign. Please try again.', type: 'error' });
    }
  };

  const handleToggleActive = async (campaignId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ is_active: !isActive })
        .eq('id', campaignId);

      if (error) throw error;

      setSuccessMessage(
        `Campaign ${!isActive ? 'activated' : 'deactivated'} successfully!`
      );
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      fetchData();
    } catch (error) {
      console.error('Error toggling campaign:', error);
      setToast({ message: 'Error updating campaign. Please try again.', type: 'error' });
    }
  };

  const handleCloneCampaign = async (campaign: Campaign) => {
    try {
      // Store clone data in sessionStorage
      const cloneData = {
        campaign_name: `${campaign.campaign_name} (Copy)`,
        description: campaign.description || '',
        config_id: campaign.config_id,
        status_column: campaign.status_column,
        status_value: campaign.status_value,
        phone_column: campaign.phone_column,
        message_template: campaign.message_template,
        selected_items: campaign.selected_items || [],
        multiple_filters: campaign.multiple_filters || [],
        schedules: [],
        schedule_type: campaign.schedule_type || 'once',
        schedule_day: '',
        schedule_time: '09:00',
        is_active: false,
      };

      sessionStorage.setItem('cloneCampaignData', JSON.stringify(cloneData));

      // Navigate to new campaign page
      router.push('/campaigns/new');

      setToast({
        message: 'Campaign cloned! Edit and save as new.',
        type: 'success',
      });
    } catch (error) {
      console.error('Error cloning campaign:', error);
      setToast({
        message: 'Failed to clone campaign',
        type: 'error',
      });
    }
  };

  const handleDeleteCampaign = (campaignId: string) => {
    setCampaignToDelete(campaignId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;

    setShowDeleteConfirm(false);

    // Optimistically remove from UI immediately
    setCampaigns(campaigns.filter(c => c.id !== campaignToDelete));

    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignToDelete);

      if (error) throw error;

      setToast({ message: 'Campaign deleted successfully!', type: 'success' });
      setCampaignToDelete(null);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      setToast({ message: 'Error deleting campaign. Please try again.', type: 'error' });
      // Restore the data on error
      fetchData();
    }
  };

  const handleExecuteCampaign = (campaignId: string) => {
    setCampaignToExecute(campaignId);
    setShowExecuteConfirm(true);
  };

  const confirmExecuteCampaign = async () => {
    if (!campaignToExecute) return;

    setShowExecuteConfirm(false);

    try {
      setSendingCampaigns(prev => new Set(prev).add(campaignToExecute));

      const smsServerUrl = process.env.NEXT_PUBLIC_SMS_SERVER_URL;
      if (!smsServerUrl) {
        throw new Error('SMS server URL not configured. Please set NEXT_PUBLIC_SMS_SERVER_URL in .env.local');
      }

      const response = await fetch(
        `${smsServerUrl}/api/campaigns/${campaignToExecute}/execute`,
        { method: 'POST' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute campaign');
      }

      setToast({ message: `Campaign execution started! Execution ID: ${data.executionId}`, type: 'success' });
      setCampaignToExecute(null);
    } catch (error: any) {
      console.error('Error executing campaign:', error);
      setToast({ message: `Failed to execute campaign: ${error.message}`, type: 'error' });
    } finally {
      setSendingCampaigns(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaignToExecute);
        return newSet;
      });
    }
  };

  const renderWizardStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                value={wizardData.campaign_name}
                onChange={(e) =>
                  setWizardData({ ...wizardData, campaign_name: e.target.value })
                }
                placeholder="My SMS Campaign"
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Description
              </label>
              <textarea
                value={wizardData.description}
                onChange={(e) =>
                  setWizardData({ ...wizardData, description: e.target.value })
                }
                placeholder="Describe this campaign..."
                rows={3}
                className="input-field resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select Configuration *
              </label>
              <SearchableSelect
                value={wizardData.config_id}
                onChange={(value) => {
                  setWizardData({ ...wizardData, config_id: value });
                }}
                options={configurations.map((config) => ({
                  value: config.id,
                  label: config.config_name,
                }))}
                placeholder="Choose a configuration..."
              />
            </div>

            {configurations.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-700">
                  <p className="font-medium">No configurations found</p>
                  <p className="text-xs mt-1">
                    Please create a configuration first before creating a
                    campaign.
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {isLoadingMonday ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500 mb-4"></div>
                <p className="text-sm text-neutral-600">Loading Monday.com board data...</p>
              </div>
            ) : mondayColumns.length === 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-red-800 mb-2">No Columns Found</h3>
                <p className="text-sm text-red-700 mb-4">
                  Unable to load Monday.com board columns. Please check the browser console for details.
                </p>
                <ul className="text-xs text-red-600 text-left max-w-md mx-auto space-y-1">
                  <li>• Board ID and Group ID are correct in configuration</li>
                  <li>• Monday.com API key is valid</li>
                  <li>• You have access to the specified board</li>
                </ul>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Status Column *
                    </label>
                    <SearchableSelect
                      value={wizardData.status_column}
                      onChange={(value) =>
                        setWizardData({
                          ...wizardData,
                          status_column: value,
                        })
                      }
                      options={mondayColumns.map((col) => ({
                        value: col.id,
                        label: col.title,
                        subtitle: col.type,
                      }))}
                      placeholder="Choose status column..."
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Select the column that contains status values
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Status Value *
                    </label>
                    <input
                      type="text"
                      value={wizardData.status_value}
                      onChange={(e) =>
                        setWizardData({
                          ...wizardData,
                          status_value: e.target.value,
                        })
                      }
                      placeholder="e.g., Active, Lead, etc."
                      required
                      className="input-field"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Only items with this status will receive messages
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Phone Column *
                  </label>
                  <SearchableSelect
                    value={wizardData.phone_column}
                    onChange={(value) =>
                      setWizardData({
                        ...wizardData,
                        phone_column: value,
                      })
                    }
                    options={mondayColumns.map((col) => ({
                      value: col.id,
                      label: col.title,
                      subtitle: col.type,
                    }))}
                    placeholder="Choose phone column..."
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Column containing phone numbers for SMS recipients
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium mb-1">How Basic Filters Work</p>
                      <p className="text-xs">
                        The campaign will only send messages to items where the status column matches the value you specify. This ensures you target the right audience at the right time.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-800">
                Advanced Filters (Optional)
              </h3>
              <button
                onClick={handleAddFilter}
                className="text-xs bg-primary-500 text-white px-3 py-1.5 rounded hover:bg-primary-600 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Filter
              </button>
            </div>

            {wizardData.multiple_filters.length === 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <Filter className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-blue-700 mb-1 font-medium">
                  No advanced filters added
                </p>
                <p className="text-xs text-blue-600">
                  You can add multiple filter conditions to narrow down your
                  target audience
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {wizardData.multiple_filters.map((filter, index) => (
                  <div
                    key={index}
                    className="bg-neutral-50 border border-neutral-200 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">
                            Column
                          </label>
                          <SearchableSelect
                            value={filter.column_id}
                            onChange={(value) =>
                              handleUpdateFilter(index, 'column_id', value)
                            }
                            options={mondayColumns.map((col) => ({
                              value: col.id,
                              label: col.title,
                              subtitle: col.type,
                            }))}
                            placeholder="Select column..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">
                            Operator
                          </label>
                          <SearchableSelect
                            value={filter.operator}
                            onChange={(value) =>
                              handleUpdateFilter(index, 'operator', value)
                            }
                            options={[
                              { value: 'equals', label: 'Equals' },
                              { value: 'contains', label: 'Contains' },
                              { value: 'not_equals', label: 'Not Equals' },
                              { value: 'not_contains', label: 'Not Contains' },
                            ]}
                            placeholder="Select operator..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">
                            Value
                          </label>
                          <input
                            type="text"
                            value={filter.value}
                            onChange={(e) =>
                              handleUpdateFilter(index, 'value', e.target.value)
                            }
                            placeholder="Enter value..."
                            className="input-field text-sm"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFilter(index)}
                        className="mt-6 p-2 hover:bg-red-50 rounded transition-colors"
                        title="Remove filter"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
              <strong>Note:</strong> All filters will be applied with AND logic. Items
              must match all filter conditions to be included in the campaign.
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Message Template *
              </label>
              <textarea
                value={wizardData.message_template}
                onChange={(e) =>
                  setWizardData({
                    ...wizardData,
                    message_template: e.target.value,
                  })
                }
                placeholder="Hi {name}, this is a message from..."
                rows={6}
                required
                className="input-field resize-none font-mono text-sm"
              />
              <p className="text-xs text-neutral-500 mt-2">
                Use {'{column_id}'} to insert dynamic values from Monday.com
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Available Columns:
              </p>
              <div className="flex flex-wrap gap-2">
                {mondayColumns.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => {
                      setWizardData({
                        ...wizardData,
                        message_template:
                          wizardData.message_template + ` {${col.id}}`,
                      });
                    }}
                    className="text-xs bg-white border border-blue-300 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                  >
                    {col.title}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-700 mb-2">
                Character Count: {wizardData.message_template.length} / 1600
              </p>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      (wizardData.message_template.length / 1600) * 100,
                      100
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Schedule Type *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['once', 'weekly', 'monthly'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setWizardData({ ...wizardData, schedule_type: type })
                    }
                    className={`p-3 border-2 rounded-lg transition-all text-sm font-medium ${
                      wizardData.schedule_type === type
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {wizardData.schedule_type === 'weekly'
                    ? 'Day of Week'
                    : wizardData.schedule_type === 'monthly'
                    ? 'Day of Month'
                    : 'Date'}
                </label>
                {wizardData.schedule_type === 'once' && (
                  <input
                    type="date"
                    value={wizardData.schedule_day}
                    onChange={(e) =>
                      setWizardData({ ...wizardData, schedule_day: e.target.value })
                    }
                    className="input-field"
                  />
                )}
                {wizardData.schedule_type === 'weekly' && (
                  <SearchableSelect
                    value={wizardData.schedule_day}
                    onChange={(value) =>
                      setWizardData({ ...wizardData, schedule_day: value })
                    }
                    options={[
                      { value: 'Monday', label: 'Monday' },
                      { value: 'Tuesday', label: 'Tuesday' },
                      { value: 'Wednesday', label: 'Wednesday' },
                      { value: 'Thursday', label: 'Thursday' },
                      { value: 'Friday', label: 'Friday' },
                      { value: 'Saturday', label: 'Saturday' },
                      { value: 'Sunday', label: 'Sunday' },
                    ]}
                    placeholder="Select day..."
                  />
                )}
                {wizardData.schedule_type === 'monthly' && (
                  <SearchableSelect
                    value={wizardData.schedule_day}
                    onChange={(value) =>
                      setWizardData({ ...wizardData, schedule_day: value })
                    }
                    options={Array.from({ length: 31 }, (_, i) => i + 1).map((day) => ({
                      value: day.toString(),
                      label: day.toString(),
                    }))}
                    placeholder="Select day..."
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Time (EST)
                </label>
                <input
                  type="time"
                  value={wizardData.schedule_time}
                  onChange={(e) =>
                    setWizardData({ ...wizardData, schedule_time: e.target.value })
                  }
                  className="input-field"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Eastern Standard Time
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 mb-4">
              <strong>⏰ Timezone:</strong> All times are in EST (Eastern Standard Time)
            </div>

            <button
              onClick={handleAddSchedule}
              className="w-full btn-outline flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Schedule
            </button>

            {wizardData.schedules.length > 0 && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-neutral-800 mb-3">
                  Scheduled Times ({wizardData.schedules.length})
                </h4>
                <div className="space-y-2">
                  {wizardData.schedules.map((schedule, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white border border-neutral-200 rounded p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-primary-600" />
                        <div className="text-sm">
                          <span className="font-medium text-neutral-700">
                            {schedule.schedule_type === 'once'
                              ? new Date(schedule.schedule_day).toLocaleDateString()
                              : schedule.schedule_type === 'weekly'
                              ? `Every ${schedule.schedule_day}`
                              : `${schedule.schedule_day}th of every month`}
                          </span>
                          <span className="text-neutral-500 ml-2">
                            at {schedule.schedule_time}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveSchedule(index)}
                        className="p-1 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <strong>Tip:</strong> You can add multiple schedules. For example, send
              every Monday at 9:00 AM and every Friday at 3:00 PM.
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-lg p-6 text-white">
              <h3 className="text-lg font-semibold mb-4">Campaign Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>
                    <strong>Name:</strong> {wizardData.campaign_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <span>
                    <strong>Status Filter:</strong> {wizardData.status_column} ={' '}
                    {wizardData.status_value}
                  </span>
                </div>
                {wizardData.multiple_filters.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span>
                      <strong>Advanced Filters:</strong>{' '}
                      {wizardData.multiple_filters.length} filter(s) added
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  <span>
                    <strong>Message Length:</strong>{' '}
                    {wizardData.message_template.length} characters
                  </span>
                </div>
                {wizardData.schedules.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      <strong>Schedules:</strong> {wizardData.schedules.length}{' '}
                      schedule(s) added
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Ready to create?</p>
                <p>
                  Your campaign will be created as <strong>inactive</strong>. You
                  can activate it later from the campaigns list or connect it to
                  your backend for scheduling.
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">Campaigns</h1>
              <p className="text-sm text-neutral-600 mt-1">
                Create and manage your SMS campaigns
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-neutral-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white shadow text-primary-600'
                      : 'text-neutral-600 hover:text-neutral-800'
                  }`}
                  title="Grid view"
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white shadow text-primary-600'
                      : 'text-neutral-600 hover:text-neutral-800'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => router.push('/campaigns/new')}
                className="btn-primary flex items-center gap-2"
                disabled={configurations.length === 0}
              >
                <Plus className="w-4 h-4" />
                Create Campaign
              </button>
            </div>
          </div>

          {/* Search and Filter Bar */}
          {campaigns.length > 0 && (
            <div className="card p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search campaigns..."
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

                {/* Configuration Filter */}
                <div className="relative">
                  <SearchableSelect
                    value={filterConfig}
                    onChange={(value) => setFilterConfig(value)}
                    options={[
                      { value: '', label: 'All Configurations' },
                      ...configurations.map((config) => ({
                        value: config.id,
                        label: config.config_name,
                      })),
                    ]}
                    placeholder="All Configurations"
                  />
                  {filterConfig && (
                    <button
                      onClick={() => setFilterConfig('')}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors z-10"
                      title="Clear configuration filter"
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <SearchableSelect
                    value={filterStatus}
                    onChange={(value) =>
                      setFilterStatus(value as 'all' | 'active' | 'inactive')
                    }
                    options={[
                      { value: 'all', label: 'All Status' },
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                    ]}
                    placeholder="All Status"
                  />
                  {filterStatus !== 'all' && (
                    <button
                      onClick={() => setFilterStatus('all')}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors z-10"
                      title="Clear status filter"
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
                    placeholder="From Date"
                    className="input-field text-sm"
                  />
                  {filterDateFrom && (
                    <button
                      onClick={() => setFilterDateFrom('')}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors z-10"
                      title="Clear from date"
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
                    placeholder="To Date"
                    className="input-field text-sm"
                  />
                  {filterDateTo && (
                    <button
                      onClick={() => setFilterDateTo('')}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors z-10"
                      title="Clear to date"
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Active Filters Summary & Quick Filters */}
              {(() => {
                const hasFilters = searchQuery || filterConfig !== '' || filterStatus !== 'all' || filterDateFrom || filterDateTo;
                const activeFilterCount = [searchQuery, filterConfig, filterStatus !== 'all' && filterStatus, filterDateFrom, filterDateTo].filter(Boolean).length;

                return (
                  <div className="mt-3 flex items-center justify-between gap-3 pt-3 border-t border-neutral-200 flex-wrap">
                    {/* Active Filters Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {hasFilters ? (
                        <>
                          <span className="text-xs font-medium text-neutral-600 flex items-center gap-1">
                            <Filter className="w-3 h-3" />
                            Active ({activeFilterCount}):
                          </span>
                          {searchQuery && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              Search: "{searchQuery.substring(0, 20)}{searchQuery.length > 20 ? '...' : ''}"
                              <button onClick={() => setSearchQuery('')} className="hover:text-blue-900">
                                <CloseIcon className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                          {filterConfig && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                              Config: {configurations.find(c => c.id === filterConfig)?.config_name || 'Unknown'}
                              <button onClick={() => setFilterConfig('')} className="hover:text-purple-900">
                                <CloseIcon className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                          {filterStatus !== 'all' && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                              filterStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              Status: {filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
                              <button onClick={() => setFilterStatus('all')} className={filterStatus === 'active' ? 'hover:text-green-900' : 'hover:text-orange-900'}>
                                <CloseIcon className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                          {filterDateFrom && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">
                              From: {new Date(filterDateFrom).toLocaleDateString()}
                              <button onClick={() => setFilterDateFrom('')} className="hover:text-indigo-900">
                                <CloseIcon className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                          {filterDateTo && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">
                              To: {new Date(filterDateTo).toLocaleDateString()}
                              <button onClick={() => setFilterDateTo('')} className="hover:text-indigo-900">
                                <CloseIcon className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setFilterConfig('');
                              setFilterStatus('all');
                              setFilterDateFrom('');
                              setFilterDateTo('');
                            }}
                            className="text-xs text-red-600 hover:text-red-700 font-medium underline"
                          >
                            Clear All
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-neutral-500">No filters applied</span>
                      )}
                    </div>

                    {/* Quick Filter Presets */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-neutral-600 font-medium">Quick:</span>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterConfig('');
                          setFilterStatus('active');
                          setFilterDateFrom('');
                          setFilterDateTo('');
                        }}
                        className="px-2 py-1 text-xs border border-green-300 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                      >
                        Active
                      </button>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterConfig('');
                          setFilterStatus('all');
                          const sevenDaysAgo = new Date();
                          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                          setFilterDateFrom(sevenDaysAgo.toISOString().split('T')[0]);
                          setFilterDateTo('');
                        }}
                        className="px-2 py-1 text-xs border border-blue-300 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                      >
                        Last 7 Days
                      </button>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterConfig('');
                          setFilterStatus('all');
                          setFilterDateFrom('');
                          setFilterDateTo('');
                        }}
                        className="px-2 py-1 text-xs border border-neutral-300 bg-neutral-50 text-neutral-700 rounded hover:bg-neutral-100 transition-colors"
                      >
                        All
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Results count */}
              <div className="mt-3 pt-3 border-t border-neutral-200">
                <p className="text-xs text-neutral-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} campaigns
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        )}

        {/* No Configurations Warning */}
        {configurations.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">No configurations available</p>
              <p>
                Please create a configuration first before creating campaigns.{' '}
                <a href="/configurations" className="underline font-medium">
                  Go to Configurations
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Campaigns List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-6 bg-neutral-200 rounded w-3/4 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-neutral-200 rounded"></div>
                  <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <>
            {/* Check if filters are active */}
            {searchQuery || filterConfig !== 'all' || filterStatus !== 'all' || filterDateFrom || filterDateTo ? (
              <div className="card p-12 text-center">
                <Filter className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                  No campaigns match your filters
                </h3>
                <p className="text-neutral-600 mb-4">
                  Try adjusting your search or filter criteria using the X icons on each filter
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterConfig('all');
                    setFilterStatus('all');
                    setFilterDateFrom('');
                    setFilterDateTo('');
                    setCurrentPage(1);
                  }}
                  className="btn-outline inline-flex items-center gap-2"
                >
                  <CloseIcon className="w-4 h-4" />
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="card p-12 text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                  No campaigns yet
                </h3>
                <p className="text-neutral-600 mb-6">
                  Create your first campaign to start sending SMS messages
                </p>
                {configurations.length > 0 && (
                  <button
                    onClick={() => router.push('/campaigns/new')}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Campaign
                  </button>
                )}
              </div>
            )}
          </>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign: any) => (
              <div
                key={campaign.id}
                className="card hover:shadow-lg transition-all"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          handleToggleActive(campaign.id, campaign.is_active)
                        }
                        className="p-2 hover:bg-neutral-100 rounded transition-colors"
                        title={
                          campaign.is_active ? 'Deactivate' : 'Activate'
                        }
                      >
                        {campaign.is_active ? (
                          <Pause className="w-4 h-4 text-orange-600" />
                        ) : (
                          <Play className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                      <button
                        onClick={() => handleExecuteCampaign(campaign.id)}
                        disabled={!campaign.is_active || sendingCampaigns.has(campaign.id)}
                        className="p-2 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={sendingCampaigns.has(campaign.id) ? 'Sending...' : 'Send Now'}
                      >
                        {sendingCampaigns.has(campaign.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent"></div>
                        ) : (
                          <Send className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                      <button
                        onClick={() => router.push(`/campaigns/${campaign.id}`)}
                        className="p-2 hover:bg-blue-50 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => router.push(`/campaigns/${campaign.id}/edit`)}
                        className="p-2 hover:bg-neutral-100 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-neutral-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="p-2 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-semibold text-neutral-800 mb-2">
                    {campaign.campaign_name}
                  </h3>

                  {campaign.description && (
                    <p className="text-sm text-neutral-600 mb-4 line-clamp-2">
                      {campaign.description}
                    </p>
                  )}

                  <div className="space-y-2 text-xs mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Configuration:</span>
                      <span className="font-medium text-neutral-700">
                        {campaign.user_configs?.config_name || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Status Filter:</span>
                      <span className="font-mono text-neutral-700 text-[10px]">
                        {campaign.status_value}
                      </span>
                    </div>

                    {/* Schedule Information */}
                    {campaign.campaign_schedules && campaign.campaign_schedules.length > 0 && (
                      <>
                        {campaign.campaign_schedules.map((schedule: any) => (
                          <div key={schedule.id} className="flex items-center justify-between pt-2 border-t border-neutral-100">
                            <span className="text-neutral-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Schedule:
                            </span>
                            <span className="font-medium text-neutral-700">
                              {schedule.schedule_type === 'once' && (
                                <>Once: {new Date(schedule.schedule_day).toLocaleDateString()} @ {schedule.schedule_time}</>
                              )}
                              {schedule.schedule_type === 'weekly' && (
                                <>{schedule.schedule_day}s @ {schedule.schedule_time}</>
                              )}
                              {schedule.schedule_type === 'monthly' && (
                                <>Monthly: {schedule.schedule_day}th @ {schedule.schedule_time}</>
                              )}
                            </span>
                          </div>
                        ))}
                        {campaign.campaign_schedules.some((s: any) => s.last_executed_at) && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-neutral-400">Last run:</span>
                            <span className="text-neutral-600">
                              {new Date(campaign.campaign_schedules.find((s: any) => s.last_executed_at)?.last_executed_at).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Execution Stats */}
                    {campaign.campaign_executions && campaign.campaign_executions.length > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                        <span className="text-neutral-500">Executions:</span>
                        <span className="font-medium text-neutral-700">
                          {campaign.campaign_executions.length}x
                          {campaign.campaign_executions.slice(-1)[0]?.successful_sends && (
                            <span className="text-green-600 ml-1">
                              ({campaign.campaign_executions.slice(-1)[0].successful_sends} sent)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-neutral-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            campaign.is_active
                              ? 'bg-green-500'
                              : 'bg-neutral-400'
                          }`}
                        ></div>
                        <span className="text-xs text-neutral-600">
                          {campaign.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-500">
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign: any) => (
              <div
                key={campaign.id}
                className="card hover:shadow-lg transition-all"
              >
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-6 h-6 text-primary-600" />
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-neutral-800 truncate">
                            {campaign.campaign_name}
                          </h3>
                          {campaign.description && (
                            <p className="text-sm text-neutral-600 truncate mt-0.5">
                              {campaign.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() =>
                              handleToggleActive(campaign.id, campaign.is_active)
                            }
                            className="p-2 hover:bg-neutral-100 rounded transition-colors"
                            title={campaign.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {campaign.is_active ? (
                              <Pause className="w-4 h-4 text-orange-600" />
                            ) : (
                              <Play className="w-4 h-4 text-green-600" />
                            )}
                          </button>
                          <button
                            onClick={() => handleExecuteCampaign(campaign.id)}
                            disabled={!campaign.is_active || sendingCampaigns.has(campaign.id)}
                            className="p-2 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={sendingCampaigns.has(campaign.id) ? 'Sending...' : 'Send Now'}
                          >
                            {sendingCampaigns.has(campaign.id) ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent"></div>
                            ) : (
                              <Send className="w-4 h-4 text-green-600" />
                            )}
                          </button>
                          <button
                            onClick={() => router.push(`/campaigns/${campaign.id}`)}
                            className="p-2 hover:bg-blue-50 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => router.push(`/campaigns/${campaign.id}/edit`)}
                            className="p-2 hover:bg-neutral-100 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-neutral-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteCampaign(campaign.id)}
                            className="p-2 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-500">Configuration:</span>
                          <span className="font-medium text-neutral-700">
                            {campaign.user_configs?.config_name || 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-500">Status Filter:</span>
                          <span className="font-mono text-neutral-700 text-[10px] bg-neutral-100 px-2 py-0.5 rounded">
                            {campaign.status_value}
                          </span>
                        </div>

                        {/* Schedule Information */}
                        {campaign.campaign_schedules && campaign.campaign_schedules.length > 0 && campaign.campaign_schedules[0] && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            <span className="text-neutral-500">Schedule:</span>
                            <span className="font-medium text-neutral-700">
                              {campaign.campaign_schedules[0].schedule_type === 'once' && (
                                <>{new Date(campaign.campaign_schedules[0].schedule_day).toLocaleDateString()} @ {campaign.campaign_schedules[0].schedule_time}</>
                              )}
                              {campaign.campaign_schedules[0].schedule_type === 'weekly' && (
                                <>{campaign.campaign_schedules[0].schedule_day}s @ {campaign.campaign_schedules[0].schedule_time}</>
                              )}
                              {campaign.campaign_schedules[0].schedule_type === 'monthly' && (
                                <>Monthly: {campaign.campaign_schedules[0].schedule_day}th @ {campaign.campaign_schedules[0].schedule_time}</>
                              )}
                            </span>
                          </div>
                        )}

                        {/* Execution Stats */}
                        {campaign.campaign_executions && campaign.campaign_executions.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Users className="w-3 h-3 text-neutral-400" />
                            <span className="text-neutral-500">Runs:</span>
                            <span className="font-medium text-neutral-700">
                              {campaign.campaign_executions.length}x
                              {campaign.campaign_executions.slice(-1)[0]?.successful_sends && (
                                <span className="text-green-600 ml-1">
                                  ({campaign.campaign_executions.slice(-1)[0].successful_sends} sent)
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              campaign.is_active ? 'bg-green-500' : 'bg-neutral-400'
                            }`}
                          ></div>
                          <span className="text-neutral-600">
                            {campaign.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-neutral-400" />
                          <span className="text-neutral-500">
                            {new Date(campaign.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && campaigns.length > 0 && totalPages > 1 && (
          <div className="card">
            <div className="flex items-center justify-between p-4">
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
          </div>
        )}

        {/* Campaign Wizard Modal */}
        <Modal
          isOpen={isWizardOpen}
          onClose={handleCloseWizard}
          title={
            editingCampaign ? 'Edit Campaign' : `Create Campaign - Step ${currentStep} of 6`
          }
          size="2xl"
        >
          <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-between">
              {[
                { num: 1, label: 'Basic Info' },
                { num: 2, label: 'Basic Filters' },
                { num: 3, label: 'Advanced Filters' },
                { num: 4, label: 'Message' },
                { num: 5, label: 'Schedule' },
                { num: 6, label: 'Review' },
              ].map((step, idx) => (
                <div key={step.num} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all text-xs ${
                        currentStep >= step.num
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : 'border-neutral-300 text-neutral-400'
                      }`}
                    >
                      {step.num}
                    </div>
                    <span className="text-[9px] text-neutral-600 mt-1 hidden lg:block text-center">
                      {step.label}
                    </span>
                  </div>
                  {idx < 5 && (
                    <div
                      className={`flex-1 h-1 mx-1 transition-all ${
                        currentStep > step.num ? 'bg-primary-500' : 'bg-neutral-200'
                      }`}
                    ></div>
                  )}
                </div>
              ))}
            </div>

            {/* Step Content */}
            {renderWizardStep()}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-4 border-t border-neutral-200">
              {currentStep > 1 && (
                <button
                  onClick={handlePrevStep}
                  className="flex-1 btn-outline flex items-center justify-center gap-2"
                >
                  Previous
                </button>
              )}
              {currentStep < 6 ? (
                <button
                  onClick={handleNextStep}
                  disabled={
                    (currentStep === 1 &&
                      (!wizardData.config_id || !wizardData.campaign_name)) ||
                    (currentStep === 2 &&
                      (!wizardData.status_column ||
                        !wizardData.status_value ||
                        !wizardData.phone_column)) ||
                    (currentStep === 4 && !wizardData.message_template)
                  }
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSaveCampaign}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {editingCampaign ? 'Update Campaign' : 'Create Campaign'}
                </button>
              )}
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setCampaignToDelete(null);
          }}
          onConfirm={confirmDeleteCampaign}
          title="Delete Campaign?"
          message="Are you sure you want to delete this campaign? This action cannot be undone."
          confirmText="Yes, Delete"
          cancelText="Cancel"
          type="danger"
        />

        {/* Execute Confirmation Modal */}
        <ConfirmModal
          isOpen={showExecuteConfirm}
          onClose={() => {
            setShowExecuteConfirm(false);
            setCampaignToExecute(null);
          }}
          onConfirm={confirmExecuteCampaign}
          title="Execute Campaign Now?"
          message="This will send SMS messages to all matching recipients right now. Are you sure you want to proceed?"
          confirmText="Yes, Send Now"
          cancelText="Cancel"
          type="warning"
        />

        {/* Toast Notification */}
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
