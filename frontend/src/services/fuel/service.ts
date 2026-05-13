import { apiClient } from '@/services/api/client';

export type FuelKpisApi = {
  totalTankCapacity: number;
  totalStoredVolume: number;
  globalFillPercent: number;
  volumeReceived: number;
  volumeDispensed: number;
  estimatedVehicleConsumption: number;
  unreconciledFuel: number;
  validTransactions: number;
  activeAlerts: number;
  averageAlarmResponseMinutes?: number | null;
  activeTanks: number;
  onlineDispensers: number;
  forecastNext7Days: number;
};

export type TankApi = {
  id: number;
  code: string;
  name: string;
  location: string;
  fuelType: string;
  storageType: string;
  capacity: number;
  currentVolume: number;
  targetRefillGallons?: number | null;
  temperature?: number | null;
  density?: number | null;
  status: string;
  sensorIdentifier?: string | null;
  assignedCompanyId: number;
  fillPercent: number;
  availableCapacity: number;
  lastUpdate?: string | null;
  createdAt: string;
};

export type TankCreatePayload = {
  code: string;
  name: string;
  location: string;
  fuelType?: string;
  storageType?: string;
  capacity: number;
  currentVolume: number;
  targetRefillGallons?: number | null;
  temperature?: number | null;
  density?: number | null;
  status?: string;
  sensorIdentifier?: string | null;
  assignedCompanyId: number;
};

export type TankUpdatePayload = Partial<TankCreatePayload>;

export type DispenserApi = {
  id: number;
  code: string;
  name: string;
  location: string;
  tankId: number;
  tankCode?: string | null;
  totalizer: number;
  targetRefillGallons?: number | null;
  supportedIdentificationMethods: string;
  fallbackIdentificationMethod: string;
  productConfigurations?: Array<Record<string, unknown>> | null;
  hoseCount: number;
  status: string;
  deviceIdentifier?: string | null;
  assignedCompanyId: number;
  lastTransactionAt?: string | null;
  createdAt: string;
};

export type DispenserCreatePayload = {
  code: string;
  name: string;
  location: string;
  tankId: number;
  totalizer?: number;
  targetRefillGallons?: number | null;
  supportedIdentificationMethods?: string;
  fallbackIdentificationMethod?: string;
  productConfigurations?: Array<Record<string, unknown>> | null;
  hoseCount?: number;
  status?: string;
  deviceIdentifier?: string | null;
  assignedCompanyId: number;
};

export type DispenserUpdatePayload = Partial<DispenserCreatePayload>;

export type AlertThresholdApi = {
  id: number;
  scope: string;
  entityId?: number | null;
  assignedCompanyId?: number | null;
  metric: string;
  minValue?: number | null;
  maxValue?: number | null;
  variationLimit?: number | null;
  notificationEmail?: string | null;
  notificationChannels?: string;
  smsNumber?: string | null;
  webhookUrl?: string | null;
  enabled: boolean;
  createdAt: string;
};

export type AlertEventApi = {
  id: number;
  vehicleId?: number | null;
  entityType: string;
  entityId?: number | null;
  assignedCompanyId?: number | null;
  sensorIdentifier?: string | null;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  metadata?: Record<string, unknown> | null;
  recordedAt: string;
  createdAt: string;
  resolvedAt?: string | null;
};

export type AlertThresholdPayload = {
  scope: string;
  entityId?: number | null;
  assignedCompanyId?: number | null;
  metric: string;
  minValue?: number | null;
  maxValue?: number | null;
  variationLimit?: number | null;
  notificationEmail?: string | null;
  notificationChannels?: string;
  smsNumber?: string | null;
  webhookUrl?: string | null;
  enabled?: boolean;
};

export type DriverApi = {
  id: number;
  fullName: string;
  documentId: string;
  licenseNumber?: string | null;
  phone?: string | null;
  status: string;
  assignedCompanyId: number;
  createdAt: string;
};

export type DriverCreatePayload = {
  fullName: string;
  documentId: string;
  licenseNumber?: string | null;
  phone?: string | null;
  status?: string;
  assignedCompanyId: number;
};

export type DriverUpdatePayload = Partial<DriverCreatePayload>;

export type RefuelingTransactionApi = {
  id: number;
  transactionCode: string;
  vehicleId: number;
  vehiclePlate?: string | null;
  driverId?: number | null;
  driverName?: string | null;
  dispenserId: number;
  dispenserCode?: string | null;
  tankId: number;
  tankCode?: string | null;
  policyId?: number | null;
  operatorName?: string | null;
  authorizationNumber?: string | null;
  productType: string;
  hoseNumber: number;
  flowMeterStart?: number | null;
  flowMeterEnd?: number | null;
  flowMeterAccuracyPercent?: number | null;
  identificationStatus: string;
  requestedVolume?: number | null;
  authorizedVolume?: number | null;
  dispensedVolume: number;
  odometer?: number | null;
  identificationMethod: string;
  identificationValue?: string | null;
  preAuthorized: boolean;
  cutReason?: string | null;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
};

export type FuelTransactionFilters = {
  limit?: number;
  start?: string;
  end?: string;
  vehicleId?: number;
  dispenserId?: number;
  tankId?: number;
};

export type FuelSimulationPayload = {
  deviceType: 'vehicle' | 'tank' | 'dispenser';
  deviceId: number;
  operation: 'fill' | 'drain';
  gallons: number;
};

export type FuelSimulationResultApi = {
  deviceType: 'vehicle' | 'tank' | 'dispenser';
  deviceId: number;
  operation: 'fill' | 'drain';
  requestedGallons: number;
  configuredLimitGallons?: number | null;
  appliedGallons: number;
  cutGallons: number;
  beforeGallons: number;
  afterGallons: number;
  capacityGallons?: number | null;
  status: string;
  messages: string[];
  alertIds: number[];
};

export type FuelDashboardApi = {
  kpis: FuelKpisApi;
  tanks: TankApi[];
  dispensers: DispenserApi[];
  recentTransactions: RefuelingTransactionApi[];
};

export type ReportFilters = {
  start?: string;
  end?: string;
  period?: 'day' | 'week' | 'month';
};

export type FuelHistoryReportApi = {
  generatedAt: string;
  filters: ReportFilters;
  summary: {
    vehicles: number;
    tanks: number;
    transactions: number;
    totalStoredFuel: number;
    totalCapacity: number;
    storagePercent: number;
    totalDispensed: number;
    openAlerts: number;
  };
  tanks: Array<Pick<TankApi, 'id' | 'code' | 'name' | 'fuelType' | 'currentVolume' | 'capacity' | 'temperature' | 'density' | 'status' | 'lastUpdate'>>;
  transactions: Array<Pick<RefuelingTransactionApi, 'id' | 'transactionCode' | 'vehicleId' | 'driverId' | 'dispenserId' | 'tankId' | 'dispensedVolume' | 'status' | 'startedAt' | 'completedAt'>>;
  alerts: Array<{
    id: number;
    entityType: string;
    entityId?: number | null;
    alertType: string;
    severity: string;
    title: string;
    status: string;
    recordedAt: string;
  }>;
};

export type AdvancedKpisApi = {
  generatedAt: string;
  filters: ReportFilters;
  kpis: {
    consumptionPerKm: number;
    totalDistanceKm: number;
    totalActualFuelUsed: number;
    totalExpectedFuelUsed: number;
    totalDispensed: number;
    unreconciledFuelPercent: number;
    alarmResponseAvgMinutes: number;
    validTransactionsPercent: number;
    abruptVariations: number;
    forecastNext7Days: number;
  };
  efficiencyByUnit: Array<{
    vehicleId: number;
    plate: string;
    distanceKm: number;
    actualFuelUsed: number;
    expectedFuelUsed: number;
    consumptionPerKm: number;
  }>;
  volumeDispensedByTank: Array<{
    tankId: number;
    dispensedVolume: number;
    transactions: number;
  }>;
};

export type OperationalTraceabilityReportApi = {
  reportType: string;
  start: string;
  end: string;
  summary: {
    events: number;
    receipts: number;
    transactions: number;
    consumptionTelemetry: number;
  };
  flowExample: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
};

export type NotificationLogApi = {
  id: number;
  alertId?: number | null;
  channel: string;
  recipient?: string | null;
  status: string;
  provider: string;
  response?: string | null;
  sentAt: string;
  receivedAt?: string | null;
};

export type CustomRoleApi = {
  id: number;
  name: string;
  description?: string | null;
  assignedCompanyId?: number | null;
  permissions: string[];
  status: string;
  createdAt: string;
};

export type SecurityEvidenceApi = {
  generatedAt: string;
  transport: Record<string, unknown>;
  authentication: Record<string, unknown>;
  dataAtRest: Record<string, unknown>;
};

export type ConsumptionForecastApi = {
  generatedAt: string;
  method: string;
  assumptions: Record<string, unknown>;
  dailyAverage: number;
  monthlyForecast: number;
  confidenceInterval: {
    low: number;
    high: number;
  };
  sampleDays: number;
};

export type WebhookEndpointApi = {
  id: number;
  name: string;
  url: string;
  eventTypes: string;
  retryCount: number;
  secret?: string | null;
  status: string;
  createdAt: string;
};

export const getFuelDashboardService = async () => {
  const response = await apiClient.get<FuelDashboardApi>('/fuel/dashboard');
  return response.data;
};

export const getTanksService = async () => {
  const response = await apiClient.get<TankApi[]>('/fuel/tanks');
  return response.data;
};

export const createTankService = async (payload: TankCreatePayload) => {
  const response = await apiClient.post<TankApi>('/fuel/tanks', payload);
  return response.data;
};

export const updateTankService = async (tankId: number, payload: TankUpdatePayload) => {
  const response = await apiClient.patch<TankApi>(`/fuel/tanks/${tankId}`, payload);
  return response.data;
};

export const updateTankTargetRefillGallonsService = async (
  tankId: number,
  targetRefillGallons: number | null,
) => {
  const response = await apiClient.patch<TankApi>(`/fuel/tanks/${tankId}/target-refill-gallons`, {
    targetRefillGallons,
  });
  return response.data;
};

export const deleteTankService = async (tankId: number) => {
  const response = await apiClient.delete<{ message: string }>(`/fuel/tanks/${tankId}`);
  return response.data;
};

export const getDispensersService = async () => {
  const response = await apiClient.get<DispenserApi[]>('/fuel/dispensers');
  return response.data;
};

export const getDriversService = async () => {
  const response = await apiClient.get<DriverApi[]>('/fuel/drivers');
  return response.data;
};

export const createDriverService = async (payload: DriverCreatePayload) => {
  const response = await apiClient.post<DriverApi>('/fuel/drivers', payload);
  return response.data;
};

export const updateDriverService = async (driverId: number, payload: DriverUpdatePayload) => {
  const response = await apiClient.patch<DriverApi>(`/fuel/drivers/${driverId}`, payload);
  return response.data;
};

export const deleteDriverService = async (driverId: number) => {
  const response = await apiClient.delete<{ message: string }>(`/fuel/drivers/${driverId}`);
  return response.data;
};

export const createDispenserService = async (payload: DispenserCreatePayload) => {
  const response = await apiClient.post<DispenserApi>('/fuel/dispensers', payload);
  return response.data;
};

export const updateDispenserService = async (dispenserId: number, payload: DispenserUpdatePayload) => {
  const response = await apiClient.patch<DispenserApi>(`/fuel/dispensers/${dispenserId}`, payload);
  return response.data;
};

export const updateDispenserTargetRefillGallonsService = async (
  dispenserId: number,
  targetRefillGallons: number | null,
) => {
  const response = await apiClient.patch<DispenserApi>(
    `/fuel/dispensers/${dispenserId}/target-refill-gallons`,
    { targetRefillGallons },
  );
  return response.data;
};

export const deleteDispenserService = async (dispenserId: number) => {
  const response = await apiClient.delete<{ message: string }>(`/fuel/dispensers/${dispenserId}`);
  return response.data;
};

export const getFuelTransactionsService = async (filters: FuelTransactionFilters | number = 100) => {
  const params = typeof filters === 'number' ? { limit: filters } : filters;
  const response = await apiClient.get<RefuelingTransactionApi[]>('/fuel/transactions', {
    params,
  });
  return response.data;
};

export const simulateFuelDeviceService = async (payload: FuelSimulationPayload) => {
  const response = await apiClient.post<FuelSimulationResultApi>('/fuel/simulation', payload);
  return response.data;
};

export const getAlertThresholdsService = async () => {
  const response = await apiClient.get<AlertThresholdApi[]>('/fuel/thresholds');
  return response.data;
};

export const getAlertEventsService = async (limit = 100) => {
  const response = await apiClient.get<AlertEventApi[]>('/alerts/', {
    params: { limit },
  });
  return response.data;
};

export const closeAlertEventService = async (alertId: number) => {
  const response = await apiClient.patch<AlertEventApi>(`/alerts/${alertId}/close`);
  return response.data;
};

export const createAlertThresholdService = async (payload: AlertThresholdPayload) => {
  const response = await apiClient.post<AlertThresholdApi>('/fuel/thresholds', payload);
  return response.data;
};

export const updateAlertThresholdService = async (
  thresholdId: number,
  payload: Partial<AlertThresholdPayload>,
) => {
  const response = await apiClient.patch<AlertThresholdApi>(`/fuel/thresholds/${thresholdId}`, payload);
  return response.data;
};

export const getFuelHistoryReportService = async (filters: ReportFilters = {}) => {
  const response = await apiClient.get<FuelHistoryReportApi>('/reports/fuel/history', {
    params: filters,
  });
  return response.data;
};

export const getAdvancedKpisService = async (filters: ReportFilters = {}) => {
  const response = await apiClient.get<AdvancedKpisApi>('/reports/kpis/advanced', {
    params: filters,
  });
  return response.data;
};

export const getFuelOperationalReportService = async (
  reportType: string,
  filters: Pick<ReportFilters, 'start' | 'end'> = {},
) => {
  const response = await apiClient.get<OperationalTraceabilityReportApi>(`/fuel/reports/${reportType}`, {
    params: filters,
  });
  return response.data;
};

export const getNotificationLogsService = async (limit = 100) => {
  const response = await apiClient.get<NotificationLogApi[]>('/alerts/notifications', {
    params: { limit },
  });
  return response.data;
};

export const getAuditExportService = async (limit = 1000) => {
  const response = await apiClient.get<{ generatedAt: string; retentionPolicy: string; records: Array<Record<string, unknown>> }>('/fuel/audit/export', {
    params: { limit },
  });
  return response.data;
};

export const getCustomRolesService = async () => {
  const response = await apiClient.get<CustomRoleApi[]>('/fuel/rbac/roles');
  return response.data;
};

export const createCustomRoleService = async (payload: Omit<CustomRoleApi, 'id' | 'createdAt'>) => {
  const response = await apiClient.post<CustomRoleApi>('/fuel/rbac/roles', payload);
  return response.data;
};

export const getSecurityEvidenceService = async () => {
  const response = await apiClient.get<SecurityEvidenceApi>('/fuel/security/evidence');
  return response.data;
};

export const getConsumptionForecastService = async (months = 1, confidencePercent = 80) => {
  const response = await apiClient.get<ConsumptionForecastApi>('/reports/forecast/consumption', {
    params: { months, confidencePercent },
  });
  return response.data;
};

export const getIntegrationOpenApiEvidenceService = async () => {
  const response = await apiClient.get<Record<string, unknown>>('/fuel/integrations/openapi');
  return response.data;
};

export const getIntegrationEvidenceService = async () => {
  const response = await apiClient.get<Record<string, unknown>>('/fuel/integrations/evidence');
  return response.data;
};

export const getWebhooksService = async () => {
  const response = await apiClient.get<WebhookEndpointApi[]>('/fuel/integrations/webhooks');
  return response.data;
};

export const createWebhookService = async (payload: Omit<WebhookEndpointApi, 'id' | 'createdAt'>) => {
  const response = await apiClient.post<WebhookEndpointApi>('/fuel/integrations/webhooks', payload);
  return response.data;
};

export const testWebhookService = async (payload: { webhookId: number; eventType: string; payload?: Record<string, unknown> }) => {
  const response = await apiClient.post<Record<string, unknown>>('/fuel/integrations/webhooks/test', payload);
  return response.data;
};

export const getOperationsEvidenceService = async () => {
  const response = await apiClient.get<Record<string, unknown>>('/fuel/operations/evidence');
  return response.data;
};

export const getOperationsHealthService = async () => {
  const response = await apiClient.get<Record<string, unknown>>('/fuel/operations/health');
  return response.data;
};
