# Report Module

- **Owner**: Analytics Team
- **Dependencies**: Auth Module, Payment Module, Membership Module, Check-in Module, Product Module
- **Related Documents**: None

## Purpose

Provide administrative analytics and exportable reports covering revenue, membership metrics, check-in statistics, trainer performance, and product sales. All endpoints are admin-only and support CSV/Excel export.

## Models

- **ReportDefinition**: Saved report configurations. Stores query parameters (date range, filters, grouping), output format preference, schedule (for future automated delivery), and owning admin.
- **ReportAuditLog**: Audit trail of report generation. Logs who generated which report, when, the parameters used, and the output file reference. Used for compliance and usage tracking.

## Services

- **reportService**: Core reporting engine. Accepts report type and parameters, delegates to the appropriate data source (via analyticsService), aggregates results, formats output (CSV/Excel/JSON), and returns the generated report. Supports both synchronous generation and background generation for large datasets.
- **analyticsService**: Data aggregation layer. Provides pre-built queries for revenue summaries, membership counts, check-in trends, trainer session counts, and product sales. Optimized with materialized views and caching for common date ranges.

## Key Flows

1. **Generate Report**: Admin selects report type + parameters → reportService validates → analyticsService fetches aggregated data → results formatted → download link returned → audit log written.
2. **Export**: Supported formats: CSV (streaming for large datasets) and Excel (XLSX with basic formatting). Content-Type and Content-Disposition headers set appropriately.

### Available Reports

- **Revenue Report**: Total revenue, revenue by payment method, revenue by period (daily/weekly/monthly), revenue by product category. Supports date range filtering.
- **Membership Report**: Active members, new sign-ups, cancellations, renewal rate, membership type distribution. Supports date range and membership type filtering.
- **Check-in Statistics**: Total check-ins, average daily check-ins, peak hours, member vs. walk-in breakdown. Supports date range and location filtering.
- **Trainer Performance**: Sessions conducted, total hours, revenue generated, client retention, average rating. Supports date range and individual trainer filtering.
- **Product Sales**: Units sold, revenue, top-selling products, inventory movement, low-stock alerts. Supports date range and category filtering.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /reports/revenue | Admin | Revenue report (query params: startDate, endDate, groupBy, format) |
| GET | /reports/memberships | Admin | Membership report (query params: startDate, endDate, membershipType, format) |
| GET | /reports/checkins | Admin | Check-in statistics report (query params: startDate, endDate, groupBy, format) |
| GET | /reports/trainers | Admin | Trainer performance report (query params: startDate, endDate, trainerId, format) |
| GET | /reports/products | Admin | Product sales report (query params: startDate, endDate, categoryId, format) |
| GET | /reports/definitions | Admin | List saved report definitions |
| POST | /reports/definitions | Admin | Save a report definition |
| DELETE | /reports/definitions/:id | Admin | Delete a saved report definition |
| GET | /reports/audit | Admin | View report generation audit log |

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| RPT_001 | Invalid date range | Start date after end date or range too large |
| RPT_002 | No data | Query returned no results |
| RPT_003 | Export format unsupported | Requested format is not supported |
| RPT_004 | Report too large | Result set exceeds maximum export size |
| RPT_005 | Invalid report type | Specified report type does not exist |

## Future

- Scheduled report delivery via email (daily/weekly/monthly)
- Custom report builder (drag-and-drop field selection)
- Dashboard with real-time chart widgets
- PDF export with branded templates
- Data drill-down (click from summary to detail)
