import React, { useState, useEffect, useRef } from 'react';
import { TenantAPI, TenantSettings, TenantStats } from '../services/tenant';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BrandedButton } from '../components/BrandedButton';
import { useBranding } from '../contexts/BrandingContext';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange, disabled = false }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex items-center space-x-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 border border-gray-300 rounded cursor-pointer disabled:cursor-not-allowed"
          disabled={disabled}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          placeholder="#000000"
          disabled={disabled}
        />
      </div>
    </div>
  );
};

interface LogoUploadProps {
  currentLogoUrl?: string;
  onLogoChange: (logoUrl: string | null) => void;
  disabled?: boolean;
}

const LogoUpload: React.FC<LogoUploadProps> = ({ currentLogoUrl, onLogoChange, disabled = false }) => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    try {
      setUploading(true);
      const result = await TenantAPI.uploadLogo(file);
      onLogoChange(result.logoUrl);
    } catch (error) {
      console.error('Failed to upload logo:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Are you sure you want to delete the current logo?')) {
      return;
    }

    try {
      setDeleting(true);
      await TenantAPI.deleteLogo();
      onLogoChange(null);
    } catch (error) {
      console.error('Failed to delete logo:', error);
      alert('Failed to delete logo. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Company Logo
      </label>
      
      <div className="flex items-start space-x-4">
        {/* Logo Preview */}
        <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
          {currentLogoUrl ? (
            <img
              src={currentLogoUrl}
              alt="Company Logo"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-gray-400 text-center">
              <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">No Logo</span>
            </div>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
          
          <div className="space-y-2">
            <BrandedButton
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload Logo'}
            </BrandedButton>
            
            {currentLogoUrl && (
              <BrandedButton
                variant="ghost"
                onClick={handleDeleteLogo}
                disabled={disabled || deleting}
                className="text-red-600 hover:text-red-700"
              >
                {deleting ? 'Deleting...' : 'Delete Logo'}
              </BrandedButton>
            )}
          </div>
          
          <p className="text-xs text-gray-500 mt-2">
            Recommended: 200x200px or larger, max 2MB
            <br />
            Supported formats: PNG, JPG, GIF, SVG
          </p>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        {icon && (
          <div className={`flex-shrink-0 mr-3 w-8 h-8 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
            {icon}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

export const AdminTenantSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [accentColor, setAccentColor] = useState('#1E40AF');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  const { refreshBranding } = useBranding();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [settingsData, statsData] = await Promise.all([
        TenantAPI.getSettings(),
        TenantAPI.getStats(),
      ]);
      
      setSettings(settingsData);
      setStats(statsData);
      
      // Initialize form state
      setPrimaryColor(settingsData.primaryColor || '#3B82F6');
      setAccentColor(settingsData.accentColor || '#1E40AF');
      setLogoUrl(settingsData.logoUrl || null);
    } catch (err) {
      console.error('Failed to load tenant data:', err);
      setError('Failed to load tenant settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveBranding = async () => {
    try {
      setSaving(true);
      await TenantAPI.updateBranding({
        primaryColor,
        accentColor,
      });
      
      // Refresh branding context to apply changes immediately
      await refreshBranding();
      
      // Reload settings to get updated data
      await loadData();
      
      alert('Branding settings saved successfully!');
    } catch (err) {
      console.error('Failed to save branding:', err);
      alert('Failed to save branding settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (newLogoUrl: string | null) => {
    setLogoUrl(newLogoUrl);
    // Refresh branding context to apply logo changes immediately
    await refreshBranding();
    // Reload settings to get updated data
    await loadData();
  };

  const hasChanges = settings && (
    primaryColor !== (settings.primaryColor || '#3B82F6') ||
    accentColor !== (settings.accentColor || '#1E40AF')
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <BrandedButton onClick={loadData}>
          Try Again
        </BrandedButton>
      </div>
    );
  }

  if (!settings || !stats) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">No tenant data available</div>
      </div>
    );
  }

  const utilizationColor = stats.utilizationPercentage >= 90 ? 'red' : 
                          stats.utilizationPercentage >= 75 ? 'yellow' : 'green';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tenant Settings</h1>
        <p className="text-gray-600">Manage your organization's settings and branding</p>
      </div>

      {/* Organization Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Organization Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Basic Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Organization Name:</span>
                <span className="font-medium">{settings.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Subdomain:</span>
                <span className="font-medium">{settings.subdomain}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Subscription:</span>
                <span className="font-medium capitalize">{settings.subscriptionTier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Data Retention:</span>
                <span className="font-medium">{settings.dataRetentionDays} days</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Current Logo</h3>
            <div className="w-32 h-32 border border-gray-200 rounded-lg flex items-center justify-center bg-gray-50">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Current Logo"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-gray-400 text-center">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">No Logo</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats.userCount}
          subtitle={`of ${stats.userLimit} limit`}
          color="blue"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          }
        />
        
        <StatCard
          title="Active Users"
          value={stats.activeUsers}
          subtitle="Last 30 days"
          color="green"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        
        <StatCard
          title="Employee Profiles"
          value={stats.employeeCount}
          color="blue"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        
        <StatCard
          title="Utilization"
          value={`${stats.utilizationPercentage}%`}
          subtitle={`${stats.userCount}/${stats.userLimit} users`}
          color={utilizationColor}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      {/* Branding Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Branding Settings</h2>
        
        <div className="space-y-6">
          {/* Logo Upload */}
          <LogoUpload
            currentLogoUrl={logoUrl}
            onLogoChange={handleLogoChange}
            disabled={saving}
          />

          {/* Color Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ColorPicker
              label="Primary Color"
              value={primaryColor}
              onChange={setPrimaryColor}
              disabled={saving}
            />
            
            <ColorPicker
              label="Accent Color"
              value={accentColor}
              onChange={setAccentColor}
              disabled={saving}
            />
          </div>

          {/* Color Preview */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Preview</h3>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <div
                  className="w-8 h-8 rounded border"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-sm text-gray-600">Primary Color</span>
              </div>
              <div className="flex items-center space-x-2">
                <div
                  className="w-8 h-8 rounded border"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="text-sm text-gray-600">Accent Color</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <BrandedButton
              variant="primary"
              onClick={handleSaveBranding}
              disabled={!hasChanges || saving}
            >
              {saving ? 'Saving...' : 'Save Branding Settings'}
            </BrandedButton>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-medium text-gray-700 mb-2">Account Details</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span>{new Date(settings.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Updated:</span>
                <span>{new Date(settings.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-700 mb-2">Subscription Details</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Plan:</span>
                <span className="capitalize">{settings.subscriptionTier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">User Limit:</span>
                <span>{settings.userLimit}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};