# System Settings Module

- **Owner**: Infrastructure Team
- **Dependencies**: Auth Module
- **Related Documents**: None

## Purpose

Centralized management of global system configuration: gym profile information, operating hours, contact details, feature flag toggles, and maintenance mode. Critical settings are restricted to Super Admin role.

## Models

- **SystemSetting**: Key-value store for global configuration. Fields include key (unique identifier), value (JSON-encoded), group (logical grouping like `general`, `hours`, `contact`), description, data type (string, number, boolean, JSON), and last modified timestamp. Supports validation rules per setting.
- **FeatureFlag**: Toggle for enabling/disabling features at runtime. Fields include name, key, enabled (boolean), description, rollout percentage (for gradual rollout), and dependencies on other features.
- **MaintenanceMode**: Controls site-wide maintenance state. Fields include enabled, message (displayed to users), allowed roles (roles that bypass maintenance), start/end time (for scheduled maintenance).

## Services

- **settingService**: Provides get/set operations for system settings. Implements caching with cache invalidation on write. Enforces type validation and read/write permissions. Supports bulk retrieval by group.
- **maintenanceService**: Manages maintenance mode lifecycle. On enable: blocks all non-admin traffic except allowed roles, displays maintenance page. On disable: restores normal operation. Automatically disables after scheduled end time.

### Permission Matrix

| Setting Type | Admin | Super Admin |
|-------------|-------|-------------|
| Gym name, address, contact | Read/Write | Read/Write |
| Operating hours | Read/Write | Read/Write |
| Feature flags | Read | Read/Write |
| Maintenance mode | Read | Read/Write |
| Security settings | Read | Read/Write |

## Key Flows

1. **Update Setting**: Admin updates setting → settingService validates type and permissions → updates database → invalidates cache → broadcasts change event for connected services to reload.
2. **Toggle Feature Flag**: Super Admin toggles feature → settingService updates flag → dependent features validated → event published → services dynamically enable/disable functionality.
3. **Enable Maintenance**: Super Admin enables maintenance → maintenanceService updates mode → all requests (except allowed roles) redirected to maintenance page → scheduled end timer started.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /settings | Admin | Get all settings (grouped) |
| GET | /settings/:group | Admin | Get settings by group |
| PUT | /settings | Admin | Update settings (batch) |
| GET | /settings/public | Public | Get public settings (gym name, hours, contact) |
| GET | /settings/maintenance | Admin | Get maintenance mode status |
| PUT | /settings/maintenance | Super Admin | Enable/disable maintenance mode |
| GET | /settings/features | Admin | List all feature flags |
| PUT | /settings/features/:key | Super Admin | Toggle a feature flag |
| POST | /settings/features | Super Admin | Create a new feature flag |
| DELETE | /settings/features/:key | Super Admin | Delete a feature flag |

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| SYS_001 | Setting not found | Setting key does not exist |
| SYS_002 | Invalid value type | Value does not match setting's data type |
| SYS_003 | Validation failed | Value failed custom validation rule |
| SYS_004 | Insufficient permissions | User role cannot modify this setting |
| SYS_005 | Feature dependency failed | Cannot disable feature X because feature Y depends on it |
| SYS_006 | Maintenance already active | Maintenance mode is already enabled |

## Future

- Environment-aware settings (development, staging, production overrides)
- Setting change audit log with diff history
- Scheduled setting changes (e.g., update operating hours for holidays)
- Bulk import/export of settings
- Health check endpoint that reports setting consistency
