import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Esta libreria es para el dashboard del administrados y servira para visualizar los detalles de venta, cola de peidos y ventas del dia 
// es cuestion de trabajarlo y adecuarlo al maquetado que se tiene en el powerpoint para que haya la similitud de la app 