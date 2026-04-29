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
  capacity: number;
  currentVolume: number;
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
  capacity: number;
  currentVolume: number;
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
  enabled: boolean;
  createdAt: string;
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

export const deleteDispenserService = async (dispenserId: number) => {
  const response = await apiClient.delete<{ message: string }>(`/fuel/dispensers/${dispenserId}`);
  return response.data;
};

export const getFuelTransactionsService = async (limit = 100) => {
  const response = await apiClient.get<RefuelingTransactionApi[]>('/fuel/transactions', {
    params: { limit },
  });
  return response.data;
};

export const getAlertThresholdsService = async () => {
  const response = await apiClient.get<AlertThresholdApi[]>('/fuel/thresholds');
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
