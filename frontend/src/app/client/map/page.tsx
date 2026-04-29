'use client';

import { useBusContext } from '@/hooks/client/provider';
import { formatRelativeHour, getLatestDiesel } from '@/hooks/client/vehicleUi';
import { DispenserApi, getDispensersService, getTanksService, TankApi } from '@/services/fuel/service';
import { BusItem } from '@/types/buses';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';

type StrictMapContainerProps = {
  children: React.ReactNode;
  center: [number, number];
  zoom: number;
  scrollWheelZoom?: boolean;
  className?: string;
};

type StrictTileLayerProps = {
  attribution: string;
  url: string;
};

type StrictMarkerProps = {
  children?: React.ReactNode;
  position: [number, number];
  icon?: unknown;
};

const SafeMapContainer = MapContainer as unknown as (props: StrictMapContainerProps) => JSX.Element;
const SafeMarker = Marker as unknown as (props: StrictMarkerProps) => JSX.Element;
const SafeTileLayer = TileLayer as unknown as (props: StrictTileLayerProps) => JSX.Element;

type OperationalMarkerKind = 'vehicle' | 'tank' | 'dispenser';

type OperationalMarker = {
  id: string;
  kind: OperationalMarkerKind;
  title: string;
  subtitle: string;
  detail: string;
  position: [number, number];
};

const markerStyles: Record<OperationalMarkerKind, { label: string; icon: string; dotClassName: string; haloClassName: string }> = {
  vehicle: {
    label: 'Vehículo',
    icon: 'bx-car',
    dotClassName: 'bg-cyan-400 border-cyan-100 text-slate-950',
    haloClassName: 'bg-cyan-400/25',
  },
  tank: {
    label: 'Tanque',
    icon: 'bx-cylinder',
    dotClassName: 'bg-emerald-400 border-emerald-100 text-slate-950',
    haloClassName: 'bg-emerald-400/25',
  },
  dispenser: {
    label: 'Dispensador',
    icon: 'bx-gas-pump',
    dotClassName: 'bg-amber-300 border-amber-50 text-slate-950',
    haloClassName: 'bg-amber-300/25',
  },
};

function createMarkerIcon(kind: OperationalMarkerKind) {
  const style = markerStyles[kind];

  return L.divIcon({
    className: 'netofuel-marker',
    html: `
      <div class="relative flex h-6 w-6 items-center justify-center">
        <span class="absolute h-6 w-6 rounded-full ${style.haloClassName}"></span>
        <span class="relative flex h-4 w-4 items-center justify-center rounded-full ${style.dotClassName} border shadow-md shadow-slate-950/30">
          <i class="bx ${style.icon} text-[10px] leading-none"></i>
        </span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -10],
  });
}

function createClusterIcon(markers: OperationalMarker[]) {
  const vehicleCount = markers.filter((marker) => marker.kind === 'vehicle').length;
  const tankCount = markers.filter((marker) => marker.kind === 'tank').length;
  const dispenserCount = markers.filter((marker) => marker.kind === 'dispenser').length;
  const tone = markers.length >= 12
    ? {
        shell: 'border-red-200 bg-red-500/70 text-white',
        ring: 'bg-red-400/25',
        text: 'text-red-50',
      }
    : markers.length >= 6
      ? {
          shell: 'border-yellow-100 bg-yellow-400/70 text-slate-950',
          ring: 'bg-yellow-300/25',
          text: 'text-yellow-950',
        }
      : {
          shell: 'border-cyan-100 bg-cyan-400/70 text-slate-950',
          ring: 'bg-cyan-300/25',
          text: 'text-cyan-950',
        };

  return L.divIcon({
    className: 'netofuel-cluster',
    html: `
      <div class="relative flex h-9 w-9 items-center justify-center">
        <span class="absolute h-9 w-9 rounded-full ${tone.ring}"></span>
        <div class="relative flex h-8 w-8 items-center justify-center rounded-full border ${tone.shell} shadow-lg shadow-slate-950/25 backdrop-blur-sm">
          <div class="text-center leading-none">
          <div class="text-xs font-bold">${markers.length}</div>
          <div class="mt-0.5 flex items-center justify-center gap-px text-[8px] ${tone.text}">
            <span>${vehicleCount}</span><span>/</span><span>${tankCount}</span><span>/</span><span>${dispenserCount}</span>
          </div>
          </div>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -16],
  });
}

function getOperationalPosition(
  index: number,
  kind: 'tank' | 'dispenser',
  anchor: [number, number],
): [number, number] {
  const ring = kind === 'tank' ? 0.075 : 0.105;
  const angle = (index * 41 + (kind === 'tank' ? 10 : 25)) * (Math.PI / 180);
  const lat = anchor[0] + Math.sin(angle) * ring + (index % 3) * 0.007;
  const lng = anchor[1] + Math.cos(angle) * ring - (index % 4) * 0.007;
  return [lat, lng];
}

function buildFallbackTanks(): TankApi[] {
  return Array.from({ length: 10 }, (_, index) => {
    const unit = index + 1;
    const capacity = 18000 + unit * 1500;
    const fillPercent = 52 + (unit % 4) * 8;
    return {
      id: 9000 + unit,
      code: `TNK-${unit.toString().padStart(2, '0')}`,
      name: `Tanque Demo ${unit.toString().padStart(2, '0')}`,
      location: `Patio operativo ${unit.toString().padStart(2, '0')}`,
      fuelType: 'diesel',
      capacity,
      currentVolume: Math.round(capacity * (fillPercent / 100)),
      temperature: 27 + (unit % 5),
      density: 0.82 + (unit % 3) * 0.01,
      status: 'operational',
      sensorIdentifier: `TANK-DEMO-${unit.toString().padStart(2, '0')}`,
      assignedCompanyId: 1,
      fillPercent,
      availableCapacity: Math.round(capacity * (1 - fillPercent / 100)),
      lastUpdate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  });
}

function buildFallbackDispensers(): DispenserApi[] {
  return Array.from({ length: 10 }, (_, index) => {
    const unit = index + 1;
    return {
      id: 8000 + unit,
      code: `DSP-${unit.toString().padStart(2, '0')}`,
      name: `Dispensador Demo ${unit.toString().padStart(2, '0')}`,
      location: `Isla ${unit.toString().padStart(2, '0')}`,
      tankId: 9000 + unit,
      tankCode: `TNK-${unit.toString().padStart(2, '0')}`,
      totalizer: 25000 + unit * 875,
      status: unit % 5 === 0 ? 'maintenance' : 'online',
      deviceIdentifier: `DISP-DEMO-${unit.toString().padStart(2, '0')}`,
      assignedCompanyId: 1,
      lastTransactionAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  });
}

function ClusteredOperationalMarkers({ markers }: { markers: OperationalMarker[] }) {
  const map = useMap();
  const [mapVersion, setMapVersion] = useState(0);

  useEffect(() => {
    const update = () => setMapVersion((current) => current + 1);
    map.on('zoomend moveend', update);
    return () => {
      map.off('zoomend moveend', update);
    };
  }, [map]);

  const clusters = useMemo(() => {
    void mapVersion;
    const zoom = map.getZoom();
    const cellSize = zoom >= 15 ? 34 : zoom >= 13 ? 54 : 78;
    const grouped = new Map<string, OperationalMarker[]>();

    markers.forEach((marker) => {
      const point = map.project(marker.position, zoom);
      const key = `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), marker]);
    });

    return Array.from(grouped.values()).map((items) => {
      const position: [number, number] = [
        items.reduce((sum, item) => sum + item.position[0], 0) / items.length,
        items.reduce((sum, item) => sum + item.position[1], 0) / items.length,
      ];

      return { id: items.map((item) => item.id).join('|'), items, position };
    });
  }, [map, mapVersion, markers]);

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.items.length > 1) {
          return (
            <SafeMarker key={cluster.id} position={cluster.position} icon={createClusterIcon(cluster.items)}>
              <Popup>
                <div className="min-w-[220px] text-sm text-slate-900">
                  <p className="font-semibold">Cluster operacional</p>
                  <p>{cluster.items.length} puntos cercanos</p>
                  <div className="mt-2 space-y-1">
                    {cluster.items.slice(0, 8).map((item) => (
                      <p key={item.id}>
                        <span className="font-medium">{markerStyles[item.kind].label}:</span> {item.title}
                      </p>
                    ))}
                    {cluster.items.length > 8 ? <p className="text-slate-500">+{cluster.items.length - 8} más</p> : null}
                  </div>
                </div>
              </Popup>
            </SafeMarker>
          );
        }

        const marker = cluster.items[0];
        return (
          <SafeMarker key={marker.id} position={marker.position} icon={createMarkerIcon(marker.kind)}>
            <Popup>
              <div className="min-w-[190px] text-sm text-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {markerStyles[marker.kind].label}
                </p>
                <p className="mt-1 font-semibold">{marker.title}</p>
                <p>{marker.subtitle}</p>
                <p className="mt-1 text-slate-600">{marker.detail}</p>
              </div>
            </Popup>
          </SafeMarker>
        );
      })}
    </>
  );
}

function MapFocus({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, 12, { duration: 1.2 });
  }, [center, map]);

  return null;
}

function MapStat({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-xl text-cyan-200">
          <i className={icon}></i>
        </div>
      </div>
    </div>
  );
}

export default function ClientMapPage() {
  const { buses, busSelected, dataSource } = useBusContext();
  const [tanks, setTanks] = useState<TankApi[]>([]);
  const [dispensers, setDispensers] = useState<DispenserApi[]>([]);

  useEffect(() => {
    const loadOperationalAssets = async () => {
      const [tankData, dispenserData] = await Promise.all([
        getTanksService().catch(() => []),
        getDispensersService().catch(() => []),
      ]);
      setTanks(tankData);
      setDispensers(dispenserData);
    };

    void loadOperationalAssets();
  }, []);

  if (!busSelected) {
    return (
      <section className="rounded-[30px] border border-dashed border-white/10 bg-white/5 p-8 text-slate-200 backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mapa</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">No hay ubicaciones para mostrar</h2>
        <p className="mt-3 text-sm text-slate-300">
          No existen vehiculos con datos disponibles en la base de datos.
        </p>
      </section>
    );
  }

  const activeBus = busSelected;
  const location = activeBus.location;
  const telemetry = activeBus.telemetry;
  const events = activeBus.events;

  const center = useMemo<[number, number]>(() => {
    return [location.lat, location.lng];
  }, [location.lat, location.lng]);

  const operationalMarkers = useMemo<OperationalMarker[]>(() => {
    const vehicleMarkers = buses.map((bus: BusItem): OperationalMarker => ({
      id: `vehicle-${bus.id}`,
      kind: 'vehicle',
      title: bus.name,
      subtitle: `Placa ${bus.plate}`,
      detail: `Combustible ${getLatestDiesel(bus).toFixed(1)}% · ${formatRelativeHour(bus.telemetry.updatedAt)}`,
      position: [bus.location.lat, bus.location.lng],
    }));

    const visibleTanks = tanks.length > 0 ? tanks : dataSource === 'demo' ? buildFallbackTanks() : [];
    const visibleDispensers = dispensers.length > 0 ? dispensers : dataSource === 'demo' ? buildFallbackDispensers() : [];

    const tankMarkers = visibleTanks.map((tank, index): OperationalMarker => ({
      id: `tank-${tank.id}`,
      kind: 'tank',
      title: tank.code,
      subtitle: tank.location,
      detail: `${tank.currentVolume.toFixed(1)} / ${tank.capacity.toFixed(1)} L · ${tank.fillPercent.toFixed(1)}%`,
      position: getOperationalPosition(index, 'tank', center),
    }));

    const dispenserMarkers = visibleDispensers.map((dispenser, index): OperationalMarker => ({
      id: `dispenser-${dispenser.id}`,
      kind: 'dispenser',
      title: dispenser.code,
      subtitle: dispenser.location,
      detail: `Tanque ${dispenser.tankCode ?? dispenser.tankId} · Totalizador ${dispenser.totalizer.toFixed(1)} L`,
      position: getOperationalPosition(index, 'dispenser', center),
    }));

    return [...vehicleMarkers, ...tankMarkers, ...dispenserMarkers];
  }, [buses, center, dataSource, dispensers, tanks]);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MapStat title="Unidad enfocada" value={activeBus.plate} icon="bx bx-navigation" />
        <MapStat title="Combustible" value={`${getLatestDiesel(activeBus).toFixed(1)}%`} icon="bx bx-droplet" />
        <MapStat title="Velocidad" value={`${telemetry.speed.toFixed(0)} km/h`} icon="bx bx-tachometer" />
        <MapStat title="Última lectura" value={formatRelativeHour(telemetry.updatedAt)} icon="bx bx-time-five" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <article className="overflow-hidden rounded-[30px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Geolocalización</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Mapa de monitoreo</h2>
              <p className="mt-1 text-sm text-slate-400">El mapa usa la selección actual del panel izquierdo y prioriza coordenadas del backend cuando existan.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs text-slate-300">
              {location.label || 'Posición actual'}
            </span>
          </div>

          <div className="mb-3 flex flex-wrap gap-2 px-1 text-xs text-slate-300">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/35 px-3 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Vehículos
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/35 px-3 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Tanques
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/35 px-3 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" /> Dispensadores
            </span>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-slate-950/35 px-3 py-1">
              {operationalMarkers.length} puntos en mapa
            </span>
          </div>

          <div className="h-[560px] overflow-hidden rounded-[26px] border border-white/10">
            <SafeMapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full">
              <MapFocus center={center} />
              <SafeTileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClusteredOperationalMarkers markers={operationalMarkers} />
            </SafeMapContainer>
          </div>
        </article>

        <div className="grid gap-4">
          <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Unidad seleccionada</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{activeBus.name}</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl bg-slate-950/35 p-3"><p className="text-slate-500">Chofer</p><p className="mt-1 text-base font-semibold text-white">{activeBus.driver ?? 'Operador por asignar'}</p></div>
              <div className="rounded-2xl bg-slate-950/35 p-3"><p className="text-slate-500">Motor</p><p className="mt-1 text-base font-semibold text-white">{activeBus.engine}</p></div>
              <div className="rounded-2xl bg-slate-950/35 p-3"><p className="text-slate-500">Coordenadas</p><p className="mt-1 text-base font-semibold text-white">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p></div>
              <div className="rounded-2xl bg-slate-950/35 p-3"><p className="text-slate-500">Volumen registrado</p><p className="mt-1 text-base font-semibold text-white">{telemetry.volume.toFixed(1)} L</p></div>
            </div>
          </article>

          <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Actividad reciente</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Eventos en ruta</h3>
            <div className="mt-4 space-y-3">
              {events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{event.type}</p>
                    <span className="text-xs uppercase tracking-[0.25em] text-slate-500">{event.severity}</span>
                  </div>
                  <p className="mt-2">{event.detail}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{event.location}</span>
                    <span>{event.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
