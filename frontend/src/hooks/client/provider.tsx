'use client';

import { BusItem } from '@/types/buses';
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
  refreshFleet: () => Promise<void>;
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

function mapBackendVehicle(detail: VehicleDetailApi): BusItem {
  const series = createBackendSeries(detail);

  return {
    id: detail.id,
    name: `${detail.brand} ${detail.model}`.trim() || `Unidad ${detail.plate}`,
    engine: `${detail.brand} ${detail.model}`.trim() || 'Sin motor registrado',
    plate: detail.plate,
    route: detail.assignedCompanyName ?? 'Sin ruta registrada',
    driver: 'Sin chofer registrado',
    status: mapStatus(detail.status),
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
    events: [],
  };
}

async function buildFleetFromDatabase() {
  const vehicles = await getVehiclesService();
  if (vehicles.length === 0) {
    return [];
  }

  const details = await Promise.all(
    vehicles.map((vehicle) => getVehicleDetailService(vehicle.id).catch(() => null)),
  );

  return details
    .filter((detail): detail is VehicleDetailApi => detail !== null)
    .map((detail) => mapBackendVehicle(detail));
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

  const refreshFleet = async () => {
    setLoading(true);

    try {
      const databaseFleet = await buildFleetFromDatabase();

      if (databaseFleet.length === 0) {
        setBuses([]);
        setBusSelected(null);
        return;
      }

      setBuses(databaseFleet);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshFleet();
  }, []);

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
        refreshFleet,
      }}
    >
      {children}
    </BusContext.Provider>
  );
};
