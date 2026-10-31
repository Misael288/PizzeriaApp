import {
  getPaidSalesTotal,
  getSalesReportData,
} from "@/repositories/report-repository";

class ReportServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ReportServiceError";
  }
}

const parseDate = (value: string | null): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
};

const parseInstant = (value: string | null): Date | null => {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return null;
  }
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) || instant.toISOString() !== value
    ? null
    : instant;
};

const getDashboardSalesTotal = async (
  fromValue: string | null,
  untilValue: string | null,
) => {
  const from = parseInstant(fromValue);
  const until = parseInstant(untilValue);
  if (!from || !until) {
    throw new ReportServiceError(
      "Indica los límites locales del día en formato ISO válido.",
      400,
    );
  }
  const duration = until.getTime() - from.getTime();
  if (duration <= 0 || duration > 26 * 60 * 60 * 1000) {
    throw new ReportServiceError(
      "El intervalo del día debe ser mayor a cero y no superar 26 horas.",
      422,
    );
  }
  return getPaidSalesTotal(from, until);
};

const getSalesReport = async (fromValue: string | null, toValue: string | null) => {
  const from = parseDate(fromValue);
  const to = parseDate(toValue);
  if (!from || !to) {
    throw new ReportServiceError("Indica un rango de fechas válido.", 400);
  }
  const until = new Date(to);
  until.setUTCDate(until.getUTCDate() + 1);
  if (from > to) {
    throw new ReportServiceError(
      "La fecha inicial no puede ser posterior a la final.",
      422,
    );
  }
  const days = (until.getTime() - from.getTime()) / 86_400_000;
  if (days > 366) {
    throw new ReportServiceError("El rango máximo es de 366 días.", 422);
  }
  return getSalesReportData(from, until);
};

export {
  getDashboardSalesTotal,
  getSalesReport,
  ReportServiceError,
};
