import React, { useEffect, useMemo, useState } from 'react'
import Table from '../ui/table'

type props = {
    filter: string
    searchTerm: string;
}

const acceptedUsers = [
    {
        company: 'Tech Solutions SA',
        username: 'juan_perez',
        email: 'juan.techsolutions@gmail.com',
        phone: '3114567890',
        address: 'Av. Principal 123',
        city: 'Bogotá',
        country: 'Colombia',
        postalCode: '110111',
        status: 'accepted',
    },
    {
        company: 'Innovación Digital',
        username: 'maria_garcia',
        email: 'maria.innovacion@outlook.com',
        phone: '3123456789',
        address: 'Calle 45 #67-89',
        city: 'Medellín',
        country: 'Colombia',
        postalCode: '050001',
        status: 'accepted',
    },
    {
        company: 'Consultoría Avanzada',
        username: 'ana_martinez',
        email: 'ana.consultoria@hotmail.com',
        phone: '3189012345',
        address: 'Diagonal 25 #40-15',
        city: 'Barranquilla',
        country: 'Colombia',
        postalCode: '080001',
        status: 'accepted',
    },

];

const pendingUsers = [
    {
        company: 'Servicios Globales',
        username: 'carlos_rodriguez',
        email: 'carlos.servicios@yahoo.com',
        phone: '3156789012',
        address: 'Carrera 8 #10-25',
        city: 'Cali',
        country: 'Colombia',
        postalCode: '760001',
        status: 'pending',
    },
    {
        company: 'Desarrollo Web SL',
        username: 'pedro_lopez',
        email: 'pedro.desarrollo@gmail.com',
        phone: '3201234567',
        address: 'Transversal 15 #30-45',
        city: 'Cartagena',
        country: 'Colombia',
        postalCode: '130001',
        status: 'pending',
    },
    {
        company: 'Empresa XYZ',
        username: 'laura_sanchez',
        email: 'laura.xyz@gmail.com',
        phone: '3224567890',
        address: 'Av. Libertador 567',
        city: 'Bucaramanga',
        country: 'Colombia',
        postalCode: '680001',
        status: 'pending',
    }
];

const rejectedUsers = [
    {
        company: 'Comercio Internacional',
        username: 'roberto_diaz',
        email: 'roberto.comercio@yahoo.com',
        phone: '3145678901',
        address: 'Calle 100 #25-30',
        city: 'Pereira',
        country: 'Colombia',
        postalCode: '660001',
        status: 'rejected',
    },
    {
        company: 'Logística Express',
        username: 'sofia_ramirez',
        email: 'sofia.logistica@hotmail.com',
        phone: '3178901234',
        address: 'Carrera 50 #80-10',
        city: 'Manizales',
        country: 'Colombia',
        postalCode: '170001',
        status: 'rejected',
    },
    {
        company: 'Marketing Digital',
        username: 'david_gonzalez',
        email: 'david.marketing@gmail.com',
        phone: '3190123456',
        address: 'Av. Circunvalar 200',
        city: 'Cúcuta',
        country: 'Colombia',
        postalCode: '540001',
        status: 'rejected',
    }
];

type User = {
  company: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  status: string;
};

export default function UserTable({ filter, searchTerm }: props) {
    // Función para obtener los datos según la opción seleccionada
    const [data, setData] = useState<any>();
    const headers = ["Compañía", "Usuario", "Email", "Teléfono", "Ciudad", "Estado", "Acciones"];

    const getCurrentData = (): User[] => {
        switch (filter) {
            case "Accepted": return acceptedUsers;
            case "Pending": return pendingUsers;
            case "Rejected": return rejectedUsers;
            default: return acceptedUsers;
        }
    };

    // Deriva filas LISTAS PARA LA TABLA a partir de filter + searchTerm
    const rows = useMemo(() => {
        const base = getCurrentData();
        const q = (searchTerm ?? '').trim().toLowerCase();

        const filtered = q
            ? base.filter(u =>
                [u.company, u.username, u.email, u.city, u.country, u.status]
                    .some(v => (v ?? '').toLowerCase().includes(q))
            )
            : base;

        // Mapea a las claves que tu Table espera mostrar
        return filtered.map(u => ({
            compañía: u.company || 'N/A',
            usuario: u.username || 'N/A',
            email: u.email || 'N/A',
            teléfono: u.phone || 'N/A',
            ciudad: u.city || 'N/A',
            estado:
                u.status === 'accepted'
                    ? 'Aceptado'
                    : u.status === 'pending'
                        ? 'Pendiente'
                        : 'Rechazado',
            // Si tu Table renderiza acciones, puedes pasar un placeholder o un nodo
            acciones: 'Editar'
        }));
    }, [filter, searchTerm]);

    const handleEstadoClick = (estado: string, row: any) => {
        console.log(`Cambiar estado a: ${estado}`, row);
    };

    const handleUpdateCompany = (row: any) => {
        console.log('Actualizar compañía:', row);
    };

    return (
        <div className="flex-1 overflow-auto">
            <Table
                classNameEstadoButton={`${filter === 'Accepted' ? 'bg-blue-500'
                     : filter === 'Pending' ? 'bg-yellow-500' 
                     : 'bg-red-600'} text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors duration-200 w-full text-center`}
                header={headers}
                data={rows}
                onEstadoClick={handleEstadoClick}
                onUpdateCompany={handleUpdateCompany}
                classNameT="w-full min-w-full table-auto"
                classNameH="px-4 py-2 text-left bg-gray-100 font-semibold sticky top-0"
                classNameB="divide-y divide-gray-200"
                classNameAccionesButton={`bg-blue-500 mr-2 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors duration-200 w-full text-center`}
            />
        </div>
    );
}
