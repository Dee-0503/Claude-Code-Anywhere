import type {
  CLAUDE_INSTANCE_STATUSES,
  ClaudeInstance,
  ClaudeInstanceId,
  ClaudeInstanceTeamMetadata
} from '../../../shared/protocol/domain.js';
import { PROTOCOL_ERROR_CODES } from '../../../shared/protocol/errors.js';
import type { BootstrapPairingService } from '../auth/pairing-service.js';
import { createApiError } from './errors.js';
import type { InstanceService } from '../sessions/instance-service.js';
import { detectTeamSessions } from '../sessions/team-detector.js';

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
  readonly team_metadata?: {
    readonly team_id: string;
    readonly teammate_id: string;
    readonly teammate_name: string;
  };
}

export interface InstanceStatusRequest extends AuthenticatedInstanceRequest {
  readonly instance_id: ClaudeInstanceId;
}

export function createInstanceApi(options: InstanceApiOptions) {
  function toTeamMetadata(
    input: CreateInstanceRequest['team_metadata']
  ): ClaudeInstanceTeamMetadata | null {
    if (input === undefined) {
      return null;
    }

    return {
      teamId: input.team_id,
      teammateId: input.teammate_id,
      teammateName: input.teammate_name
    };
  }

  function serializeInstance(instance: ClaudeInstance) {
    return {
      id: instance.id,
      name: instance.name,
      status: instance.status,
      last_active_at: instance.lastActiveAt,
      team_metadata:
        instance.teamMetadata === null
          ? null
          : {
              team_id: instance.teamMetadata.teamId,
              teammate_id: instance.teamMetadata.teammateId,
              teammate_name: instance.teamMetadata.teammateName
            }
    };
  }

  function serializeTeamSessions(instances: readonly ClaudeInstance[]) {
    return detectTeamSessions(
      instances.map((instance) => ({
        instanceId: instance.id,
        instanceName: instance.name,
        ...(instance.teamMetadata === null
          ? {}
          : {
              teamId: instance.teamMetadata.teamId,
              teammateId: instance.teamMetadata.teammateId,
              teammateName: instance.teamMetadata.teammateName
            })
      }))
    ).map((session) => ({
      team_id: session.teamId,
      teammates: session.teammates.map((teammate) => ({
        instance_id: teammate.instanceId,
        instance_name: teammate.instanceName,
        teammate_id: teammate.teammateId,
        teammate_name: teammate.teammateName
      }))
    }));
  }

  function instanceNotFound(instanceId: ClaudeInstanceId) {
    return createApiError(PROTOCOL_ERROR_CODES.INSTANCE_UNAVAILABLE, 'Instance not found', {
      statusCode: 404,
      details: { instance_id: instanceId }
    });
  }

  async function authenticate(input: AuthenticatedInstanceRequest) {
    return options.auth.verifyDeviceToken({
      device_id: input.device_id,
      access_token: input.access_token
    });
  }

  return {
    async listInstances(input: AuthenticatedInstanceRequest) {
      const device = await authenticate(input);
      const instances = options.instances.listInstancesForDevice(device.id);
      return {
        instances: instances.map(serializeInstance),
        team_sessions: serializeTeamSessions(instances)
      };
    },
    async createInstance(input: CreateInstanceRequest) {
      const device = await authenticate(input);
      const { instance } = options.instances.startInstance({
        cwd: input.cwd,
        name: input.name,
        createdByDeviceId: device.id,
        teamMetadata: toTeamMetadata(input.team_metadata)
      });
      return serializeInstance(instance);
    },
    async getInstanceStatus(input: InstanceStatusRequest) {
      const device = await authenticate(input);
      const instance = options.instances.getInstanceForDevice(input.instance_id, device.id);
      if (instance === undefined) {
        throw instanceNotFound(input.instance_id);
      }
      return {
        id: instance.id,
        status: instance.status
      };
    },
    async stopInstance(input: InstanceStatusRequest) {
      const device = await authenticate(input);
      const instance = options.instances.stopInstanceForDevice(input.instance_id, device.id);
      if (instance === undefined) {
        throw instanceNotFound(input.instance_id);
      }
      return {
        stopped: true,
        status: instance.status as typeof CLAUDE_INSTANCE_STATUSES.EXITED
      };
    }
  };
}
