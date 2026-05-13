import { DispenserApi, TankApi } from '@/services/fuel/service';
import { volume } from './format';

type SelectionPanelProps = {
  viewMode: 'tanks' | 'dispensers';
  tanks: TankApi[];
  dispensers: DispenserApi[];
  selectedTank?: TankApi | null;
  selectedDispenser?: DispenserApi | null;
  canEditTanks?: boolean;
  onViewModeChange: (viewMode: 'tanks' | 'dispensers') => void;
  onTankSelect: (tankId: number) => void;
  onDispenserSelect: (dispenserId: number) => void;
  onTankConfigure?: (tank: TankApi) => void;
};

export function SelectionPanel({
  viewMode,
  tanks,
  dispensers,
  selectedTank,
  selectedDispenser,
  canEditTanks = false,
  onViewModeChange,
  onTankSelect,
  onDispenserSelect,
  onTankConfigure,
}: SelectionPanelProps) {
  return (
    <aside className="rounded-[30px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Selección</p>
          <h3 className="mt-1 text-xl font-semibold text-white">
            {viewMode === 'tanks' ? 'Tanques' : 'Dispensadores'}
          </h3>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-1 text-xs text-slate-300">
          {viewMode === 'tanks' ? tanks.length : dispensers.length}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-[22px] border border-white/10 bg-slate-950/35 p-1">
        <button
          type="button"
          onClick={() => onViewModeChange('tanks')}
          className={[
            'rounded-[18px] px-3 py-2 text-sm font-semibold transition',
            viewMode === 'tanks' ? 'bg-emerald-300 text-slate-950' : 'text-slate-300 hover:bg-white/8',
          ].join(' ')}
        >
          Tanques
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('dispensers')}
          className={[
            'rounded-[18px] px-3 py-2 text-sm font-semibold transition',
            viewMode === 'dispensers' ? 'bg-amber-300 text-slate-950' : 'text-slate-300 hover:bg-white/8',
          ].join(' ')}
        >
          Dispensadores
        </button>
      </div>

      <div className="max-h-full space-y-3 overflow-y-auto pr-1">
        {viewMode === 'tanks'
          ? tanks.map((tank) => {
              const selected = selectedTank?.id === tank.id;

              return (
                <div
                  key={tank.id}
                  className={[
                    'w-full rounded-[24px] border p-4 text-left transition',
                    selected ? 'border-emerald-300/35 bg-white/12' : 'border-white/10 bg-white/5 hover:bg-white/8',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => onTankSelect(tank.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{tank.code}</p>
                        <p className="mt-1 text-sm text-slate-400">{tank.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{tank.location}</p>
                      </div>
                      <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                        {tank.fillPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, Math.max(0, tank.fillPercent))}%` }} />
                    </div>
                  </button>

                  {canEditTanks && onTankConfigure ? (
                    <button
                      type="button"
                      onClick={() => onTankConfigure(tank)}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/16"
                    >
                      <i className="bx bx-cog" />
                      Configurar tanque
                    </button>
                  ) : null}
                </div>
              );
            })
          : dispensers.map((dispenser) => {
              const selected = selectedDispenser?.id === dispenser.id;

              return (
                <button
                  key={dispenser.id}
                  type="button"
                  onClick={() => onDispenserSelect(dispenser.id)}
                  className={[
                    'w-full rounded-[24px] border p-4 text-left transition',
                    selected ? 'border-amber-300/35 bg-white/12' : 'border-white/10 bg-white/5 hover:bg-white/8',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{dispenser.code}</p>
                      <p className="mt-1 text-sm text-slate-400">{dispenser.location}</p>
                    </div>
                    <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
                      {dispenser.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div className="rounded-2xl bg-slate-950/30 px-3 py-2">
                      <p className="text-slate-500">Tanque</p>
                      <p className="mt-1 font-semibold text-white">{dispenser.tankCode ?? dispenser.tankId}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/30 px-3 py-2">
                      <p className="text-slate-500">Totalizador</p>
                      <p className="mt-1 font-semibold text-white">{volume(dispenser.totalizer)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
      </div>
    </aside>
  );
}
