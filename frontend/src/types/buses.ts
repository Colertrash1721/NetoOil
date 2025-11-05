export type BusItem = {
  id: number;
  name: string;
  engine: string;
  plate: string;
  DieselLevel: {
    number: number;
    timestamp: string;
  }[];
  EstimatedLevel: {
    number: number;
    timestamp: string;
  }[];
};

export type Bus = BusItem[];