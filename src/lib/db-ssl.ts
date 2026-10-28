/**
 * Opciones de SSL de la conexión a Postgres. Supabase firma su certificado con
 * una CA propia que Node no conoce: con DATABASE_SSL_CA (el certificado que se
 * descarga del panel de Supabase) se verifica contra ella. Sin la variable, como
 * en el Postgres local, no se usa SSL.
 */
export function databaseSsl(env: Record<string, string | undefined> = process.env) {
  const ca = env.DATABASE_SSL_CA;
  if (!ca) return undefined;
  // Los paneles de variables de entorno no siempre aceptan varias líneas.
  return { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true };
}
