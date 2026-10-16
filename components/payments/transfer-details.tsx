import type { TransferAccountDetails } from "@/types/payments";

export function TransferDetails({
  transfer,
  className,
}: {
  transfer: TransferAccountDetails;
  className: string;
}) {
  return (
    <div className={className}>
      <h3 className="font-bold">Datos para realizar la transferencia</h3>
      <dl className="mt-2 space-y-1">
        <div>
          <dt className="inline font-semibold">Banco: </dt>
          <dd className="inline">{transfer.bank}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Beneficiario: </dt>
          <dd className="inline">{transfer.beneficiary}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">CLABE: </dt>
          <dd className="inline break-all">{transfer.clabe}</dd>
        </div>
        {transfer.accountNumber && (
          <div>
            <dt className="inline font-semibold">Número de cuenta: </dt>
            <dd className="inline">{transfer.accountNumber}</dd>
          </div>
        )}
        {transfer.instructions && (
          <div>
            <dt className="inline font-semibold">Instrucciones: </dt>
            <dd className="inline">{transfer.instructions}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
