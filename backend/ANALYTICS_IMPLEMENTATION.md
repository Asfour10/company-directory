# Analytics Event Tracking Implementation

## Overview

This document describes the implementation of analytics event tracking for the Company Directory application, fulfilling **Requirement 16.1**: Track search queries, profile views, profile updates.

## Implementation Summary

### 1. Analytics Service (`src/services/analytics.service.ts`)

Created a comprehensive analytics service that provides:

#### Core Tracking Methods
- `trackSearchQuery()` - Tracks search queries with metadata (query, result count, execution time, filters, clicked results)
- `trackProfileView()` - Tracks profile views with source attribution (direct, search, org_chart)
- `trackProfileUpdate()` - Tracks profile updates with field-level change tracking
- `trackProfileCreate()` - Tracks profile creation events
- `trackProfileDelete()` - Tracks profile deletion/deactivation events
- `trackLogin()` - Tracks user login events
- `trackLogout()` - Tracks user logout events
- `trackOrgChartView()` - Tracks organizational chart view events

#### Analytics Reporting Methods
- `getAnalyticsSummary()` - Provides overall analytics summary with key metrics
- `getSearchAnalytics()` - Detailed search analytics with performance metrics
- `getProfileAnalytics()` - Profile interaction analytics with most viewed profiles
- `getUserActivityAnalytics()` - User activity and engagement metrics
- `cleanupOldEvents()` - Cleanup utility for data retention compliance

### 2. Analytics Routes (`src/routes/analytics.routes.ts`)

Created RESTful API endpoints for analytics data access:

- `GET /api/analytics/summary` - Overall analytics summary
- `GET /api/analytics/search` - Search-specific analytics
- `GET /api/analytics/profiles` - Profile interaction analytics
- `GET /api/analytics/users` - User activity analytics
- `GET /api/analytics/dashboard` - Formatted dashboard data
- `POST /api/analytics/cleanup` - Cleanup old events (super admin only)

All endpoints require admin-level access and support configurable time periods.

### 3. Integration with Existing Services

#### Employee Routes Integration
- **Profile Views**: Tracks when users view employee profiles with source attribution
- **Profile Updates**: Tracks profile modifications with field-level change tracking
- **Profile Creation**: Tracks new employee profile creation
- **Profile Deletion**: Tracks employee deactivation/deletion

#### Search Routes Integration
- **Search Queries**: Tracks all search operations with performance metrics
- **Search Results**: Tracks result counts and execution times
- **Click Tracking**: Supports tracking which search results users click

### 4. Database Schema

Utilizes the existing `analytics_events` table with the following structure:
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID,
  event_type VARCHAR(50) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5. Event Types Tracked

- `search_query` - Search operations with query, results, and performance data
- `profile_view` - Profile viewing with source attribution
- `profile_update` - Profile modifications with field changes
- `profile_create` - New profile creation
- `profile_delete` - Profile deactivation/deletion
- `login` - User authentication events
- `logout` - User session termination
- `org_chart_view` - Organizational chart interactions

### 6. Metadata Structure

Each event type includes relevant metadata:

#### Search Query Events
```json
{
  "query": "search term",
  "resultCount": 5,
  "executionTime": 120,
  "filters": {"department": "Engineering"},
  "clickedResult": "employee-id",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Profile View Events
```json
{
  "profileId": "employee-id",
  "source": "search|direct|org_chart",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Profile Update Events
```json
{
  "profileId": "employee-id",
  "fieldsChanged": ["firstName", "title", "department"],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 7. Testing

#### Unit Tests (`src/services/__tests__/analytics.service.test.ts`)
- Comprehensive unit tests for all tracking methods
- Tests for analytics aggregation and reporting
- Error handling and edge case coverage
- Mock-based testing for database interactions

#### Property-Based Tests (`src/services/__tests__/analytics.service.property.test.ts`)
- Property-based testing using fast-check
- Validates data integrity across various input combinations
- Tests timestamp generation and JSON serialization
- Ensures event type validity and metadata structure

#### Integration Tests (`src/routes/__tests__/analytics.routes.integration.test.ts`)
- End-to-end testing of analytics API endpoints
- Authentication and authorization testing
- Error handling and response format validation
- Dashboard data aggregation testing

### 8. Performance Considerations

- **Asynchronous Tracking**: All analytics tracking is non-blocking
- **Error Isolation**: Analytics failures don't impact business operations
- **Efficient Queries**: Optimized SQL queries for analytics aggregation
- **Data Retention**: Configurable cleanup for old analytics events
- **Indexing**: Proper database indexes for analytics queries

### 9. Security and Privacy

- **Tenant Isolation**: All analytics data is tenant-scoped
- **Role-Based Access**: Analytics endpoints require admin privileges
- **Data Retention**: Configurable retention policies for compliance
- **Anonymization**: Support for data anonymization in cleanup processes

### 10. Usage Examples

#### Tracking a Search Query
```typescript
await AnalyticsService.trackSearchQuery(tenantId, userId, {
  query: 'john doe',
  resultCount: 3,
  executionTime: 95,
  filters: { department: 'Engineering' }
});
```

#### Tracking a Profile View
```typescript
await AnalyticsService.trackProfileView(tenantId, userId, {
  profileId: 'employee-123',
  action: 'view',
  source: 'search'
});
```

#### Getting Analytics Summary
```typescript
const summary = await AnalyticsService.getAnalyticsSummary(tenantId, 30);
// Returns: searches, views, updates, top queries, most viewed profiles
```

## Requirements Fulfillment

✅ **Requirement 16.1**: Track search queries, profile views, profile updates
- ✅ Search query tracking with full metadata
- ✅ Profile view tracking with source attribution  
- ✅ Profile update tracking with field-level changes
- ✅ Storage in analytics_events table
- ✅ Comprehensive reporting and aggregation
- ✅ Admin-accessible analytics endpoints
- ✅ Data retention and cleanup capabilities

## Files Created/Modified

### New Files
- `backend/src/services/analytics.service.ts` - Core analytics service
- `backend/src/routes/analytics.routes.ts` - Analytics API endpoints
- `backend/src/services/__tests__/analytics.service.test.ts` - Unit tests
- `backend/src/services/__tests__/analytics.service.property.test.ts` - Property-based tests
- `backend/src/routes/__tests__/analytics.routes.integration.test.ts` - Integration tests
- `backend/src/scripts/test-analytics-tracking.ts` - Test script
- `backend/ANALYTICS_IMPLEMENTATION.md` - This documentation

### Modified Files
- `backend/src/routes/employee.routes.ts` - Added analytics tracking to employee operations
- `backend/src/routes/search.routes.ts` - Added analytics tracking to search operations
- `backend/src/index.ts` - Registered analytics routes

## Next Steps

The analytics event tracking system is now fully implemented and ready for use. The next task in the implementation plan would be **15.2 Implement analytics aggregation service** which can build upon this foundation to provide more advanced reporting and dashboard features.