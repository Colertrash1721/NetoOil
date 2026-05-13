'use client';

import { BusItem } from '@/types/buses';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import {
  AlertEventApi,
  getAlertEventsService,
} from '@/services/fuel/service';
import {
  getVehicleDetailService,
  getVehiclesService,
  VehicleDetailApi,
} from '@/services/vehicles/service';
import {
  createContext,
  ReactNode,
  startTransition,
  useContext,
  useEffect,
  useState,
} from 'react';

type BusContextType = {
  buses: BusItem[];
  busSelected: BusItem | null;
  setBusSelected: (value: BusItem | null) => void;
  loading: boolean;
  dataSource: 'database' | 'demo';
  loadDemoFleet: () => void;
  refreshFleet: (showLoading?: boolean) => Promise<void>;
};

const BusContext = createContext<BusContextType | undefined>(undefined);

function mapStatus(status?: string | null): BusItem['status'] {
  const value = (status || '').toLowerCase();
  if (value.includes('alert') || value.includes('alarm')) {
    return 'Alerta';
  }
  if (value.includes('terminal') || value.includes('idle') || value.includes('inactive')) {
    return 'En terminal';
  }
  return 'En ruta';
}

function isOpenAlert(alert: AlertEventApi) {
  const status = alert.status.toLowerCase();
  return !alert.resolvedAt && !['closed', 'resolved', 'dismissed'].includes(status);
}

function mapAlertSeverity(severity: string): BusItem['events'][number]['severity'] {
  const value = severity.toUpperCase();
  if (value === 'CRITICAL') return 'CRITICAL';
  if (value === 'HIGH') return 'HIGH';
  if (value === 'INFO') return 'INFO';
  return 'WARNING';
}

function mapAlertEvent(alert: AlertEventApi, detail: VehicleDetailApi): BusItem['events'][number] {
  const alertTime = alert.recordedAt || alert.createdAt;

  return {
    id: alert.id,
    type: alert.title || alert.alertType,
    severity: mapAlertSeverity(alert.severity),
    time: new Date(alertTime).toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    detail: alert.message,
    location: detail.assignedCompanyName ?? detail.plate,
  };
}

function busHasAlert(bus: BusItem) {
  return bus.status === 'Alerta' || bus.events.length > 0;
}

function sortFleetByAlert(left: BusItem, right: BusItem) {
  const leftHasAlert = busHasAlert(left);
  const rightHasAlert = busHasAlert(right);

  if (leftHasAlert !== rightHasAlert) {
    return leftHasAlert ? -1 : 1;
  }

  return left.name.localeCompare(right.name, 'es');
}

function createBackendSeries(detail: VehicleDetailApi) {
  if (detail.telemetryHistory.length > 0) {
    const chronological = [...detail.telemetryHistory].reverse();
    const points = chronological.map((item) => ({
      number: item.fuelLevel ?? 0,
      timestamp: item.recordedAt,
    }));

    return {
      DieselLevel: points,
      EstimatedLevel: points.map((item) => ({ ...item })),
    };
  }

  const fallbackPoint = {
    number: detail.lastFuelLevel ?? 0,
    timestamp: detail.lastUpdate ?? detail.creationDate,
  };

  return {
    DieselLevel: [fallbackPoint],
    EstimatedLevel: [{ ...fallbackPoint }],
  };
}

function mapBackendVehicle(detail: VehicleDetailApi, alerts: AlertEventApi[] = []): BusItem {
  const series = createBackendSeries(detail);
  const vehicleAlerts = alerts
    .filter((alert) => (
      alert.vehicleId === detail.id
      || (alert.entityType.toLowerCase() === 'vehicle' && alert.entityId === detail.id)
    ))
    .filter(isOpenAlert)
    .map((alert) => mapAlertEvent(alert, detail));
  const status = vehicleAlerts.length > 0 ? 'Alerta' : mapStatus(detail.status);

  return {
    id: detail.id,
    name: `${detail.brand} ${detail.model}`.trim() || `Unidad ${detail.plate}`,
    brand: detail.brand,
    model: detail.model,
    engine: `${detail.brand} ${detail.model}`.trim() || 'Sin motor registrado',
    plate: detail.plate,
    route: detail.assignedCompanyName ?? 'Sin ruta registrada',
    driver: 'Sin chofer registrado',
    status,
    rawStatus: detail.status,
    sensorIdentifier: detail.sensorIdentifier,
    tankCapacity: detail.tankCapacity,
    fuelConsumption: detail.fuelConsumption,
    targetRefillGallons: detail.targetRefillGallons,
    location: {
      lat: detail.lastLatitude ?? 18.4861,
      lng: detail.lastLongitude ?? -69.9312,
      label: detail.assignedCompanyName ?? 'Sin ubicacion registrada',
    },
    DieselLevel: series.DieselLevel,
    EstimatedLevel: series.EstimatedLevel,
    telemetry: {
      temperature: detail.lastTemperature ?? 0,
      inclination: detail.lastInclination ?? 0,
      volume: detail.lastVolume ?? 0,
      battery: detail.lastBatteryLevel ?? 0,
      pressure: detail.lastPressure ?? 0,
      humidity: detail.lastHumidity ?? 0,
      speed: detail.lastSpeed ?? 0,
      updatedAt: detail.lastUpdate ?? detail.creationDate,
    },
    events: vehicleAlerts,
  };
}

async function buildFleetFromDatabase() {
  const [vehicles, alerts] = await Promise.all([
    getVehiclesService(),
    getAlertEventsService(200).catch(() => []),
  ]);
  if (vehicles.length === 0) {
    return [];
  }

  const details = await Promise.all(
    vehicles.map((vehicle) => getVehicleDetailService(vehicle.id).catch(() => null)),
  );

  return details
    .filter((detail): detail is VehicleDetailApi => detail !== null)
    .map((detail) => mapBackendVehicle(detail, alerts))
    .sort(sortFleetByAlert);
}

function buildDemoFleet(): BusItem[] {
  const now = Date.now();
  const brands = ['Hyundai', 'Isuzu', 'Toyota', 'Mercedes-Benz', 'Mitsubishi'];
  const models = ['HD65', 'NPR', 'Coaster', 'Sprinter', 'Rosa'];
  const routes = ['Distrito Nacional', 'Santo Domingo Este', 'Santiago', 'San Cristobal', 'La Romana'];

  return Array.from({ length: 50 }, (_, index) => {
    const unit = index + 1;
    const baseFuel = 35 + (unit % 60);
    const status: BusItem['status'] = unit % 9 === 0 ? 'Alerta' : unit % 7 === 0 ? 'En terminal' : 'En ruta';
    const DieselLevel = Array.from({ length: 8 }, (__, pointIndex) => ({
      number: Math.max(8, baseFuel - (7 - pointIndex) * 1.8 + (unit % 4)),
      timestamp: new Date(now - (7 - pointIndex) * 45 * 60 * 1000).toISOString(),
    }));
    const events: BusItem['events'] = status === 'Alerta'
      ? [
          {
            id: unit,
            type: 'Variacion brusca de combustible',
            severity: 'WARNING',
            time: 'Hace pocos minutos',
            detail: 'Lectura demo generada para validar el panel de monitoreo.',
            location: routes[unit % routes.length],
          },
        ]
      : [];

    return {
      id: 10000 + unit,
      name: `${brands[unit % brands.length]} ${models[unit % models.length]}`,
      brand: brands[unit % brands.length],
      model: models[unit % models.length],
      engine: `Diesel ${2.4 + (unit % 5) * 0.3}L`,
      plate: `NF-${unit.toString().padStart(3, '0')}`,
      route: routes[unit % routes.length],
      driver: `Chofer Demo ${unit.toString().padStart(2, '0')}`,
      status,
      rawStatus: status,
      sensorIdentifier: `demo-sensor-${unit.toString().padStart(3, '0')}`,
      tankCapacity: `${90 + (unit % 6) * 15}`,
      fuelConsumption: `${8 + (unit % 5) * 0.4}`,
      targetRefillGallons: 18 + (unit % 12),
      location: {
        lat: 18.4861 + (unit % 12) * 0.012,
        lng: -69.9312 - (unit % 12) * 0.011,
        label: routes[unit % routes.length],
      },
      DieselLevel,
      EstimatedLevel: DieselLevel.map((point, pointIndex) => ({
        number: Math.min(100, point.number + ((unit + pointIndex) % 5) - 2),
        timestamp: point.timestamp,
      })),
      telemetry: {
        temperature: 29 + (unit % 8),
        inclination: (unit % 6) * 0.6,
        volume: 42 + (unit % 44),
        battery: 64 + (unit % 35),
        pressure: 27 + (unit % 8),
        humidity: 42 + (unit % 24),
        speed: status === 'En terminal' ? 0 : 22 + (unit % 62),
        updatedAt: new Date(now - unit * 3 * 60 * 1000).toISOString(),
      },
      events,
    };
  }).sort(sortFleetByAlert);
}

export const useBusContext = () => {
  const context = useContext(BusContext);
  if (context === undefined) {
    throw new Error('useBusContext must be used within a BusProvider');
  }
  return context;
};

export const BusProvider = ({ children }: { children: ReactNode }) => {
  const [buses, setBuses] = useState<BusItem[]>([]);
  const [busSelected, setBusSelected] = useState<BusItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<'database' | 'demo'>('database');

  const refreshFleet = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const databaseFleet = await buildFleetFromDatabase();

      if (databaseFleet.length === 0) {
        setBuses([]);
        setBusSelected(null);
        return;
      }

      setBuses(databaseFleet);
      setDataSource('database');
      setBusSelected((current) => {
        if (!current) {
          return databaseFleet[0] ?? null;
        }
        return databaseFleet.find((bus) => bus.plate === current.plate) ?? databaseFleet[0] ?? null;
      });
    } catch {
      setBuses([]);
      setBusSelected(null);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const loadDemoFleet = () => {
    const demoFleet = buildDemoFleet();
    setDataSource('demo');
    setBuses(demoFleet);
    setBusSelected(demoFleet[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void refreshFleet();
  }, []);

  useRealtimeRefresh(['fuel.simulation.updated', 'vehicle.telemetry.updated', 'alert.created', 'alert.resolved'], () => {
    void refreshFleet(false);
  });

  const handleSetBusSelected = (value: BusItem | null) => {
    startTransition(() => {
      setBusSelected(value);
    });
  };

  return (
    <BusContext.Provider
      value={{
        buses,
        busSelected,
        setBusSelected: handleSetBusSelected,
        loading,
        dataSource,
        loadDemoFleet,
        refreshFleet,
      }}
    >
      {children}
    </BusContext.Provider>
  );
};
