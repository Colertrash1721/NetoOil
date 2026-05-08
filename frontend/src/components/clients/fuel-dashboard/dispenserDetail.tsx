import { DispenserApi } from '@/services/fuel/service';
import { TransactionHistoryTable } from '@/components/fuel/transactionHistoryTable';
import { volume } from './format';

export function DispenserDetail({ dispenser }: { dispenser: DispenserApi }) {
  return (
    <>
    <article className="rounded-[30px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dispensador seleccionado</p>
          <h3 className="mt-2 text-3xl font-semibold text-white">{dispenser.code}</h3>
          <p className="mt-2 text-sm text-slate-300">{dispenser.name} · {dispenser.location}</p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-sm font-semibold text-amber-100">
          {dispenser.status}
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Totalizador</p>
          <p className="mt-2 text-xl font-semibold text-white">{volume(dispenser.totalizer)}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tanque origen</p>
          <p className="mt-2 text-xl font-semibold text-white">{dispenser.tankCode ?? dispenser.tankId}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Dispositivo</p>
          <p className="mt-2 text-xl font-semibold text-white">{dispenser.deviceIdentifier ?? 'N/D'}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Último despacho</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {dispenser.lastTransactionAt ? new Date(dispenser.lastTransactionAt).toLocaleDateString('es-DO') : 'N/D'}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950/35 p-4 md:col-span-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Galones a echar</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {dispenser.targetRefillGallons != null ? `${dispenser.targetRefillGallons.toFixed(2)} gal` : 'N/D'}
          </p>
        </div>
      </div>
    </article>
    <TransactionHistoryTable
      title={`Historial del dispensador ${dispenser.code}`}
      subtitle="Despachos asociados al dispensador seleccionado."
      filters={{ dispenserId: dispenser.id }}
    />
    </>
  );
}
