export interface ClosableResource {
  close(): Promise<unknown>;
}

export async function closeWorkerResources(
  workers: ClosableResource[],
  queues: ClosableResource[],
  app?: ClosableResource,
): Promise<void> {
  const results = await Promise.allSettled([
    ...workers.map((worker) => worker.close()),
    ...queues.map((queue) => queue.close()),
    ...(app ? [app.close()] : []),
  ]);
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}
