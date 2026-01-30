'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import {
  Plus,
  Settings,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Phone,
  User,
  Calendar,
  MapPin,
} from 'lucide-react';
import { authUtils } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { UserConfig } from '@/lib/types';

export default function ConfigurationsPage() {
  const [configurations, setConfigurations] = useState<UserConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<UserConfig | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // View Monday data state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingConfig, setViewingConfig] = useState<UserConfig | null>(null);
  const [mondayItems, setMondayItems] = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    config_name: '',
    description: '',
    monday_api_key: '',
    board_id: '',
    group_id: '',
    openphone_api_key: '',
    sender_phone: '',
  });

  const [showKeys, setShowKeys] = useState({
    monday_api_key: false,
    openphone_api_key: false,
  });

  // Test OpenPhone connection state
  const [isTestingOpenPhone, setIsTestingOpenPhone] = useState(false);
  const [testOpenPhoneResult, setTestOpenPhoneResult] = useState<{
    success: boolean;
    message: string;
    warning?: boolean;
  } | null>(null);

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      const user = authUtils.getUser();
      const workspace = authUtils.getWorkspace();

      if (!user) return;

      const { data, error } = await supabase
        .from('user_configs')
        .select('*')
        .or(`user_id.eq.${user.id},workspace_id.eq.${workspace?.id || ''}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setConfigurations(data || []);
    } catch (error) {
      console.error('Error fetching configurations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (config?: UserConfig) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        config_name: config.config_name,
        description: config.description || '',
        monday_api_key: config.monday_api_key,
        board_id: config.board_id,
        group_id: config.group_id,
        openphone_api_key: config.openphone_api_key || '',
        sender_phone: config.sender_phone || '',
      });
    } else {
      setEditingConfig(null);
      setFormData({
        config_name: '',
        description: '',
        monday_api_key: '',
        board_id: '',
        group_id: '',
        openphone_api_key: '',
        sender_phone: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingConfig(null);
    setShowKeys({ monday_api_key: false, openphone_api_key: false });
    setTestOpenPhoneResult(null);
  };

  const handleTestOpenPhone = async () => {
    if (!formData.openphone_api_key || !formData.sender_phone) {
      setTestOpenPhoneResult({
        success: false,
        message: 'Please enter both OpenPhone API key and sender phone number',
      });
      return;
    }

    setIsTestingOpenPhone(true);
    setTestOpenPhoneResult(null);

    try {
      const response = await fetch('/api/configs/test-openphone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openphone_api_key: formData.openphone_api_key,
          sender_phone: formData.sender_phone,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTestOpenPhoneResult({
          success: true,
          message: data.message,
          warning: data.warning,
        });
      } else {
        setTestOpenPhoneResult({
          success: false,
          message: data.error || 'Failed to test OpenPhone connection',
        });
      }
    } catch (error: any) {
      setTestOpenPhoneResult({
        success: false,
        message: error.message || 'An error occurred while testing OpenPhone connection',
      });
    } finally {
      setIsTestingOpenPhone(false);
    }
  };

  const handleSave = async () => {
    try {
      const user = authUtils.getUser();
      const workspace = authUtils.getWorkspace();

      if (!user) return;

      if (editingConfig) {
        // Update existing configuration
        const { error } = await supabase
          .from('user_configs')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingConfig.id);

        if (error) throw error;

        setSuccessMessage('Configuration updated successfully!');
      } else {
        // Create new configuration
        const { error } = await supabase.from('user_configs').insert({
          ...formData,
          user_id: user.id,
          workspace_id: workspace?.id || null,
        });

        if (error) throw error;

        setSuccessMessage('Configuration created successfully!');
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      handleCloseModal();
      fetchConfigurations();
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Error saving configuration. Please try again.');
    }
  };

  const handleDelete = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_configs')
        .delete()
        .eq('id', configId);

      if (error) throw error;

      setSuccessMessage('Configuration deleted successfully!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      fetchConfigurations();
    } catch (error) {
      console.error('Error deleting configuration:', error);
      alert('Error deleting configuration. Please try again.');
    }
  };

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const getColumnValue = (item: any, columnId: string) => {
    const col = item.column_values?.find((c: any) => c.id === columnId);
    return col?.text || '';
  };

  const handleViewData = async (config: UserConfig) => {
    setViewingConfig(config);
    setIsViewModalOpen(true);
    setIsLoadingItems(true);
    setMondayItems([]);
    setExpandedItems(new Set());

    try {
      // Fetch items from Monday.com using GraphQL
      const query = `
        query {
          boards(ids: [${config.board_id}]) {
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
                    value
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: config.monday_api_key,
        },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const items =
        result.data?.boards?.[0]?.groups?.[0]?.items_page?.items || [];
      setMondayItems(items);
    } catch (error: any) {
      console.error('Error fetching Monday.com data:', error);
      alert(`Error fetching data: ${error.message}`);
    } finally {
      setIsLoadingItems(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-800">
              Configurations
            </h1>
            <p className="text-sm text-neutral-600 mt-1">
              Manage your Monday.com and OpenPhone API configurations
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Configuration
          </button>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Configurations Grid */}
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
        ) : configurations.length === 0 ? (
          <div className="card p-12 text-center">
            <Settings className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">
              No configurations yet
            </h3>
            <p className="text-neutral-600 mb-6">
              Create your first configuration to start sending SMS campaigns
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Configuration
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configurations.map((config) => (
              <div
                key={config.id}
                className="card hover:shadow-lg transition-all"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Settings className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleViewData(config)}
                        className="p-2 hover:bg-blue-50 rounded transition-colors"
                        title="View Monday.com Data"
                      >
                        <Eye className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(config)}
                        className="p-2 hover:bg-neutral-100 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-neutral-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="p-2 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-semibold text-neutral-800 mb-2">
                    {config.config_name}
                  </h3>

                  {config.description && (
                    <p className="text-sm text-neutral-600 mb-4 line-clamp-2">
                      {config.description}
                    </p>
                  )}

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Board ID:</span>
                      <span className="font-mono text-neutral-700">
                        {config.board_id}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Group ID:</span>
                      <span className="font-mono text-neutral-700">
                        {config.group_id}
                      </span>
                    </div>
                    {config.sender_phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Sender Phone:</span>
                        <span className="font-mono text-neutral-700">
                          {config.sender_phone}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-neutral-200">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-neutral-600">
                            Active
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-neutral-500">
                        {new Date(config.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Configuration Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingConfig ? 'Edit Configuration' : 'Add Configuration'}
          size="lg"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-4"
          >
            {/* Configuration Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Configuration Name *
              </label>
              <input
                type="text"
                value={formData.config_name}
                onChange={(e) =>
                  setFormData({ ...formData, config_name: e.target.value })
                }
                placeholder="My Configuration"
                required
                className="input-field"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe this configuration..."
                rows={3}
                className="input-field resize-none"
              />
            </div>

            {/* Monday.com API Key */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Monday.com API Key *
              </label>
              <div className="relative">
                <input
                  type={showKeys.monday_api_key ? 'text' : 'password'}
                  value={formData.monday_api_key}
                  onChange={(e) =>
                    setFormData({ ...formData, monday_api_key: e.target.value })
                  }
                  placeholder="Enter your Monday.com API key"
                  required
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowKeys({
                      ...showKeys,
                      monday_api_key: !showKeys.monday_api_key,
                    })
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showKeys.monday_api_key ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Board ID and Group ID */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Board ID *
                </label>
                <input
                  type="text"
                  value={formData.board_id}
                  onChange={(e) =>
                    setFormData({ ...formData, board_id: e.target.value })
                  }
                  placeholder="1234567890"
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Group ID *
                </label>
                <input
                  type="text"
                  value={formData.group_id}
                  onChange={(e) =>
                    setFormData({ ...formData, group_id: e.target.value })
                  }
                  placeholder="topics"
                  required
                  className="input-field"
                />
              </div>
            </div>

            {/* OpenPhone API Key */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                OpenPhone API Key
              </label>
              <div className="relative">
                <input
                  type={showKeys.openphone_api_key ? 'text' : 'password'}
                  value={formData.openphone_api_key}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      openphone_api_key: e.target.value,
                    })
                  }
                  placeholder="Enter your OpenPhone API key"
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowKeys({
                      ...showKeys,
                      openphone_api_key: !showKeys.openphone_api_key,
                    })
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showKeys.openphone_api_key ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Sender Phone */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Sender Phone Number
              </label>
              <input
                type="tel"
                value={formData.sender_phone}
                onChange={(e) =>
                  setFormData({ ...formData, sender_phone: e.target.value })
                }
                placeholder="+1234567890"
                className="input-field"
              />
            </div>

            {/* Test OpenPhone Connection */}
            {formData.openphone_api_key && formData.sender_phone && (
              <div>
                <button
                  type="button"
                  onClick={handleTestOpenPhone}
                  disabled={isTestingOpenPhone}
                  className="w-full btn-outline flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTestingOpenPhone ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4" />
                      Test OpenPhone Connection
                    </>
                  )}
                </button>
                {testOpenPhoneResult && (
                  <div
                    className={`mt-3 p-3 rounded-lg text-sm ${
                      testOpenPhoneResult.success
                        ? testOpenPhoneResult.warning
                          ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                          : 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {testOpenPhoneResult.success ? (
                        <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium">{testOpenPhoneResult.message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">Configuration Tips:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Get your Monday.com API key from your account settings</li>
                  <li>Board ID can be found in the board URL</li>
                  <li>OpenPhone API key is optional but required for SMS sending</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex-1 btn-outline flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingConfig ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>

        {/* View Monday.com Data Modal */}
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setViewingConfig(null);
            setMondayItems([]);
          }}
          title={
            viewingConfig
              ? `Monday.com Data - ${viewingConfig.config_name}`
              : 'Monday.com Data'
          }
          size="2xl"
        >
          <div className="space-y-4">
            {/* Config Info */}
            {viewingConfig && (
              <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-lg p-4 text-white">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary-100" />
                    <div>
                      <div className="text-xs text-primary-100 mb-0.5">
                        Board ID
                      </div>
                      <div className="font-mono font-semibold">
                        {viewingConfig.board_id}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-secondary-100" />
                    <div>
                      <div className="text-xs text-secondary-100 mb-0.5">
                        Group ID
                      </div>
                      <div className="font-mono font-semibold">
                        {viewingConfig.group_id}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoadingItems && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
              </div>
            )}

            {/* Items Cards */}
            {!isLoadingItems && mondayItems.length > 0 && (
              <div className="space-y-3">
                {mondayItems.map((item) => {
                  const isExpanded = expandedItems.has(item.id);
                  const statusCol = item.column_values?.find(
                    (c: any) => c.id.includes('status') || c.id.includes('Status')
                  );
                  const phoneCol = item.column_values?.find(
                    (c: any) =>
                      c.id.includes('phone') ||
                      c.id.includes('Phone') ||
                      c.id.includes('seller_phone')
                  );
                  const dateCol = item.column_values?.find(
                    (c: any) =>
                      c.id.includes('date') ||
                      c.id.includes('Date') ||
                      c.type === 'date'
                  );
                  const peopleCol = item.column_values?.find(
                    (c: any) =>
                      c.id.includes('people') ||
                      c.id.includes('person') ||
                      c.type === 'multiple-person'
                  );

                  // Get all other columns (excluding the ones we show prominently)
                  const otherColumns = item.column_values?.filter(
                    (c: any) =>
                      c.text &&
                      c.id !== statusCol?.id &&
                      c.id !== phoneCol?.id &&
                      c.id !== dateCol?.id &&
                      c.id !== peopleCol?.id &&
                      !c.id.includes('long_text') // Skip very long text fields
                  );

                  return (
                    <div
                      key={item.id}
                      className="border border-neutral-200 rounded-lg hover:shadow-md transition-all bg-white"
                    >
                      {/* Card Header */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-neutral-900 text-base mb-1 truncate">
                              {item.name}
                            </h4>
                            <p className="text-xs text-neutral-500 font-mono">
                              ID: {item.id}
                            </p>
                          </div>
                          {statusCol?.text && (
                            <span className="status-badge bg-blue-100 text-blue-700 border-blue-200 flex-shrink-0">
                              {statusCol.text}
                            </span>
                          )}
                        </div>

                        {/* Quick Info Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                          {peopleCol?.text && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                              <span className="text-neutral-700 truncate">
                                {peopleCol.text}
                              </span>
                            </div>
                          )}
                          {phoneCol?.text && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                              <span className="text-neutral-700 font-mono">
                                {phoneCol.text}
                              </span>
                            </div>
                          )}
                          {dateCol?.text && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                              <span className="text-neutral-700">
                                {dateCol.text}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Expand Button */}
                        {otherColumns && otherColumns.length > 0 && (
                          <button
                            onClick={() => toggleItemExpanded(item.id)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors text-sm text-neutral-700 font-medium"
                          >
                            <span>
                              {isExpanded
                                ? 'Hide details'
                                : `Show ${otherColumns.length} more field${
                                    otherColumns.length !== 1 ? 's' : ''
                                  }`}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && otherColumns && otherColumns.length > 0 && (
                        <div className="border-t border-neutral-200 p-4 bg-neutral-50">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {otherColumns.map((col: any, idx: number) => (
                              <div
                                key={idx}
                                className="bg-white rounded-lg p-3 border border-neutral-200"
                              >
                                <div className="text-xs font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                                  {col.id.replace(/_/g, ' ')}
                                </div>
                                <div className="text-sm text-neutral-900 break-words">
                                  {col.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {!isLoadingItems && mondayItems.length === 0 && (
              <div className="text-center py-12">
                <Settings className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                  No items found
                </h3>
                <p className="text-neutral-600 text-sm">
                  This board/group doesn't have any items yet, or there was an
                  error fetching the data.
                </p>
              </div>
            )}

            {/* Info Footer */}
            {!isLoadingItems && mondayItems.length > 0 && (
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-neutral-700">
                      <strong className="text-neutral-900">{mondayItems.length}</strong> items loaded
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-neutral-500" />
                    <span className="text-neutral-700">
                      {mondayItems[0]?.column_values?.length || 0} columns
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (expandedItems.size === mondayItems.length) {
                      setExpandedItems(new Set());
                    } else {
                      setExpandedItems(new Set(mondayItems.map((i) => i.id)));
                    }
                  }}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  {expandedItems.size === mondayItems.length
                    ? 'Collapse All'
                    : 'Expand All'}
                </button>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
