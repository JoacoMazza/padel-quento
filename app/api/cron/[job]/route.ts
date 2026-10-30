import { runCronJob } from "@/src/lib/cron";

/**
 * Corre un proceso en segundo plano (ver src/lib/cron.ts). Lo llama el
 * programador externo con "Authorization: Bearer <CRON_SECRET>".
 */
export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const { status, body } = await runCronJob(job, request.headers.get("authorization"));
  return Response.json(body, { status });
}
