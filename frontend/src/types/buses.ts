export type LevelPoint = {
  number: number;
  timestamp: string;
};

export type BusLocation = {
  lat: number;
  lng: number;
  label?: string;
};

export type BusEvent = {
  id: number;
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  time: string;
  detail: string;
  location: string;
};

export type BusTelemetry = {
  temperature: number;
  inclination: number;
  volume: number;
  battery: number;
  pressure: number;
  humidity: number;
  speed: number;
  updatedAt: string;
};

export type BusItem = {
  id: number;
  name: string;
  engine: string;
  plate: string;
  route: string;
  driver: string;
  status: "En ruta" | "En terminal" | "Alerta";
  location: BusLocation;
  DieselLevel: LevelPoint[];
  EstimatedLevel: LevelPoint[];
  telemetry: BusTelemetry;
  events: BusEvent[];
};

export type Bus = BusItem[];
