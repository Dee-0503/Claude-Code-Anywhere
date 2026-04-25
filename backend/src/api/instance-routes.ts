import type { CLAUDE_INSTANCE_STATUSES, ClaudeInstanceId } from "../../../shared/protocol/domain.js";
import { PROTOCOL_ERROR_CODES } from "../../../shared/protocol/errors.js";
import type { BootstrapPairingService } from "../auth/pairing-service.js";
import { createApiError } from "./errors.js";
import type { InstanceService } from "../sessions/instance-service.js";

export interface InstanceApiOptions {
  readonly auth: BootstrapPairingService;
  readonly instances: InstanceService;
}

export interface AuthenticatedInstanceRequest {
  readonly device_id: string;
  readonly access_token: string;
}

export interface CreateInstanceRequest extends AuthenticatedInstanceRequest {
  readonly name: string;
  readonly cwd: string;
}

export interface InstanceStatusRequest extends AuthenticatedInstanceRequest {
  readonly instance_id: ClaudeInstanceId;
}

export function createInstanceApi(options: InstanceApiOptions) {
  function instanceNotFound(instanceId: ClaudeInstanceId) {
    return createApiError(PROTOCOL_ERROR_CODES.INSTANCE_UNAVAILABLE, "Instance not found", {
      statusCode: 404,
      details: { instance_id: instanceId },
    });
  }

  async function authenticate(input: AuthenticatedInstanceRequest) {
    return options.auth.verifyDeviceToken({
      device_id: input.device_id,
      access_token: input.access_token,
    });
  }

  return {
    async listInstances(input: AuthenticatedInstanceRequest) {
      await authenticate(input);
      return {
        instances: options.instances.repository.list().map((instance) => ({
          id: instance.id,
          name: instance.name,
          status: instance.status,
          last_active_at: instance.lastActiveAt,
        })),
      };
    },
    async createInstance(input: CreateInstanceRequest) {
      const device = await authenticate(input);
      const { instance } = options.instances.startInstance({
        cwd: input.cwd,
        name: input.name,
        createdByDeviceId: device.id,
      });
      return {
        id: instance.id,
        name: instance.name,
        status: instance.status,
      };
    },
    async getInstanceStatus(input: InstanceStatusRequest) {
      await authenticate(input);
      const instance = options.instances.getInstance(input.instance_id);
      if (instance === undefined) {
        throw instanceNotFound(input.instance_id);
      }
      return {
        id: instance.id,
        status: instance.status,
      };
    },
    async stopInstance(input: InstanceStatusRequest) {
      await authenticate(input);
      const instance = options.instances.stopInstance(input.instance_id);
      if (instance === undefined) {
        throw instanceNotFound(input.instance_id);
      }
      return {
        stopped: true,
        status: instance.status as typeof CLAUDE_INSTANCE_STATUSES.EXITED,
      };
    },
  };
}
