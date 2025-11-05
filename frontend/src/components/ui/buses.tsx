'use client';

import { useEffect, useState } from 'react'
import { Bus } from '@/types/buses';

type BusesProps = {
    returnSelectedBus: (busId: number) => void;
}

const buses: Bus = [
    {
        id: 101,
        name: "Ruta 27 - Centro",
        engine: "Mercedes-Benz OH-1621",
        plate: "ABC-123",
        DieselLevel: [
            { number: 85.5, timestamp: "2024-01-15T08:00:00Z" },
            { number: 75.5, timestamp: "2024-01-15T09:00:00Z" },
            { number: 65.2, timestamp: "2024-01-15T10:00:00Z" },
            { number: 55.8, timestamp: "2024-01-15T11:00:00Z" }
        ],
        EstimatedLevel: [
            { number: 87.1, timestamp: "2024-01-15T08:00:00Z" },
            { number: 78.2, timestamp: "2024-01-15T09:00:00Z" },
            { number: 68.9, timestamp: "2024-01-15T10:00:00Z" },
            { number: 59.3, timestamp: "2024-01-15T11:00:00Z" }
        ]
    },
    {
        id: 102,
        name: "Expreso Norte",
        engine: "Volvo B8R",
        plate: "XYZ-789",
        DieselLevel: [
            { number: 95.0, timestamp: "2024-01-15T06:30:00Z" },
            { number: 82.3, timestamp: "2024-01-15T08:15:00Z" },
            { number: 70.1, timestamp: "2024-01-15T10:00:00Z" },
            { number: 58.7, timestamp: "2024-01-15T12:00:00Z" },
            { number: 45.0, timestamp: "2024-01-15T14:00:00Z" }
        ],
        EstimatedLevel: [
            { number: 96.5, timestamp: "2024-01-15T06:30:00Z" },
            { number: 85.2, timestamp: "2024-01-15T08:15:00Z" },
            { number: 73.8, timestamp: "2024-01-15T10:00:00Z" },
            { number: 62.1, timestamp: "2024-01-15T12:00:00Z" },
            { number: 50.4, timestamp: "2024-01-15T14:00:00Z" }
        ]
    },
    {
        id: 103,
        name: "Circular Sur",
        engine: "Scania K280",
        plate: "DEF-456",
        DieselLevel: [
            { number: 90.0, timestamp: "2024-01-13T08:00:00Z" },
            { number: 45.5, timestamp: "2024-01-13T16:00:00Z" },
            { number: 88.2, timestamp: "2024-01-14T08:00:00Z" },
            { number: 42.8, timestamp: "2024-01-14T16:00:00Z" },
            { number: 86.7, timestamp: "2024-01-15T08:00:00Z" },
            { number: 40.1, timestamp: "2024-01-15T16:00:00Z" }
        ],
        EstimatedLevel: [
            { number: 92.1, timestamp: "2024-01-13T08:00:00Z" },
            { number: 48.3, timestamp: "2024-01-13T16:00:00Z" },
            { number: 90.5, timestamp: "2024-01-14T08:00:00Z" },
            { number: 46.2, timestamp: "2024-01-14T16:00:00Z" },
            { number: 89.8, timestamp: "2024-01-15T08:00:00Z" },
            { number: 44.7, timestamp: "2024-01-15T16:00:00Z" }
        ]
    },
    {
        id: 104,
        name: "MetroBus Línea 5",
        engine: "Marcopolo Torino 2023",
        plate: "GHI-789",
        DieselLevel: [
            { number: 100.0, timestamp: "2024-01-15T06:00:00Z" },
            { number: 85.3, timestamp: "2024-01-15T08:00:00Z" },
            { number: 70.1, timestamp: "2024-01-15T10:00:00Z" },
            { number: 55.8, timestamp: "2024-01-15T12:00:00Z" },
            { number: 40.2, timestamp: "2024-01-15T14:00:00Z" }
        ],
        EstimatedLevel: [
            { number: 100.0, timestamp: "2024-01-15T06:00:00Z" },
            { number: 87.5, timestamp: "2024-01-15T08:00:00Z" },
            { number: 72.9, timestamp: "2024-01-15T10:00:00Z" },
            { number: 58.3, timestamp: "2024-01-15T12:00:00Z" },
            { number: 43.7, timestamp: "2024-01-15T14:00:00Z" },
            { number: 29.1, timestamp: "2024-01-15T16:00:00Z" },
            { number: 14.5, timestamp: "2024-01-15T18:00:00Z" }
        ]
    },
    {
        id: 105,
        name: "Escolar Zona Este",
        engine: "Toyota Coaster",
        plate: "JKL-012",
        DieselLevel: [
            { number: 65.0, timestamp: "2024-01-15T13:00:00Z" }
        ],
        EstimatedLevel: [
            { number: 67.2, timestamp: "2024-01-15T13:00:00Z" },
            { number: 59.8, timestamp: "2024-01-15T15:00:00Z" },
            { number: 52.4, timestamp: "2024-01-15T17:00:00Z" }
        ]
    },
    {
        id: 106,
        name: "Aeropuerto Express",
        engine: "Mercedes-Benz O500U",
        plate: "MNO-345",
        DieselLevel: [
            { number: 78.9, timestamp: "2024-01-15T07:00:00Z" },
            { number: 65.4, timestamp: "2024-01-15T09:30:00Z" },
            { number: 51.2, timestamp: "2024-01-15T12:00:00Z" },
            { number: 38.7, timestamp: "2024-01-15T14:30:00Z" }
        ],
        EstimatedLevel: [
            { number: 80.5, timestamp: "2024-01-15T07:00:00Z" },
            { number: 68.1, timestamp: "2024-01-15T09:30:00Z" },
            { number: 54.8, timestamp: "2024-01-15T12:00:00Z" },
            { number: 41.3, timestamp: "2024-01-15T14:30:00Z" },
            { number: 27.9, timestamp: "2024-01-15T17:00:00Z" }
        ]
    }
];

function BusIcon({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <path d="M4 6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a2 2 0 0 1-2 2v2a1 1 0 1 1-2 0v-2H8v2a1 1 0 1 1-2 0v-2a2 2 0 0 1-2-2V6Zm2 0v5h12V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2ZM6 13v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1H6Zm2.5 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM8 5.5h3V9H8V5.5Zm5 0h3V9h-3V5.5Z" />
        </svg>
    );
}

type BusItem = Bus[number];

function getLastLevel(bus: BusItem) {
    return {
        lastDiesel: bus.DieselLevel[bus.DieselLevel.length - 1],
        lastEstimated: bus.EstimatedLevel[bus.EstimatedLevel.length - 1]
    }
}



const levelColor = (real: number, pred: number) => {
    const diff = Math.abs(real - pred);
    if (diff >= 25) return 'text-red-600';      // desvío alto
    if (diff >= 10) return 'text-amber-500';    // alerta
    return 'text-blue-600';                  // dentro de rango
};

export default function Buses({ returnSelectedBus }: BusesProps) {
    const [selectedId, setSelectedId] = useState<number>(1);

    const sendBusToFather = (bus: any) => {
        returnSelectedBus(bus.id);
        setSelectedId(bus.id);
    }

    return (
        <div className="bg-white h-full w-full rounded-xl shadow p-4">
            <h1 className="text-2xl font-extrabold tracking-wide text-center mb-4">
                AutoBuses
            </h1>

            <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100%-2.5rem)] pr-1">
                {buses.map((bus) => {
                    const { lastDiesel, lastEstimated } = getLastLevel(bus);
                    const selected = bus.id === selectedId;
                    const iconColor = levelColor(lastDiesel.number, lastEstimated.number);

                    return (
                        <button
                            key={bus.id}
                            onClick={() => sendBusToFather(bus)}
                            className={[
                                'w-full text-left flex items-center gap-3 px-3 py-3 rounded-2xl border shadow-sm transition',
                                'hover:shadow-md focus:outline-none focus:ring-2',
                                selected
                                    ? 'bg-cyan-50 border-cyan-200 ring-cyan-200'
                                    : 'bg-white border-gray-100 hover:border-gray-200 focus:ring-gray-300',
                            ].join(' ')}
                        >
                            <div className="rounded-2xl p-2 shrink-0 bg-gray-50">
                                <BusIcon className={`w-9 h-9 ${iconColor}`} />
                            </div>

                            <div className="leading-tight">
                                <div className="font-extrabold text-gray-900">{bus.name}</div>
                                <div className="text-gray-600">{bus.engine}</div>
                                <div className="text-gray-600">Plate {bus.plate}</div>
                                <div className="text-xs text-gray-500">
                                    Real: {lastDiesel.number}% · Predicho: {lastEstimated.number}% · Δ = {Math.abs(lastDiesel.number - lastEstimated.number)}%
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}