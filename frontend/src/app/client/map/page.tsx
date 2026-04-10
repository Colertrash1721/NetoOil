'use client';

import { useBusContext } from '@/hooks/client/provider';
import { formatRelativeHour, getLatestDiesel } from '@/hooks/client/vehicleUi';
import { BusItem } from '@/types/buses';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { useEffect, useMemo } from 'react';

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

const SafeMapContainer = MapContainer as unknown as (props: StrictMapContainerProps) => JSX.Element;
const SafeTileLayer = TileLayer as unknown as (props: StrictTileLayerProps) => JSX.Element;

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
  const { buses, busSelected } = useBusContext();

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

          <div className="h-[560px] overflow-hidden rounded-[26px] border border-white/10">
            <SafeMapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full">
              <MapFocus center={center} />
              <SafeTileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {buses.map((bus: BusItem) => {
                const busLocation = bus.location;
                const telemetryData = bus.telemetry;
                return (
                  <Marker key={bus.id} position={[busLocation.lat, busLocation.lng]}>
                    <Popup>
                      <div className="min-w-[180px] text-sm text-slate-900">
                        <p className="font-semibold">{bus.name}</p>
                        <p>Placa: {bus.plate}</p>
                        <p>Ruta: {bus.route ?? 'Sin ruta registrada'}</p>
                        <p>Combustible: {getLatestDiesel(bus).toFixed(1)}%</p>
                        <p>Última actualización: {formatRelativeHour(telemetryData.updatedAt)}</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
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
