'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SearchableSelect from '@/components/ui/SearchableSelect';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  Filter,
  Plus,
  Trash2,
  Clock,
  MessageSquare,
  Send,
  Calendar,
  ChevronRight,
  Users,
} from 'lucide-react';
import { authUtils } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { UserConfig } from '@/lib/types';

type Section = 'basic' | 'filters' | 'advanced' | 'message' | 'schedule' | 'review';

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [configurations, setConfigurations] = useState<UserConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSection, setCurrentSection] = useState<Section>('basic');
  const [campaign, setCampaign] = useState<any>(null);

  // Form data
  const [formData, setFormData] = useState({
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
    is_active: false,
  });

  // Monday.com data
  const [mondayColumns, setMondayColumns] = useState<any[]>([]);
  const [mondayItems, setMondayItems] = useState<any[]>([]);
  const [isLoadingMonday, setIsLoadingMonday] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number>(0);
  const [isCalculatingRecipients, setIsCalculatingRecipients] = useState(false);

  // Test message states
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testMessageResult, setTestMessageResult] = useState<{ success: boolean; message: string } | null>(null);

  const sections = [
    { id: 'basic' as Section, label: 'Basic Info', icon: MessageSquare },
    { id: 'filters' as Section, label: 'Basic Filters', icon: Filter },
    { id: 'advanced' as Section, label: 'Advanced Filters', icon: Filter },
    { id: 'message' as Section, label: 'Message', icon: Send },
    { id: 'schedule' as Section, label: 'Schedule', icon: Calendar },
    { id: 'review' as Section, label: 'Review', icon: ChevronRight },
  ];

  useEffect(() => {
    fetchConfigurations();
    fetchCampaignData();
  }, [campaignId]);

  // Fetch Monday data when both campaign and configurations are loaded
  useEffect(() => {
    if (campaign && campaign.config_id && configurations.length > 0 && mondayColumns.length === 0) {
      fetchMondayData(campaign.config_id);
    }
  }, [campaign, configurations]);

  useEffect(() => {
    if (currentSection === 'review' && mondayItems.length > 0) {
      calculateRecipientCount();
    }
  }, [currentSection, mondayItems, formData.status_column, formData.status_value, formData.phone_column, formData.multiple_filters]);

  const fetchCampaignData = async () => {
    try {
      const user = authUtils.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          campaign_schedules(*)
        `)
        .eq('id', campaignId)
        .single();

      if (error) throw error;

      if (!data) {
        alert('Campaign not found');
        router.push('/campaigns');
        return;
      }

      setCampaign(data);

      // Populate form with existing campaign data
      setFormData({
        campaign_name: data.campaign_name || '',
        description: data.description || '',
        config_id: data.config_id || '',
        status_column: data.status_column || '',
        status_value: data.status_value || '',
        phone_column: data.phone_column || '',
        message_template: data.message_template || '',
        selected_items: data.selected_items || [],
        multiple_filters: data.multiple_filters || [],
        schedules: data.campaign_schedules || [],
        schedule_type: 'once',
        schedule_day: '',
        schedule_time: '09:00',
        is_active: data.is_active || false,
      });

      // Monday data will be fetched by useEffect when configurations are loaded
    } catch (error: any) {
      console.error('Error fetching campaign:', error);
      alert('Failed to load campaign: ' + error.message);
      router.push('/campaigns');
    }
  };

  const fetchConfigurations = async () => {
    try {
      const user = authUtils.getUser();
      const workspace = authUtils.getWorkspace();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('user_configs')
        .select('*')
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`)
        .order('created_at', { ascending: false });

      setConfigurations(data || []);
    } catch (error) {
      console.error('Error fetching configurations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMondayData = async (configId: string) => {
    setIsLoadingMonday(true);
    try {
      const config = configurations.find((c) => c.id === configId);
      console.log('Config found:', config);

      if (!config) {
        console.error('No configuration found for ID:', configId);
        setIsLoadingMonday(false);
        return;
      }

      if (!config.board_id || !config.group_id || !config.monday_api_key) {
        console.error('Configuration missing required fields:', {
          board_id: config.board_id,
          group_id: config.group_id,
          has_api_key: !!config.monday_api_key,
        });
        setIsLoadingMonday(false);
        return;
      }

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
      console.log('Full result.data:', result.data);
      console.log('Boards array:', result.data?.boards);

      if (result.errors) {
        console.error('Monday.com API errors:', result.errors);
        throw new Error(result.errors[0].message);
      }

      if (!result.data || !result.data.boards || result.data.boards.length === 0) {
        console.error('No boards found in response');
        throw new Error('No boards found in Monday.com response. Please check board ID and API key permissions.');
      }

      const board = result.data.boards[0];
      console.log('Board object:', board);
      console.log('Board columns:', board?.columns);
      console.log('Board groups:', board?.groups);

      const columns = board?.columns || [];
      const items = board?.groups?.[0]?.items_page?.items || [];

      console.log('Extracted columns:', columns);
      console.log('Extracted items:', items);

      setMondayColumns(columns);
      setMondayItems(items);
    } catch (error: any) {
      console.error('Error fetching Monday.com data:', error);
    } finally {
      setIsLoadingMonday(false);
    }
  };

  const handleConfigChange = (configId: string) => {
    setFormData({ ...formData, config_id: configId });
    if (configId) {
      fetchMondayData(configId);
    }
  };

  const handleAddFilter = () => {
    setFormData({
      ...formData,
      multiple_filters: [
        ...formData.multiple_filters,
        { column_id: '', operator: 'equals', value: '' },
      ],
    });
  };

  const handleRemoveFilter = (index: number) => {
    setFormData({
      ...formData,
      multiple_filters: formData.multiple_filters.filter((_, i) => i !== index),
    });
  };

  const handleUpdateFilter = (index: number, field: string, value: string) => {
    const updatedFilters = [...formData.multiple_filters];
    updatedFilters[index] = { ...updatedFilters[index], [field]: value };
    setFormData({ ...formData, multiple_filters: updatedFilters });
  };

  const handleAddSchedule = () => {
    if (!formData.schedule_day || !formData.schedule_time) {
      return;
    }

    const newSchedule = {
      schedule_type: formData.schedule_type,
      schedule_day: formData.schedule_day,
      schedule_time: formData.schedule_time,
    };

    setFormData({
      ...formData,
      schedules: [...formData.schedules, newSchedule],
      schedule_day: '',
      schedule_time: '09:00',
    });
  };

  const handleRemoveSchedule = (index: number) => {
    setFormData({
      ...formData,
      schedules: formData.schedules.filter((_, i) => i !== index),
    });
  };

  const calculateRecipientCount = () => {
    setIsCalculatingRecipients(true);

    try {
      // Filter items based on basic filters
      let filteredItems = mondayItems.filter((item) => {
        // Check status column match
        const statusColumn = item.column_values?.find(
          (col: any) => col.id === formData.status_column
        );
        const statusMatch = statusColumn?.text === formData.status_value;

        if (!statusMatch) return false;

        // Check phone column exists and not empty
        const phoneColumn = item.column_values?.find(
          (col: any) => col.id === formData.phone_column
        );
        if (!phoneColumn || !phoneColumn.text) return false;

        // Apply advanced filters
        if (formData.multiple_filters.length > 0) {
          return formData.multiple_filters.every((filter) => {
            const column = item.column_values?.find(
              (col: any) => col.id === filter.column_id
            );
            const columnValue = column?.text || '';
            const filterValue = filter.value;

            switch (filter.operator) {
              case 'equals':
                return columnValue === filterValue;
              case 'contains':
                return columnValue.toLowerCase().includes(filterValue.toLowerCase());
              case 'not_equals':
                return columnValue !== filterValue;
              case 'not_contains':
                return !columnValue.toLowerCase().includes(filterValue.toLowerCase());
              default:
                return true;
            }
          });
        }

        return true;
      });

      setRecipientCount(filteredItems.length);
    } catch (error) {
      console.error('Error calculating recipients:', error);
      setRecipientCount(0);
    } finally {
      setIsCalculatingRecipients(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhone || !formData.message_template || !formData.config_id) {
      setTestMessageResult({
        success: false,
        message: 'Please enter a phone number, message template, and select a configuration.',
      });
      return;
    }

    setIsSendingTest(true);
    setTestMessageResult(null);

    try {
      const response = await fetch('/api/test-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: testPhone,
          message_template: formData.message_template,
          config_id: formData.config_id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTestMessageResult({
          success: true,
          message: `Test message sent successfully to ${data.phone}!`,
        });
        setTestPhone('');
      } else {
        setTestMessageResult({
          success: false,
          message: data.error || 'Failed to send test message',
        });
      }
    } catch (error: any) {
      setTestMessageResult({
        success: false,
        message: error.message || 'An error occurred while sending test message',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);

    try {
      const user = authUtils.getUser();
      const workspace = authUtils.getWorkspace();

      if (!user) {
        router.push('/login');
        return;
      }

      const campaignData = {
        campaign_name: formData.campaign_name,
        description: formData.description,
        config_id: formData.config_id,
        status_column: formData.status_column,
        status_value: formData.status_value,
        phone_column: formData.phone_column,
        message_template: formData.message_template,
        selected_items: formData.selected_items,
        multiple_filters: formData.multiple_filters,
        schedule_type: formData.schedule_type,
        is_active: formData.is_active,
      };

      // Update campaign
      const { error: updateError } = await supabase
        .from('campaigns')
        .update(campaignData)
        .eq('id', campaignId);

      if (updateError) throw updateError;

      // Delete existing schedules
      await supabase
        .from('campaign_schedules')
        .delete()
        .eq('campaign_id', campaignId);

      // Insert new schedules if any
      if (formData.schedules.length > 0) {
        const schedules = formData.schedules.map((schedule) => ({
          campaign_id: campaignId,
          schedule_type: schedule.schedule_type,
          schedule_day: schedule.schedule_day,
          schedule_time: schedule.schedule_time,
          is_active: true,
        }));
        await supabase.from('campaign_schedules').insert(schedules);
      }

      alert('Campaign updated successfully!');
      router.push(`/campaigns/${campaignId}`);
    } catch (error: any) {
      console.error('Error updating campaign:', error);

      // Show detailed error message
      let errorMessage = 'Failed to update campaign. ';

      if (error?.message) {
        errorMessage += error.message;
      } else if (error?.error_description) {
        errorMessage += error.error_description;
      } else if (typeof error === 'string') {
        errorMessage += error;
      } else {
        errorMessage += 'Unknown error occurred. Check console for details.';
      }

      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'basic':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={formData.campaign_name}
                  onChange={(e) =>
                    setFormData({ ...formData, campaign_name: e.target.value })
                  }
                  placeholder="My SMS Campaign"
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Configuration *
                </label>
                <SearchableSelect
                  value={formData.config_id}
                  onChange={handleConfigChange}
                  options={configurations.map((config) => ({
                    value: config.id,
                    label: config.config_name,
                  }))}
                  placeholder="Choose a configuration..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe this campaign..."
                rows={4}
                className="input-field resize-none"
              />
            </div>
          </div>
        );

      case 'filters':
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
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Status Column *
                  </label>
                  <SearchableSelect
                    value={formData.status_column}
                    onChange={(value) =>
                      setFormData({ ...formData, status_column: value })
                    }
                    options={mondayColumns.map((col) => ({
                      value: col.id,
                      label: col.title,
                      subtitle: col.type,
                    }))}
                    placeholder="Choose status column..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Status Value *
                  </label>
                  <input
                    type="text"
                    value={formData.status_value}
                    onChange={(e) =>
                      setFormData({ ...formData, status_value: e.target.value })
                    }
                    placeholder="e.g., Active, Lead"
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Phone Column *
                  </label>
                  <SearchableSelect
                    value={formData.phone_column}
                    onChange={(value) =>
                      setFormData({ ...formData, phone_column: value })
                    }
                    options={mondayColumns.map((col) => ({
                      value: col.id,
                      label: col.title,
                      subtitle: col.type,
                    }))}
                    placeholder="Choose phone column..."
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 'advanced':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-600">
                Add multiple filter conditions to narrow down your target audience
              </p>
              <button
                type="button"
                onClick={handleAddFilter}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Filter
              </button>
            </div>
            {formData.multiple_filters.length === 0 ? (
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-12 text-center">
                <Filter className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                <p className="text-sm text-neutral-600">
                  No advanced filters added yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.multiple_filters.map((filter, index) => (
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
                        type="button"
                        onClick={() => handleRemoveFilter(index)}
                        className="mt-6 p-2 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'message':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Message Template *
              </label>
              <textarea
                value={formData.message_template}
                onChange={(e) =>
                  setFormData({ ...formData, message_template: e.target.value })
                }
                placeholder="Enter your SMS message template..."
                rows={8}
                required
                className="input-field resize-none font-mono text-sm"
              />
              <p className="text-xs text-neutral-500 mt-2">
                Character count: {formData.message_template.length} / 160
              </p>
            </div>

            {/* Test Message Section */}
            {formData.message_template && formData.config_id && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <Send className="w-4 h-4 text-green-600" />
                  Send Test Message
                </h4>
                <p className="text-xs text-neutral-600 mb-3">
                  Send a test SMS to verify your message template. Template placeholders will be replaced with [TEST].
                </p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Enter test phone number (e.g., 5551234567)"
                    className="flex-1 px-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestMessage}
                    disabled={isSendingTest || !testPhone}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                  >
                    {isSendingTest ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Test
                      </>
                    )}
                  </button>
                </div>
                {testMessageResult && (
                  <div
                    className={`mt-3 p-3 rounded-lg text-sm ${
                      testMessageResult.success
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}
                  >
                    {testMessageResult.message}
                  </div>
                )}
              </div>
            )}

            {mondayColumns.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-neutral-800 mb-3">
                  Available Column Tags
                </h4>
                <p className="text-xs text-neutral-600 mb-3">
                  Click on a tag to insert it into your message template. Tags will be replaced with actual values when sending.
                </p>
                <div className="flex flex-wrap gap-2">
                  {mondayColumns.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => {
                        const tag = `{${col.id}}`;
                        setFormData({
                          ...formData,
                          message_template: formData.message_template + tag,
                        });
                      }}
                      className="px-3 py-1.5 bg-white border border-blue-300 rounded-md text-xs font-mono text-blue-700 hover:bg-blue-100 transition-colors"
                      title={col.title}
                    >
                      {col.title}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-neutral-500 mt-3">
                  Tip: Column tags use IDs like {'{'}column_id{'}'} for compatibility
                </p>
              </div>
            )}
          </div>
        );

      case 'schedule':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Schedule Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['once', 'weekly', 'monthly'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, schedule_type: type })
                    }
                    className={`p-4 border-2 rounded-lg transition-all text-sm font-medium ${
                      formData.schedule_type === type
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {formData.schedule_type === 'weekly'
                    ? 'Day of Week'
                    : formData.schedule_type === 'monthly'
                    ? 'Day of Month'
                    : 'Date'}
                </label>
                {formData.schedule_type === 'once' && (
                  <input
                    type="date"
                    value={formData.schedule_day}
                    onChange={(e) =>
                      setFormData({ ...formData, schedule_day: e.target.value })
                    }
                    className="input-field"
                  />
                )}
                {formData.schedule_type === 'weekly' && (
                  <SearchableSelect
                    value={formData.schedule_day}
                    onChange={(value) =>
                      setFormData({ ...formData, schedule_day: value })
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
                {formData.schedule_type === 'monthly' && (
                  <SearchableSelect
                    value={formData.schedule_day}
                    onChange={(value) =>
                      setFormData({ ...formData, schedule_day: value })
                    }
                    options={Array.from({ length: 31 }, (_, i) => i + 1).map(
                      (day) => ({
                        value: day.toString(),
                        label: day.toString(),
                      })
                    )}
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
                  value={formData.schedule_time}
                  onChange={(e) =>
                    setFormData({ ...formData, schedule_time: e.target.value })
                  }
                  className="input-field"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Eastern Standard Time (EST)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  &nbsp;
                </label>
                <button
                  type="button"
                  onClick={handleAddSchedule}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Schedule
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <strong>Timezone:</strong> All times are in EST (Eastern Standard Time). The SMS server will execute campaigns based on EST timezone.
            </div>

            {formData.schedules.length > 0 && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-neutral-800 mb-3">
                  Scheduled Times ({formData.schedules.length})
                </h4>
                <div className="space-y-2">
                  {formData.schedules.map((schedule, index) => (
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
                        type="button"
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
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            {/* Recipient Count Card */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium opacity-90 mb-1">Estimated Recipients</h3>
                  {isCalculatingRecipients ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                      <span className="text-lg">Calculating...</span>
                    </div>
                  ) : (
                    <div className="text-4xl font-bold">{recipientCount}</div>
                  )}
                  <p className="text-xs opacity-75 mt-1">
                    {recipientCount === 0
                      ? 'No recipients match your filters'
                      : recipientCount === 1
                      ? '1 person will receive this message'
                      : `${recipientCount} people will receive this message`}
                  </p>
                </div>
                <Users className="w-16 h-16 opacity-20" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-lg p-6 text-white">
              <h3 className="text-lg font-semibold mb-4">Campaign Summary</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {formData.campaign_name}
                </div>
                <div>
                  <span className="font-medium">Configuration:</span>{' '}
                  {configurations.find((c) => c.id === formData.config_id)?.config_name}
                </div>
                {formData.description && (
                  <div>
                    <span className="font-medium">Description:</span> {formData.description}
                  </div>
                )}
                <div>
                  <span className="font-medium">Status Filter:</span> {formData.status_column} ={' '}
                  {formData.status_value}
                </div>
                <div>
                  <span className="font-medium">Phone Column:</span> {formData.phone_column}
                </div>
                {formData.multiple_filters.length > 0 && (
                  <div>
                    <span className="font-medium">Advanced Filters:</span>{' '}
                    {formData.multiple_filters.length} filter(s)
                  </div>
                )}
                <div>
                  <span className="font-medium">Message Length:</span>{' '}
                  {formData.message_template.length} characters
                </div>
                {formData.schedules.length > 0 && (
                  <div>
                    <span className="font-medium">Schedules:</span> {formData.schedules.length}{' '}
                    schedule(s)
                  </div>
                )}
              </div>
            </div>

            {/* Auto-activate Option */}
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <div>
                  <div className="font-medium text-neutral-800">
                    Keep campaign active
                  </div>
                  <p className="text-sm text-neutral-600 mt-1">
                    If checked, the campaign will remain active after updating. If unchecked, the campaign will be inactive and you'll need to manually activate it.
                  </p>
                </div>
              </label>
            </div>

            <div className={`border rounded-lg p-4 flex gap-3 ${formData.is_active ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${formData.is_active ? 'text-green-600' : 'text-yellow-600'}`} />
              <div className={`text-sm ${formData.is_active ? 'text-green-800' : 'text-yellow-800'}`}>
                <p className="font-medium mb-1">
                  {formData.is_active ? 'Campaign will stay active' : 'Campaign will be inactive'}
                </p>
                <p>
                  {formData.is_active
                    ? 'Your campaign will remain active after updating. Scheduled campaigns will continue executing at their scheduled times.'
                    : 'Your campaign will be updated as inactive. You can activate it later from the campaigns list.'}
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push(`/campaigns/${campaignId}`)}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">Edit Campaign</h1>
              <p className="text-sm text-neutral-600 mt-1">
                Update your SMS campaign settings and configuration
              </p>
            </div>
          </div>
          {currentSection === 'review' && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !formData.campaign_name || !formData.config_id}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Updating...' : 'Update Campaign'}
            </button>
          )}
        </div>

        {/* Section Tabs */}
        <div className="bg-white border border-neutral-200 rounded-lg p-2 flex gap-2 overflow-x-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setCurrentSection(section.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all whitespace-nowrap text-sm font-medium ${
                  currentSection === section.id
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Section Content */}
        <div className="card p-8 min-h-[500px]">{renderSection()}</div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push(`/campaigns/${campaignId}`)}
            className="btn-outline"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            {currentSection !== 'basic' && (
              <button
                type="button"
                onClick={() => {
                  const currentIndex = sections.findIndex((s) => s.id === currentSection);
                  if (currentIndex > 0) {
                    setCurrentSection(sections[currentIndex - 1].id);
                  }
                }}
                className="btn-outline"
              >
                Previous
              </button>
            )}
            {currentSection !== 'review' && (
              <button
                type="button"
                onClick={() => {
                  const currentIndex = sections.findIndex((s) => s.id === currentSection);
                  if (currentIndex < sections.length - 1) {
                    setCurrentSection(sections[currentIndex + 1].id);
                  }
                }}
                disabled={
                  (currentSection === 'basic' &&
                    (!formData.config_id || !formData.campaign_name)) ||
                  (currentSection === 'filters' &&
                    (!formData.status_column ||
                      !formData.status_value ||
                      !formData.phone_column)) ||
                  (currentSection === 'message' && !formData.message_template)
                }
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
