'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SearchableSelect from '@/components/ui/SearchableSelect';
import Toast from '@/components/ui/Toast';
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

export default function NewCampaignPage() {
  const router = useRouter();
  const [configurations, setConfigurations] = useState<UserConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSection, setCurrentSection] = useState<Section>('basic');

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

  // Personalization UI states
  const [messageTemplateRef, setMessageTemplateRef] = useState<HTMLTextAreaElement | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [columnSearch, setColumnSearch] = useState('');

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

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

    // Check for clone data in sessionStorage
    const cloneData = sessionStorage.getItem('cloneCampaignData');
    if (cloneData) {
      try {
        const parsedData = JSON.parse(cloneData);
        setFormData(parsedData);

        // Fetch Monday data if config_id exists
        if (parsedData.config_id) {
          // Wait for configurations to be loaded first
          setTimeout(() => {
            fetchMondayData(parsedData.config_id);
          }, 500);
        }

        // Clear the sessionStorage after loading
        sessionStorage.removeItem('cloneCampaignData');
      } catch (error) {
        console.error('Error loading clone data:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (currentSection === 'review' && mondayItems.length > 0) {
      calculateRecipientCount();
    }
  }, [currentSection, mondayItems, formData.status_column, formData.status_value, formData.phone_column, formData.multiple_filters, formData.selected_items]);

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

      // First, fetch columns separately
      const columnsQuery = `
        query {
          boards(ids: [${config.board_id}]) {
            columns {
              id
              title
              type
            }
          }
        }
      `;

      console.log('Fetching Monday.com columns...');

      const columnsResponse = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: config.monday_api_key,
        },
        body: JSON.stringify({ query: columnsQuery }),
      });

      const columnsResult = await columnsResponse.json();

      if (columnsResult.errors) {
        console.error('Monday.com API errors (columns):', columnsResult.errors);
        throw new Error(columnsResult.errors[0].message);
      }

      if (!columnsResult.data || !columnsResult.data.boards || columnsResult.data.boards.length === 0) {
        console.error('No boards found in columns response');
        throw new Error('No boards found in Monday.com response. Please check board ID and API key permissions.');
      }

      const columns = columnsResult.data.boards[0]?.columns || [];
      console.log('Extracted columns:', columns);
      setMondayColumns(columns);

      // Now fetch all items with pagination
      let allItems: any[] = [];
      let hasNextPage = true;
      let cursor: string | null = null;
      let pageCount = 0;
      const maxPages = 50; // Limit to 50 pages (5,000 items max)

      console.log('Starting Monday.com pagination...');

      while (hasNextPage && pageCount < maxPages) {
        pageCount++;

        const itemsQuery = `
          query {
            boards(ids: [${config.board_id}]) {
              groups(ids: ["${config.group_id}"]) {
                items_page(limit: 100${cursor ? `, cursor: "${cursor}"` : ''}) {
                  cursor
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

        console.log(`Fetching page ${pageCount}...`);

        const itemsResponse = await fetch('https://api.monday.com/v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: config.monday_api_key,
          },
          body: JSON.stringify({ query: itemsQuery }),
        });

        const itemsResult = await itemsResponse.json();

        if (itemsResult.errors) {
          console.error('Monday.com API errors (items):', itemsResult.errors);
          throw new Error(itemsResult.errors[0].message);
        }

        const board = itemsResult.data?.boards?.[0];
        const group = board?.groups?.[0];
        const itemsPage = group?.items_page;

        if (!itemsPage) {
          console.log('No more items found');
          break;
        }

        const items = itemsPage.items || [];
        allItems = allItems.concat(items);

        console.log(`Page ${pageCount}: Fetched ${items.length} items (Total: ${allItems.length})`);

        // Check if there's a next page
        if (itemsPage.cursor && items.length === 100) {
          cursor = itemsPage.cursor;
        } else {
          hasNextPage = false;
        }
      }

      console.log(`Pagination complete: ${allItems.length} total items from ${pageCount} page(s)`);

      setMondayItems(allItems);
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

      // Apply selected items filter if any
      if (formData.selected_items.length > 0) {
        filteredItems = filteredItems.filter(item => formData.selected_items.includes(item.id));
      }

      setRecipientCount(filteredItems.length);
    } catch (error) {
      console.error('Error calculating recipients:', error);
      setRecipientCount(0);
    } finally {
      setIsCalculatingRecipients(false);
    }
  };

  const insertTagAtCursor = (tag: string) => {
    if (!messageTemplateRef) {
      // Fallback to appending if ref not available
      setFormData({
        ...formData,
        message_template: formData.message_template + tag,
      });
      return;
    }

    const start = messageTemplateRef.selectionStart;
    const end = messageTemplateRef.selectionEnd;
    const text = formData.message_template;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + tag + after;

    setFormData({
      ...formData,
      message_template: newText,
    });

    // Set cursor position after the inserted tag
    setTimeout(() => {
      if (messageTemplateRef) {
        messageTemplateRef.focus();
        messageTemplateRef.setSelectionRange(start + tag.length, start + tag.length);
      }
    }, 0);
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
        user_id: user.id,
        workspace_id: workspace?.id || null,
        is_active: formData.is_active,
      };

      const { data, error } = await supabase
        .from('campaigns')
        .insert(campaignData)
        .select();

      if (error) throw error;

      // Insert schedules if any
      if (formData.schedules.length > 0 && data && data[0]) {
        const schedules = formData.schedules.map((schedule) => ({
          campaign_id: data[0].id,
          ...schedule,
          is_active: true, // Always create schedules as active
        }));
        await supabase.from('campaign_schedules').insert(schedules);
      }

      setToast({ message: 'Campaign created successfully!', type: 'success' });
      setTimeout(() => {
        router.push('/campaigns');
      }, 1500);
    } catch (error: any) {
      console.error('Error creating campaign:', error);

      // Show detailed error message
      let errorMessage = 'Failed to create campaign. ';

      if (error?.message) {
        errorMessage += error.message;
      } else if (error?.error_description) {
        errorMessage += error.error_description;
      } else if (typeof error === 'string') {
        errorMessage += error;
      } else {
        errorMessage += 'Unknown error occurred. Check console for details.';
      }

      setToast({ message: errorMessage, type: 'error' });
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
              <>
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
              </>
            )}
          </div>
        );

      case 'advanced':
        return (
          <div className="space-y-6">
            {/* Advanced Filters Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-800">Advanced Filters</h3>
                  <p className="text-xs text-neutral-600 mt-1">
                    Add multiple filter conditions to narrow down your target audience
                  </p>
                </div>
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
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-8 text-center">
                  <Filter className="w-10 h-10 text-neutral-400 mx-auto mb-2" />
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

            {/* Batch Selection Section */}
            {mondayItems.length > 0 && formData.status_column && formData.status_value && formData.phone_column && (
              <div className="bg-primary-50 border-2 border-primary-300 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary-600" />
                      Batch Selection
                    </h3>
                    <p className="text-xs text-neutral-600 mt-1">
                      Select specific items to include in this campaign. Items shown are filtered by your basic and advanced filters.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary-700">
                      {formData.selected_items.length}
                    </div>
                    <div className="text-[10px] text-primary-600 uppercase tracking-wide">
                      Selected
                    </div>
                  </div>
                </div>

                {/* Selection Controls */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      // Select all filtered items
                      const filteredItems = mondayItems.filter((item) => {
                        const statusColumn = item.column_values?.find(
                          (col: any) => col.id === formData.status_column
                        );
                        const phoneColumn = item.column_values?.find(
                          (col: any) => col.id === formData.phone_column
                        );

                        if (statusColumn?.text !== formData.status_value || !phoneColumn?.text) {
                          return false;
                        }

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

                      setFormData({
                        ...formData,
                        selected_items: filteredItems.map((item) => item.id),
                      });
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                  >
                    Select All Filtered
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        selected_items: [],
                      });
                    }}
                    className="px-4 py-2 bg-white border border-primary-300 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors"
                  >
                    Deselect All
                  </button>
                </div>

                {/* Range Selection */}
                <div className="bg-white rounded-lg p-4 mb-4">
                  <h4 className="text-xs font-semibold text-neutral-700 mb-3">
                    Select Range by Index
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-600 mb-1 uppercase tracking-wide">
                        Start Index
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="1"
                        id="range-start"
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-600 mb-1 uppercase tracking-wide">
                        End Index
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="100"
                        id="range-end"
                        className="input-field text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          const startInput = document.getElementById('range-start') as HTMLInputElement;
                          const endInput = document.getElementById('range-end') as HTMLInputElement;
                          const start = parseInt(startInput.value);
                          const end = parseInt(endInput.value);

                          if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
                            alert('Please enter valid start and end indices');
                            return;
                          }

                          // Filter items first
                          const filteredItems = mondayItems.filter((item) => {
                            const statusColumn = item.column_values?.find(
                              (col: any) => col.id === formData.status_column
                            );
                            const phoneColumn = item.column_values?.find(
                              (col: any) => col.id === formData.phone_column
                            );

                            if (statusColumn?.text !== formData.status_value || !phoneColumn?.text) {
                              return false;
                            }

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

                          // Select items in range (1-indexed)
                          const selectedInRange = filteredItems.slice(start - 1, end).map((item) => item.id);
                          setFormData({
                            ...formData,
                            selected_items: selectedInRange,
                          });
                        }}
                        className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                      >
                        Select Range
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="bg-white rounded-lg border border-primary-200 overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-primary-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-primary-900 w-12">
                            #
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-primary-900 w-12">
                            <input
                              type="checkbox"
                              checked={
                                mondayItems.filter((item) => {
                                  const statusColumn = item.column_values?.find(
                                    (col: any) => col.id === formData.status_column
                                  );
                                  const phoneColumn = item.column_values?.find(
                                    (col: any) => col.id === formData.phone_column
                                  );
                                  return statusColumn?.text === formData.status_value && phoneColumn?.text;
                                }).length > 0 &&
                                mondayItems.filter((item) => {
                                  const statusColumn = item.column_values?.find(
                                    (col: any) => col.id === formData.status_column
                                  );
                                  const phoneColumn = item.column_values?.find(
                                    (col: any) => col.id === formData.phone_column
                                  );
                                  return statusColumn?.text === formData.status_value && phoneColumn?.text;
                                }).every((item) => formData.selected_items.includes(item.id))
                              }
                              onChange={(e) => {
                                const filteredItems = mondayItems.filter((item) => {
                                  const statusColumn = item.column_values?.find(
                                    (col: any) => col.id === formData.status_column
                                  );
                                  const phoneColumn = item.column_values?.find(
                                    (col: any) => col.id === formData.phone_column
                                  );

                                  if (statusColumn?.text !== formData.status_value || !phoneColumn?.text) {
                                    return false;
                                  }

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

                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    selected_items: filteredItems.map((item) => item.id),
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    selected_items: [],
                                  });
                                }
                              }}
                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-primary-900">
                            Item Name
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-primary-900">
                            Status
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-primary-900">
                            Phone
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {mondayItems
                          .map((item, index) => {
                            const statusColumn = item.column_values?.find(
                              (col: any) => col.id === formData.status_column
                            );
                            const phoneColumn = item.column_values?.find(
                              (col: any) => col.id === formData.phone_column
                            );

                            // Check if item matches filters
                            const matchesBasicFilters = statusColumn?.text === formData.status_value && phoneColumn?.text;

                            let matchesAdvancedFilters = true;
                            if (formData.multiple_filters.length > 0) {
                              matchesAdvancedFilters = formData.multiple_filters.every((filter) => {
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

                            const matchesAllFilters = matchesBasicFilters && matchesAdvancedFilters;

                            if (!matchesAllFilters) return null;

                            return (
                              <tr
                                key={item.id}
                                className={`hover:bg-primary-50 transition-colors ${
                                  formData.selected_items.includes(item.id) ? 'bg-primary-50' : ''
                                }`}
                              >
                                <td className="px-3 py-2 text-neutral-600 font-mono">
                                  {index + 1}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={formData.selected_items.includes(item.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormData({
                                          ...formData,
                                          selected_items: [...formData.selected_items, item.id],
                                        });
                                      } else {
                                        setFormData({
                                          ...formData,
                                          selected_items: formData.selected_items.filter(
                                            (id) => id !== item.id
                                          ),
                                        });
                                      }
                                    }}
                                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                  />
                                </td>
                                <td className="px-3 py-2 text-neutral-900 font-medium">
                                  {item.name}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                                    {statusColumn?.text}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-neutral-700 font-mono text-[11px]">
                                  {phoneColumn?.text}
                                </td>
                              </tr>
                            );
                          })
                          .filter(Boolean)}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Message when prerequisites not met */}
            {(!formData.status_column || !formData.status_value || !formData.phone_column || mondayItems.length === 0) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                      Batch Selection Not Available
                    </h4>
                    <p className="text-xs text-yellow-800">
                      Complete the Basic Filters section first (Status Column, Status Value, and Phone Column) to enable batch selection.
                    </p>
                  </div>
                </div>
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
                ref={(el) => setMessageTemplateRef(el)}
                value={formData.message_template}
                onChange={(e) =>
                  setFormData({ ...formData, message_template: e.target.value })
                }
                onSelect={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  setCursorPosition(target.selectionStart);
                }}
                onClick={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  setCursorPosition(target.selectionStart);
                }}
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
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      Personalization Tags
                    </h4>
                    <p className="text-xs text-neutral-600 mt-1">
                      Click any tag to insert it at cursor position. Tags will be replaced with actual values when sending.
                    </p>
                  </div>
                  <div className="text-xs text-neutral-500 bg-white px-2 py-1 rounded border border-neutral-200">
                    {mondayColumns.length} columns
                  </div>
                </div>

                {/* Search */}
                {mondayColumns.length > 6 && (
                  <div className="mb-3">
                    <input
                      type="text"
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      placeholder="Search columns..."
                      className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Column Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {mondayColumns
                    .filter((col) =>
                      columnSearch
                        ? col.title.toLowerCase().includes(columnSearch.toLowerCase()) ||
                          col.id.toLowerCase().includes(columnSearch.toLowerCase())
                        : true
                    )
                    .map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => insertTagAtCursor(`{${col.id}}`)}
                        className="group relative px-3 py-2.5 bg-white border-2 border-blue-200 rounded-lg text-left hover:border-blue-400 hover:shadow-md transition-all duration-200"
                        title={`Click to insert {${col.id}}`}
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-neutral-800 truncate">
                            {col.title}
                          </span>
                          <span className="text-[10px] font-mono text-blue-600 truncate">
                            {`{${col.id}}`}
                          </span>
                          <span className="text-[10px] text-neutral-500 capitalize">
                            {col.type}
                          </span>
                        </div>
                        <div className="absolute inset-0 bg-blue-400 opacity-0 group-hover:opacity-10 rounded-lg transition-opacity"></div>
                      </button>
                    ))}
                </div>

                {/* Example Preview */}
                {formData.message_template && formData.message_template.includes('{') && (
                  <div className="mt-4 p-3 bg-white border border-blue-300 rounded-lg">
                    <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                      Example Preview
                    </p>
                    <p className="text-xs font-mono text-neutral-700 leading-relaxed">
                      {formData.message_template.replace(/\{([^}]+)\}/g, (match, columnId) => {
                        const column = mondayColumns.find((col) => col.id === columnId);
                        return column ? `[${column.title}]` : match;
                      })}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex items-start gap-2 bg-blue-100 rounded-lg p-2">
                  <AlertCircle className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-800 leading-relaxed">
                    <strong>Tip:</strong> Position your cursor where you want to insert a tag, then click the column button. Tags use column IDs for reliability.
                  </p>
                </div>
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
              <strong>⏰ Timezone:</strong> All times are in EST (Eastern Standard Time). The SMS server will execute campaigns based on EST timezone.
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
          <div className="space-y-4">
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

            {/* Grid Layout for Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Basic Info */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary-600" />
                  Basic Information
                </h3>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-start pb-2 border-b border-neutral-200">
                    <span className="text-xs text-neutral-600">Campaign Name</span>
                    <span className="text-xs font-semibold text-neutral-900 text-right max-w-[60%]">
                      {formData.campaign_name}
                    </span>
                  </div>
                  <div className="flex justify-between items-start pb-2 border-b border-neutral-200">
                    <span className="text-xs text-neutral-600">Configuration</span>
                    <span className="text-xs font-medium text-neutral-900">
                      {configurations.find((c) => c.id === formData.config_id)?.config_name}
                    </span>
                  </div>
                  {formData.description && (
                    <div className="pb-2 border-b border-neutral-200">
                      <span className="text-xs text-neutral-600 block mb-1">Description</span>
                      <p className="text-xs text-neutral-900">{formData.description}</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-600">Status</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      formData.is_active ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-700'
                    }`}>
                      {formData.is_active ? 'Will Activate' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Filter Configuration */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary-600" />
                  Filter Configuration
                </h3>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                    <span className="text-xs text-neutral-600">Status Column</span>
                    <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded text-neutral-900">
                      {formData.status_column}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                    <span className="text-xs text-neutral-600">Status Value</span>
                    <span className="text-xs font-semibold text-neutral-900">
                      {formData.status_value}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                    <span className="text-xs text-neutral-600">Phone Column</span>
                    <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded text-neutral-900">
                      {formData.phone_column}
                    </span>
                  </div>
                  {formData.selected_items.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-neutral-600">Selected Items</span>
                      <span className="text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                        {formData.selected_items.length} items selected
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Message Template */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <Send className="w-4 h-4 text-primary-600" />
                Message Template
              </h3>
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <p className="text-sm font-mono text-neutral-900 whitespace-pre-wrap leading-relaxed">
                  {formData.message_template}
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-200">
                  <span className="text-xs text-neutral-600">
                    {formData.message_template.match(/\{([^}]+)\}/g)?.length || 0} personalization tags
                  </span>
                  <span className={`text-xs font-semibold ${
                    formData.message_template.length > 160 ? 'text-orange-600' : 'text-neutral-700'
                  }`}>
                    {formData.message_template.length} characters
                    {formData.message_template.length > 160 && ' (⚠ Exceeds 160)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Advanced Filters */}
            {formData.multiple_filters.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary-600" />
                  Advanced Filters ({formData.multiple_filters.length})
                </h3>
                <div className="space-y-2">
                  {formData.multiple_filters.map((filter, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs"
                    >
                      <span className="font-mono text-blue-900 bg-white px-2 py-1 rounded">
                        {mondayColumns.find(col => col.id === filter.column_id)?.title || filter.column_id}
                      </span>
                      <span className="text-blue-700 font-medium uppercase text-[10px]">
                        {filter.operator.replace('_', ' ')}
                      </span>
                      <span className="font-semibold text-blue-900 bg-white px-2 py-1 rounded flex-1">
                        "{filter.value}"
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schedules */}
            {formData.schedules.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary-600" />
                  Schedules ({formData.schedules.length})
                </h3>
                <div className="space-y-2">
                  {formData.schedules.map((schedule, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-neutral-900 uppercase tracking-wide">
                            {schedule.schedule_type}
                          </div>
                          <div className="text-sm font-medium text-indigo-900 mt-0.5">
                            {schedule.schedule_type === 'once' && (
                              <>{new Date(schedule.schedule_day).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</>
                            )}
                            {schedule.schedule_type === 'weekly' && (
                              <>Every {schedule.schedule_day}</>
                            )}
                            {schedule.schedule_type === 'monthly' && (
                              <>{schedule.schedule_day}th of every month</>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-indigo-900">
                          {schedule.schedule_time}
                        </div>
                        <div className="text-[10px] text-indigo-700 uppercase tracking-wider">
                          EST
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                    Activate campaign immediately
                  </div>
                  <p className="text-sm text-neutral-600 mt-1">
                    If checked, the campaign will be active and scheduled campaigns will start executing automatically. If unchecked, you'll need to manually activate it later.
                  </p>
                </div>
              </label>
            </div>

            <div className={`border rounded-lg p-4 flex gap-3 ${formData.is_active ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${formData.is_active ? 'text-green-600' : 'text-yellow-600'}`} />
              <div className={`text-sm ${formData.is_active ? 'text-green-800' : 'text-yellow-800'}`}>
                <p className="font-medium mb-1">
                  {formData.is_active ? 'Campaign will be activated' : 'Ready to create'}
                </p>
                <p>
                  {formData.is_active
                    ? 'Your campaign will be created and activated immediately. Scheduled campaigns will start executing at their scheduled times.'
                    : 'Your campaign will be created as inactive. You can activate it from the campaigns list.'}
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
              onClick={() => router.push('/campaigns')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">Create New Campaign</h1>
              <p className="text-sm text-neutral-600 mt-1">
                Set up your SMS campaign with filters and scheduling
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
              {isSaving ? 'Saving...' : 'Save Campaign'}
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
            onClick={() => router.push('/campaigns')}
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

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </DashboardLayout>
  );
}
