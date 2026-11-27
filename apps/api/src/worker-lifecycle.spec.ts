import { closeWorkerResources } from "./worker-lifecycle";

describe("closeWorkerResources", () => {
  it("menutup semua resource meskipun satu close gagal", async () => {
    const workerClose = jest.fn().mockRejectedValue(new Error("worker close failed"));
    const queueClose = jest.fn().mockResolvedValue(undefined);
    const appClose = jest.fn().mockResolvedValue(undefined);

    await expect(closeWorkerResources(
      [{ close: workerClose }],
      [{ close: queueClose }],
      { close: appClose },
    )).rejects.toThrow("worker close failed");

    expect(workerClose).toHaveBeenCalledTimes(1);
    expect(queueClose).toHaveBeenCalledTimes(1);
    expect(appClose).toHaveBeenCalledTimes(1);
  });
});
