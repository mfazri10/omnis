import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { DatabaseService } from "../../../database/database.service";
import type { AssignmentsRepository } from "./assignments.repository";
import { AssignmentsService } from "./assignments.service";
import type { RbacService } from "./rbac.service";
import type { RoleDetail } from "./roles.service";
import type { RolesService } from "./roles.service";

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeService(): {
  service: AssignmentsService;
  assignments: Mocked<AssignmentsRepository>;
  roles: Mocked<RolesService>;
  rbac: Mocked<RbacService>;
} {
  const assignments: Mocked<AssignmentsRepository> = {
    insert: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    listAdminIdsByRole: jest.fn(),
    listByAdmin: jest.fn(),
  };
  const roles: Mocked<RolesService> = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
  };
  const rbac: Mocked<RbacService> = {
    hasPermission: jest.fn(),
    listEffectivePermissions: jest.fn(),
    bumpAdminVersion: jest.fn(),
  };
  const database = {
    getControlPlaneConnection: jest.fn().mockReturnValue({}),
  } as unknown as DatabaseService;
  const service = new AssignmentsService(
    database,
    assignments as unknown as AssignmentsRepository,
    roles as unknown as RolesService,
    rbac as unknown as RbacService,
  );
  return { service, assignments, roles, rbac };
}

function appRole(): RoleDetail {
  return {
    id: "5",
    name: "Editor Soal",
    description: null,
    scopeType: "app",
    appId: "1",
    permissionKeys: [],
  };
}

function globalRole(): RoleDetail {
  return {
    id: "6",
    name: "Operator",
    description: null,
    scopeType: "global",
    appId: null,
    permissionKeys: [],
  };
}

describe("AssignmentsService", () => {
  it("assign role app valid + bump versi cache", async () => {
    const { service, assignments, roles, rbac } = makeService();
    roles.findById.mockResolvedValue(appRole());
    assignments.exists.mockResolvedValue(false);
    await service.assign({ adminId: "11", roleId: "5", appId: "1" });
    expect(assignments.insert).toHaveBeenCalledWith(expect.anything(), {
      adminId: 11,
      roleId: 5,
      appId: 1,
    });
    expect(rbac.bumpAdminVersion).toHaveBeenCalledWith(["11"]);
  });

  it("menolak appId untuk role global", async () => {
    const { service, roles } = makeService();
    roles.findById.mockResolvedValue(globalRole());
    await expect(
      service.assign({ adminId: "11", roleId: "6", appId: "1" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("menolak appId yang beda dengan aplikasi role", async () => {
    const { service, roles } = makeService();
    roles.findById.mockResolvedValue(appRole());
    await expect(
      service.assign({ adminId: "11", roleId: "5", appId: "2" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("menolak penetapan duplikat", async () => {
    const { service, roles, assignments } = makeService();
    roles.findById.mockResolvedValue(appRole());
    assignments.exists.mockResolvedValue(true);
    await expect(
      service.assign({ adminId: "11", roleId: "5", appId: "1" }),
    ).rejects.toThrow(ConflictException);
    expect(assignments.insert).not.toHaveBeenCalled();
  });

  it("unassign yang tak ada → NotFound", async () => {
    const { service, roles, assignments } = makeService();
    roles.findById.mockResolvedValue(globalRole());
    assignments.delete.mockResolvedValue(false);
    await expect(
      service.unassign({ adminId: "11", roleId: "6" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("pelanggaran FK admin → BadRequest, bukan 500", async () => {
    const { service, roles, assignments } = makeService();
    roles.findById.mockResolvedValue(globalRole());
    assignments.exists.mockResolvedValue(false);
    assignments.insert.mockRejectedValue(
      Object.assign(new Error("fk"), { code: "23503" }),
    );
    await expect(
      service.assign({ adminId: "999", roleId: "6" }),
    ).rejects.toThrow(BadRequestException);
  });
});
