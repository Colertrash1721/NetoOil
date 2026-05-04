import { RefuelingTransactionApi } from '@/services/fuel/service';
import { escapeCell } from './format';

export function downloadExcelFile(filename: string, sections: Array<{ title: string; rows: Array<Record<string, unknown>> }>) {
  const content = sections.map((section) => {
    const headers = Object.keys(section.rows[0] ?? { mensaje: 'Sin datos' });
    const rows = section.rows.length > 0 ? section.rows : [{ mensaje: 'Sin datos' }];

    return `
      <h2>${escapeCell(section.title)}</h2>
      <table border="1">
        <thead><tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeCell(row[header])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    `;
  }).join('<br />');

  const blob = new Blob([`<html><head><meta charset="UTF-8" /></head><body>${content}</body></html>`], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function transactionRows(transactions: RefuelingTransactionApi[]) {
  return transactions.map((transaction) => ({
    codigo: transaction.transactionCode,
    vehiculo: transaction.vehiclePlate ?? transaction.vehicleId,
    chofer: transaction.driverName ?? '',
    dispensador: transaction.dispenserCode ?? transaction.dispenserId,
    tanque: transaction.tankCode ?? transaction.tankId,
    volumen: transaction.dispensedVolume,
    metodo: transaction.identificationMethod,
    preautorizada: transaction.preAuthorized ? 'Si' : 'No',
    estado: transaction.status,
    fecha: transaction.completedAt ?? transaction.startedAt,
  }));
}
