'use client';

import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Pie,
  PieChart
} from "recharts";
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const chartData = [
  { name: 'January', clients: 30 },
  { name: 'February', clients: 45 },
  { name: 'March', clients: 60 },
  { name: 'April', clients: 80 },
  { name: 'May', clients: 100 },
  { name: 'June', clients: 120 },
  { name: 'July', clients: 150 },
  { name: 'August', clients: 170 },
  { name: 'September', clients: 200 },
  { name: 'October', clients: 220 },
  { name: 'November', clients: 0 },
  { name: 'December', clients: 0 },
];


const clients = [
  { name: 'Clientes Activos', value: 240, fill: "#0088FE" },
  { name: 'Clientes Inactivos', value: 60, fill: "#00C49F" },
]
const totalClients = clients.reduce((acc, curr) => acc + curr.value, 0);

export default function Page() {
  return (
    <>
      {/* Header cards */}
      <div className="flex flex-col md:flex-row lg:flex-row gap-6 h-full md:h-[40%] lg:h-[40%] justify-between">
        <Card className="bg-white h-[20vh] w-full md:w-[30%] lg:w-[30%] p-6 rounded-lg shadow-md flex justify-center items-center flex-col">
          <h1 className="text-xl font-bold mb-2">Usuarios activos</h1>
          <div className="flex flex-row">
            <i className={`bx bx-user text-4xl`}></i>
            <p className="text-2xl font-bold text-whi">{totalClients}</p>
          </div>
        </Card>

        <Card className="flex justify-center items-center flex-col bg-white h-[20vh] w-full md:w-[30%] lg:w-[30%] p-6 rounded-lg shadow-md">
          <h1 className="text-xl font-bold mb-2">Total de usuarios</h1>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                dataKey="value"
                data={clients}
                isAnimationActive
                innerRadius="70%"
                outerRadius="90%"
                cornerRadius={50}
                paddingAngle={5}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  new Intl.NumberFormat('es-ES').format(value),
                  name
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Chart */}
      <Card className="bg-white p-6 rounded-lg shadow-md h-[50vh] md:full lg:full">
        <h1 className="text-xl font-bold mb-4">
          Gráfica de visualización de aumento de clientes
        </h1>

        <ResponsiveContainer width="100%" height="90%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip
              formatter={(value: number) =>
                [new Intl.NumberFormat('en-US').format(value), 'Clientes']
              }
            />
            <Bar dataKey="clients" name="Clientes" fill="#4f46e5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}
