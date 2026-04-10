import { apiClient } from '@/services/api/client';

export type VehicleTelemetryApi = {
  id: number;
  vehicleId: number;
  temperature?: number | null;
  inclination?: number | null;
  volume?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  speed?: number | null;
  fuelLevel?: number | null;
  pressure?: number | null;
  humidity?: number | null;
  batteryLevel?: number | null;
  alarm?: boolean;
  recordedAt: string;
};

export type VehicleApi = {
  id: number;
  plate: string;
  brand: string;
  model: string;
  year?: number | null;
  version?: string | null;
  vin?: string | null;
  color?: string | null;
  seatCount?: number | null;
  engineType?: string | null;
  engineDisplacement?: string | null;
  engineCylinderCount?: number | null;
  maxPower?: string | null;
  maxTorque?: string | null;
  fuelConsumption?: string | null;
  tankCapacity?: string | null;
  transmission?: string | null;
  sensorIdentifier?: string | null;
  status?: string | null;
  assignedCompanyId: number;
  creationDate: string;
  lastTemperature?: number | null;
  lastInclination?: number | null;
  lastVolume?: number | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastSpeed?: number | null;
  lastFuelLevel?: number | null;
  lastPressure?: number | null;
  lastHumidity?: number | null;
  lastBatteryLevel?: number | null;
  lastAlarm?: boolean;
  lastUpdate?: string | null;
};

export type VehicleDetailApi = VehicleApi & {
  assignedCompanyName?: string | null;
  telemetryHistory: VehicleTelemetryApi[];
};

export type VehicleCreatePayload = {
  plate: string;
  brand: string;
  model: string;
  year?: number | null;
  version?: string | null;
  vin?: string | null;
  color?: string | null;
  seatCount?: number | null;
  engineType?: string | null;
  engineDisplacement?: string | null;
  engineCylinderCount?: number | null;
  maxPower?: string | null;
  maxTorque?: string | null;
  fuelConsumption?: string | null;
  tankCapacity?: string | null;
  transmission?: string | null;
  sensorIdentifier?: string | null;
  status?: string;
  assignedCompanyId: number;
};

export type VehicleUpdatePayload = Partial<VehicleCreatePayload> & {
  sensorIdentifier?: string | null;
  status?: string | null;
};

export const getVehiclesService = async () => {
  const response = await apiClient.get<VehicleApi[]>('/vehicles/');
  return response.data;
};

export const getVehicleDetailService = async (vehicleId: number) => {
  const response = await apiClient.get<VehicleDetailApi>(`/vehicles/${vehicleId}`);
  return response.data;
};

export const getVehicleTelemetryHistoryService = async (vehicleId: number, limit = 100) => {
  const response = await apiClient.get<VehicleTelemetryApi[]>(`/vehicles/${vehicleId}/telemetry`, {
    params: { limit },
  });
  return response.data;
};

export const createVehicleService = async (payload: VehicleCreatePayload) => {
  const response = await apiClient.post<VehicleApi>('/vehicles/', payload);
  return response.data;
};

export const updateVehicleService = async (vehicleId: number, payload: VehicleUpdatePayload) => {
  const response = await apiClient.patch<VehicleApi>(`/vehicles/${vehicleId}`, payload);
  return response.data;
};
