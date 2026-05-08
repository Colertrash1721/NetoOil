import { DispenserApi, TankApi } from '@/services/fuel/service';

export function buildDemoTanks(): TankApi[] {
  return Array.from({ length: 10 }, (_, index) => {
    const unit = index + 1;
    const capacity = 18000 + unit * 1500;
    const fillPercent = 52 + (unit % 4) * 8;
    const currentVolume = Math.round(capacity * (fillPercent / 100));

    return {
      id: 9000 + unit,
      code: `TNK-${unit.toString().padStart(2, '0')}`,
      name: `Tanque Institucional ${unit.toString().padStart(2, '0')}`,
      location: `Patio operativo ${unit.toString().padStart(2, '0')}`,
      fuelType: 'diesel',
      storageType: unit % 2 === 0 ? 'soterrado' : 'aereo',
      capacity,
      currentVolume,
      temperature: 27 + (unit % 5),
      density: 0.82 + (unit % 3) * 0.01,
      status: 'operational',
      sensorIdentifier: `TANK-DEMO-${unit.toString().padStart(2, '0')}`,
      assignedCompanyId: 1,
      fillPercent,
      availableCapacity: capacity - currentVolume,
      lastUpdate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  });
}

export function buildDemoDispensers(): DispenserApi[] {
  return Array.from({ length: 10 }, (_, index) => {
    const unit = index + 1;

    return {
      id: 8000 + unit,
      code: `DSP-${unit.toString().padStart(2, '0')}`,
      name: `Dispensador ${unit.toString().padStart(2, '0')}`,
      location: `Isla ${unit.toString().padStart(2, '0')}`,
      tankId: 9000 + unit,
      tankCode: `TNK-${unit.toString().padStart(2, '0')}`,
      totalizer: 25000 + unit * 875,
      supportedIdentificationMethods: 'rfid,mifare,anpr,ble',
      fallbackIdentificationMethod: 'anpr',
      productConfigurations: [
        { hoseNumber: 1, product: 'diesel' },
        { hoseNumber: 2, product: 'gasolina' },
        { hoseNumber: 3, product: 'diesel' },
        { hoseNumber: 4, product: 'gasolina' },
      ],
      hoseCount: 4,
      status: unit % 5 === 0 ? 'maintenance' : 'online',
      deviceIdentifier: `DISP-DEMO-${unit.toString().padStart(2, '0')}`,
      assignedCompanyId: 1,
      lastTransactionAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  });
}
