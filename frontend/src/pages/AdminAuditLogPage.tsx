import React, { useState, useEffect } from 'react';
import { AuditLogAPI } from '../services/api';
import { AuditLogEntry, AuditLogFilters, AuditLogStatistics } from '../types/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BrandedButton } from '../components/BrandedButton';

interface AuditLogFiltersFormProps {
  filters: AuditLogFilters;
  onFiltersChange: (filters: AuditLogFilters) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
}

const AuditLogFiltersForm: React.FC<AuditLogFiltersFormProps> = ({
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
}) => {
  const handleChange = (key: keyof AuditLogFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
  };

  const handleDateChange = (key: 'startDate' | 'endDate', value: string) => {
    if (value) {
      const date = new Date(value);
      date.setHours(key === 'startDate' ? 0 : 23);
      date.setMinutes(key === 'startDate' ? 0 : 59);
      date.setSeconds(key === 'startDate' ? 0 : 59);
      onFiltersChange({
        ...filters,
        [key]: date.toISOString(),
      });
    } else {
      onFiltersChange({
        ...filters,
        [key]: undefined,
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            User Email
          </label>
          <input
            type="text"
            value={filters.userId || ''}
            onChange={(e) => handleChange('userId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entity Type
          </label>
          <select
            value={filters.entityType || ''}
            onChange={(e) => handleChange('entityType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="employee">Employee</option>
            <option value="user">User</option>
            <option value="custom_field">Custom Field</option>
            <option value="tenant">Tenant</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action
          </label>
          <select
            value={filters.action || ''}
            onChange={(e) => handleChange('action', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entity ID
          </label>
          <input
            type="text"
            value={filters.entityId || ''}
            onChange={(e) => handleChange('entityId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Entity ID"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Field Name
          </label>
          <input
            type="text"
            value={filters.fieldName || ''}
            onChange={(e) => handleChange('fieldName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Field name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={formatDateForInput(filters.startDate)}
            onChange={(e) => handleDateChange('startDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={formatDateForInput(filters.endDate)}
            onChange={(e) => handleDateChange('endDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-4">
        <BrandedButton
          variant="ghost"
          onClick={onClearFilters}
        >
          Clear Filters
        </BrandedButton>
        <BrandedButton
          variant="primary"
          onClick={onApplyFilters}
        >
          Apply Filters
        </BrandedButton>
      </div>
    </div>
  );
};

interface AuditLogTableProps {
  logs: AuditLogEntry[];
  loading: boolean;
}

const AuditLogTable: React.FC<AuditLogTableProps> = ({ logs, loading }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const truncateValue = (value: string | null | undefined, maxLength: number = 50) => {
    if (!value) return '-';
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-center items-center h-32">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">No audit logs found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Field
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Old Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                New Value
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(log.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.user?.email || 'System'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{log.entityType}</div>
                    <div className="text-gray-500 text-xs">{log.entityId}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.fieldName || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                  <div className="truncate" title={log.oldValue || ''}>
                    {truncateValue(log.oldValue)}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                  <div className="truncate" title={log.newValue || ''}>
                    {truncateValue(log.newValue)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface StatisticsCardProps {
  title: string;
  value: number;
  subtitle?: string;
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({ title, value, subtitle }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  </div>
);

export const AdminAuditLogPage: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [statistics, setStatistics] = useState<AuditLogStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [appliedFilters, setAppliedFilters] = useState<AuditLogFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [exporting, setExporting] = useState(false);

  const pageSize = 50;

  const loadAuditLogs = async (page: number = 1, newFilters?: AuditLogFilters) => {
    try {
      setLoading(true);
      setError(null);
      
      const filtersToUse = newFilters !== undefined ? newFilters : appliedFilters;
      const response = await AuditLogAPI.getAuditLogs(filtersToUse, page, pageSize);
      
      setAuditLogs(response.data.logs);
      setCurrentPage(response.data.pagination.page);
      setTotalPages(response.data.pagination.totalPages);
      setTotalLogs(response.data.pagination.total);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setError('Failed to load audit logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await AuditLogAPI.getAuditLogStatistics(30);
      setStatistics(response.data);
    } catch (err) {
      console.error('Failed to load audit statistics:', err);
    }
  };

  useEffect(() => {
    loadAuditLogs();
    loadStatistics();
  }, []);

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    setCurrentPage(1);
    loadAuditLogs(1, filters);
  };

  const handleClearFilters = () => {
    const emptyFilters: AuditLogFilters = {};
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setCurrentPage(1);
    loadAuditLogs(1, emptyFilters);
  };

  const handlePageChange = (page: number) => {
    loadAuditLogs(page);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await AuditLogAPI.exportAuditLogs(appliedFilters);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export audit logs:', err);
      alert('Failed to export audit logs. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const totalActions = statistics.reduce((sum, stat) => sum + stat.count, 0);
  const createActions = statistics.filter(s => s.action === 'CREATE').reduce((sum, stat) => sum + stat.count, 0);
  const updateActions = statistics.filter(s => s.action === 'UPDATE').reduce((sum, stat) => sum + stat.count, 0);
  const deleteActions = statistics.filter(s => s.action === 'DELETE').reduce((sum, stat) => sum + stat.count, 0);

  if (error && auditLogs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <BrandedButton onClick={() => loadAuditLogs()}>
          Try Again
        </BrandedButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600">Track all changes and activities in the system</p>
        </div>
        
        <BrandedButton
          variant="ghost"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Export to CSV'}
        </BrandedButton>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatisticsCard
          title="Total Actions"
          value={totalActions}
          subtitle="Last 30 days"
        />
        <StatisticsCard
          title="Creates"
          value={createActions}
          subtitle="New records"
        />
        <StatisticsCard
          title="Updates"
          value={updateActions}
          subtitle="Modified records"
        />
        <StatisticsCard
          title="Deletes"
          value={deleteActions}
          subtitle="Removed records"
        />
      </div>

      {/* Filters */}
      <AuditLogFiltersForm
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Results Summary */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {auditLogs.length} of {totalLogs} audit logs
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <BrandedButton
                variant="ghost"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="text-sm"
              >
                Previous
              </BrandedButton>
              
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              
              <BrandedButton
                variant="ghost"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="text-sm"
              >
                Next
              </BrandedButton>
            </div>
          )}
        </div>
      </div>

      {/* Audit Logs Table */}
      <AuditLogTable logs={auditLogs} loading={loading} />

      {/* Bottom Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <div className="flex items-center space-x-2">
            <BrandedButton
              variant="ghost"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1 || loading}
            >
              First
            </BrandedButton>
            <BrandedButton
              variant="ghost"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
            >
              Previous
            </BrandedButton>
            
            <span className="px-4 py-2 text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            
            <BrandedButton
              variant="ghost"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
            >
              Next
            </BrandedButton>
            <BrandedButton
              variant="ghost"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages || loading}
            >
              Last
            </BrandedButton>
          </div>
        </div>
      )}
    </div>
  );
};