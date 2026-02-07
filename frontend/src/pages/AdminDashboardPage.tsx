import React, { useState, useEffect } from 'react';
import { AnalyticsAPI, HealthAPI } from '../services/api';
import { AnalyticsDashboardData } from '../types/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BrandedButton } from '../components/BrandedButton';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center">
      {icon && <div className="flex-shrink-0 mr-3">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  </div>
);

interface ChartData {
  label: string;
  value: number;
}

interface SimpleBarChartProps {
  data: ChartData[];
  title: string;
  maxItems?: number;
}

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, title, maxItems = 10 }) => {
  const displayData = data.slice(0, maxItems);
  const maxValue = Math.max(...displayData.map(item => item.value));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {displayData.map((item, index) => (
          <div key={index} className="flex items-center">
            <div className="w-24 text-sm text-gray-600 truncate" title={item.label}>
              {item.label}
            </div>
            <div className="flex-1 mx-3">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                />
              </div>
            </div>
            <div className="w-12 text-sm font-medium text-gray-900 text-right">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface TopListProps {
  title: string;
  items: Array<{
    primary: string;
    secondary?: string;
    value: number;
  }>;
  maxItems?: number;
}

const TopList: React.FC<TopListProps> = ({ title, items, maxItems = 10 }) => {
  const displayItems = items.slice(0, maxItems);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {displayItems.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {item.primary}
              </p>
              {item.secondary && (
                <p className="text-sm text-gray-500 truncate">
                  {item.secondary}
                </p>
              )}
            </div>
            <div className="ml-3 flex-shrink-0">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface SystemHealthProps {
  healthData: any;
  onRefresh: () => void;
}

const SystemHealth: React.FC<SystemHealthProps> = ({ healthData, onRefresh }) => {
  if (!healthData) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">System Health</h3>
        <BrandedButton variant="ghost" onClick={onRefresh} className="text-sm">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </BrandedButton>
      </div>
      
      <div className="space-y-4">
        {/* Overall Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Overall Status</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(healthData.status)}`}>
            {healthData.status}
          </span>
        </div>

        {/* Uptime */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Uptime</span>
          <span className="text-sm text-gray-900">{formatUptime(healthData.uptime)}</span>
        </div>

        {/* Services */}
        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-600">Services</span>
          {Object.entries(healthData.services).map(([service, data]: [string, any]) => (
            <div key={service} className="flex items-center justify-between pl-4">
              <span className="text-sm text-gray-600 capitalize">{service}</span>
              <div className="flex items-center space-x-2">
                {data.responseTime && (
                  <span className="text-xs text-gray-500">{data.responseTime}ms</span>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(data.status)}`}>
                  {data.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface QuickActionsProps {
  onNavigate: (path: string) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onNavigate }) => {
  const actions = [
    {
      title: 'Manage Employees',
      description: 'Add, edit, or deactivate employee profiles',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      path: '/admin/employees',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: 'Custom Fields',
      description: 'Configure custom fields for employee profiles',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      path: '/admin/custom-fields',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: 'Audit Logs',
      description: 'View system activity and changes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      path: '/admin/audit-logs',
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      title: 'Tenant Settings',
      description: 'Configure branding and organization settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      path: '/admin/settings',
      color: 'bg-orange-500 hover:bg-orange-600'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => onNavigate(action.path)}
            className={`${action.color} text-white p-4 rounded-lg text-left transition-colors duration-200`}
          >
            <div className="flex items-center mb-2">
              {action.icon}
              <span className="ml-2 font-medium">{action.title}</span>
            </div>
            <p className="text-sm text-white/90">{action.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export const AdminDashboardPage: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<AnalyticsDashboardData | null>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(90);

  const loadDashboardData = async (days: number) => {
    try {
      setLoading(true);
      setError(null);
      const [analyticsResponse, healthResponse] = await Promise.all([
        AnalyticsAPI.getDashboardAnalytics(days),
        HealthAPI.getHealthStatus().catch(err => {
          console.warn('Health check failed:', err);
          return null;
        })
      ]);
      
      setDashboardData(analyticsResponse.data);
      setHealthData(healthResponse);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const refreshHealthData = async () => {
    try {
      const healthResponse = await HealthAPI.getHealthStatus();
      setHealthData(healthResponse);
    } catch (err) {
      console.warn('Health check failed:', err);
    }
  };

  useEffect(() => {
    loadDashboardData(selectedPeriod);
  }, [selectedPeriod]);

  const handlePeriodChange = (days: number) => {
    setSelectedPeriod(days);
  };

  const handleNavigate = (path: string) => {
    window.location.href = path;
  };

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
        <BrandedButton onClick={() => loadDashboardData(selectedPeriod)}>
          Try Again
        </BrandedButton>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">No dashboard data available</div>
      </div>
    );
  }

  const {
    userMetrics,
    profileMetrics,
    topSearchQueries,
    mostViewedProfiles,
    departmentDistribution,
    roleDistribution,
  } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Overview of directory usage and engagement</p>
        </div>
        
        {/* Period Selector */}
        <div className="flex space-x-2">
          {[30, 90, 180, 365].map((days) => (
            <BrandedButton
              key={days}
              variant={selectedPeriod === days ? 'primary' : 'ghost'}
              onClick={() => handlePeriodChange(days)}
              className="text-sm"
            >
              {days}d
            </BrandedButton>
          ))}
        </div>
      </div>

      {/* Quick Actions and System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickActions onNavigate={handleNavigate} />
        {healthData && (
          <SystemHealth healthData={healthData} onRefresh={refreshHealthData} />
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={userMetrics.totalUsers}
          icon={
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
          }
        />
        
        <MetricCard
          title="Active Users"
          value={userMetrics.activeUsers}
          subtitle={`Last ${userMetrics.activeUsersPeriod}`}
          icon={
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          }
        />
        
        <MetricCard
          title="Profile Completeness"
          value={`${profileMetrics.completenessPercentage}%`}
          subtitle={`${profileMetrics.completeProfiles} of ${profileMetrics.totalProfiles} complete`}
          icon={
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          }
        />
        
        <MetricCard
          title="Total Profiles"
          value={profileMetrics.totalProfiles}
          icon={
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          }
        />
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <SimpleBarChart
          title="Department Distribution"
          data={departmentDistribution.map(item => ({
            label: item.department,
            value: item.count,
          }))}
          maxItems={8}
        />

        {/* Role Distribution */}
        <SimpleBarChart
          title="Role Distribution"
          data={roleDistribution.map(item => ({
            label: item.title,
            value: item.count,
          }))}
          maxItems={8}
        />

        {/* Top Search Queries */}
        <TopList
          title="Top Search Queries"
          items={topSearchQueries.map(item => ({
            primary: item.query,
            value: item.count,
          }))}
          maxItems={10}
        />

        {/* Most Viewed Profiles */}
        <TopList
          title="Most Viewed Profiles"
          items={mostViewedProfiles.map(item => ({
            primary: `${item.employee.firstName} ${item.employee.lastName}`,
            secondary: `${item.employee.title} • ${item.employee.department}`,
            value: item.viewCount,
          }))}
          maxItems={10}
        />
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-6 border-t">
        Data shown for the last {selectedPeriod} days • Updated in real-time
      </div>
    </div>
  );
};