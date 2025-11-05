'use client';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import KpiCard from '@/components/ui/KpiCard';
import DropDown from '@/components/ui/dropDown';
import { useEffect, useState } from 'react';
import Buses from '@/components/ui/buses';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Bus, BusItem } from '@/types/buses';
import { formatTime, prepareChartData } from '@/lib/utils';

const data = [
  { name: 'January', uv: 4000 },
  { name: 'February', uv: 3000 },
  { name: 'March', uv: 5000 },
  { name: 'April', uv: 4000 },
  { name: 'May', uv: 6000 },
  { name: 'June', uv: 7000 },
  { name: 'July', uv: 8000 },
  { name: 'August', uv: 6000 },
  { name: 'September', uv: 7000 },
  { name: 'October', uv: 8000 },
  { name: 'November', uv: 9000 },
  { name: 'December', uv: 10000 },
];

const busesData: Bus = [
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

const options = ['Compañía A', 'Compañía B', 'Compañía C'];


export default function AnalyticsPage() {
  const year = new Date().getFullYear();
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const day = new Date().getDate().toString().padStart(2, '0');
  const [selectedDate, setSelectedDate] = useState(year + '-' + month + '-' + day);
  const [selectCompany, setSelectCompany] = useState(options[0]);
  const [selectedBusId, setSelectedBusId] = useState<number>(busesData[0].id);
  const [busSelected, setbusSelected] = useState<BusItem>(busesData[0]);

  const selectedBus = (busId: number) => {
    setSelectedBusId(busId);
    const bus = busesData.find((b) => b.id === busId);
    if (bus) {
      setbusSelected(bus);
    }
  }

  const returnSelectedCompany = (option: string) => {
    setSelectCompany(option);
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  }

  const chartData = prepareChartData(busSelected);

  return (
    <div className="grid grid-rows-3 gap-4 min-h-[600px] h-full w-full">
      <div className="flex flex-col gap-4 w-full h-fit">
        <div className="flex items-center justify-between">
          <DropDown className="flex w-1/4 bg-white p-2
          rounded tracking-widest text-gray-500 justify-between items-center cursor-pointer relative" title="Seleccionar compañía" options={options} returnSelectedOption={returnSelectedCompany} />
          <div className="w-1/2 flex justify-end gap-4">
            <input type="date" name="" id="" className='bg-white p-2 w-1/2' value={selectedDate} onChange={(e) => handleDateChange(e)} />
            <button><i className='bx bxs-file-plus bg-white p-2 h-full text-3xl text-green-600 rounded shadow cursor-pointer'></i></button>
            <button><i className='bx bxs-file-pdf bg-white p-2 h-full text-3xl text-red-600 rounded shadow cursor-pointer'></i></button>
          </div>
        </div>
        <div className="flex flex-row gap-4 ">
          <KpiCard title="Consumo" value="$733.2K" deltaUp data={data} />
          <KpiCard title="Recorrido" value="RD$ 1.85M" deltaUp={false} data={data} />
          <KpiCard title="Estado" value="82.1%" deltaText="5.1% vs PY" deltaUp data={data} />
        </div>
      </div>
      <div className="flex flex-row gap-4 row-span-3 w-full h-full">
        <div className="w-1/2 h-full">
          <Buses returnSelectedBus={selectedBus} />
        </div>

        <div className="flex flex-col gap-4 h-full w-full">
          {/* Gráfico de Nivel Real vs Estimado */}
          <div className="bg-white h-1/2 w-full p-4 rounded shadow">
            <h1 className='text-center font-bold tracking-[1.5px] mb-4'>
              Nivel Real vs Estimado - {busSelected?.name}
            </h1>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart
                data={chartData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  width={40}
                  tick={{ fontSize: 12 }}
                  domain={[0, 100]}
                  label={{ value: '%', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Nivel']}
                  labelFormatter={(label) => `Hora: ${label}`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="dieselReal"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                  name="Nivel Real"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="dieselEstimated"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  fillOpacity={0.6}
                  name="Nivel Estimado"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Error de Predicción */}
          <div className="bg-white h-1/2 w-full p-4 rounded shadow">
            <h1 className='text-center font-bold tracking-[1.5px] mb-4'>
              Error de Predicción - {busSelected?.name}
            </h1>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart
                data={chartData.filter(item => item.dieselReal !== null && item.dieselEstimated !== null)}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  width={40}
                  tick={{ fontSize: 12 }}
                  label={{ value: '% Error', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value) => [`${Math.abs(Number(value)).toFixed(1)}%`, 'Error']}
                  labelFormatter={(label) => `Hora: ${label}`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey={(data) => Math.abs(data.dieselReal - data.dieselEstimated)}
                  stroke="#ff7300"
                  fill="#ff7300"
                  fillOpacity={0.6}
                  name="Error Absoluto"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
