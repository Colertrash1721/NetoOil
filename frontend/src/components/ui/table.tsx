import React from 'react'

type Props = {
    header?: string[];
    data?: any[];
    classNameT?: string;
    classNameH?: string;
    classNameB?: string;
    classNameButton?: string;
    classNameEstadoButton?: string;
    classNameAccionesButton?: string;
    onEstadoClick?: (estado: string, row: any) => void;
    onUpdateCompany?: (row: any) => void;
}

export default function Table({
    header,
    data,
    onEstadoClick,
    onUpdateCompany,
    classNameT,
    classNameH,
    classNameB,
    classNameEstadoButton,
    classNameAccionesButton,
}: Props) {
    return (
        <table className={`${classNameT} border-collapse`}>
            <thead className="bg-gray-100">
                <tr>
                    {header?.map((item, index) => (
                        <th key={index} className={classNameH}>
                            {item}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className={classNameB}>
                {data?.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50 border-b border-gray-200">
                        {header?.map((key, index) => (
                            key.toLowerCase() === "estado" ?
                                (
                                    <td className={classNameB + ' p-1'} key={index}>
                                        <button
                                            className={classNameEstadoButton}
                                            onClick={() => 
                                                onEstadoClick?.(row[key.toLowerCase()], row)
                                            }
                                        >
                                            {row[key.toLowerCase()]}
                                        </button>
                                    </td>
                                )
                                :  key.toLowerCase() === "acciones" ? (
                                    <td className={classNameB + ' p-1'} key={index}>
                                        <button
                                            className={classNameAccionesButton}
                                            onClick={() => 
                                                onEstadoClick?.(row[key.toLowerCase()], row)
                                            }
                                        >
                                            {row[key.toLowerCase()]}
                                        </button>
                                    </td>
                                ) :
                                <td key={index} className="px-4 py-3 whitespace-nowrap">
                                    {row[key.toLowerCase().replace(/ /g, "")]}
                                </td>
                        ))}

                    </tr>
                ))}
            </tbody>
        </table>
    )
}