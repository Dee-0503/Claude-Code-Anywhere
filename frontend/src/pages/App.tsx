import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

import { ProtocolClient } from "../protocol/client.js";
import type { ProtocolClientStatus } from "../protocol/client.js";
import {
  loadDeviceCredentials,
  type DeviceCredentials,
} from "../protocol/device-credentials.js";
import { PairingPage } from "./PairingPage.js";
import { TerminalView } from "../terminal/TerminalView.js";
import { TeamWorkspace } from "../components/TeamWorkspace.js";
import type { TeamWorkspaceTeammate } from "../components/TeamWorkspace.js";

type RouteName = "home" | "pairing" | "terminal";

interface AppRoute {
  name: RouteName;
  label: string;
  path: string;
}

const ROUTES: AppRoute[] = [
  { name: "home", label: "概览", path: "/" },
  { name: "pairing", label: "配对", path: "/pairing" },
  { name: "terminal", label: "终端", path: "/terminal" },
];

const DEFAULT_INSTANCE_ID = "default";

export function resolveInstanceIdFromLocation(location: URL): string {
  return location.searchParams.get("instance") ?? DEFAULT_INSTANCE_ID;
}

function createTerminalPath(instanceId: string): string {
  return instanceId === DEFAULT_INSTANCE_ID ? "/terminal" : `/terminal?instance=${encodeURIComponent(instanceId)}`;
}

export interface InstanceSummary {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly last_active_at: string | null;
  readonly team_metadata: {
    readonly team_id: string;
    readonly teammate_id: string;
    readonly teammate_name: string;
  } | null;
}

export interface TeamSessionSummary {
  readonly team_id: string;
  readonly teammates: readonly {
    readonly instance_id: string;
    readonly instance_name: string;
    readonly teammate_id: string;
    readonly teammate_name: string;
  }[];
}

export interface TerminalRouteModel {
  readonly activeInstanceId: string;
  readonly teammates: readonly TeamWorkspaceTeammate[];
  createTerminalPath(instanceId: string): string;
}

export interface InstanceListResponse {
  readonly instances: InstanceSummary[];
  readonly team_sessions: TeamSessionSummary[];
}

export async function fetchInstanceSummaries(credentials: DeviceCredentials): Promise<InstanceListResponse> {
  const url = new URL("/api/instances", window.location.origin);
  url.searchParams.set("device_id", credentials.device_id);
  url.searchParams.set("access_token", credentials.access_token);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Instance list failed with HTTP ${response.status}`);
  }

  return (await response.json()) as InstanceListResponse;
}

export function createTerminalRouteModel(
  instances: readonly InstanceSummary[],
  teamSessions: readonly TeamSessionSummary[],
  activeInstanceId: string,
): TerminalRouteModel {
  const currentSession = teamSessions.find((session) => session.teammates.some((teammate) => teammate.instance_id === activeInstanceId));
  const teammates = currentSession?.teammates.map((teammate) => ({
    instanceId: teammate.instance_id,
    teammateName: teammate.teammate_name,
    instanceName: teammate.instance_name,
  })) ?? instances.map((instance) => ({
    instanceId: instance.id,
    teammateName: instance.team_metadata?.teammate_name ?? instance.name,
    instanceName: instance.name,
  }));

  return {
    activeInstanceId,
    teammates: teammates.length > 0
      ? teammates
      : [{ instanceId: activeInstanceId, teammateName: "当前", instanceName: activeInstanceId }],
    createTerminalPath,
  };
}

function resolveRoute(pathname: string): AppRoute {
  return ROUTES.find((route) => route.path === pathname) ?? ROUTES[0]!;
}

export default function App(): ReactElement {
  const [route, setRoute] = useState<AppRoute>(() => resolveRoute(window.location.pathname));
  const [connectionStatus, setConnectionStatus] = useState<ProtocolClientStatus>("idle");
  const [credentials, setCredentials] = useState<DeviceCredentials | null>(() => loadDeviceCredentials());
  const [activeInstanceId, setActiveInstanceId] = useState(() => resolveInstanceIdFromLocation(new URL(window.location.href)));
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [teamSessions, setTeamSessions] = useState<TeamSessionSummary[]>([]);
  const protocolClient = useMemo(
    () => new ProtocolClient({ url: `${window.location.origin.replace(/^http/, "ws")}/ws` }),
    [],
  );

  useEffect(() => protocolClient.on("status", setConnectionStatus), [protocolClient]);

  useEffect(() => {
    if (credentials === null) {
      setInstances([]);
      setTeamSessions([]);
      return;
    }

    let cancelled = false;
    void fetchInstanceSummaries(credentials).then((instanceList) => {
      if (!cancelled) {
        setInstances(instanceList.instances);
        setTeamSessions(instanceList.team_sessions);
      }
    }).catch(() => {
      if (!cancelled) {
        setInstances([]);
        setTeamSessions([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [credentials]);

  useEffect(() => {
    function handlePopState(): void {
      setRoute(resolveRoute(window.location.pathname));
      setActiveInstanceId(resolveInstanceIdFromLocation(new URL(window.location.href)));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(nextRoute: AppRoute): void {
    window.history.pushState(null, "", nextRoute.path);
    setRoute(nextRoute);
  }

  function handleSelectInstance(instanceId: string): void {
    setActiveInstanceId(instanceId);
    const terminalRoute = ROUTES.find((item) => item.name === "terminal") ?? ROUTES[0]!;
    window.history.pushState(null, "", createTerminalPath(instanceId));
    setRoute(terminalRoute);
  }

  function handlePaired(nextCredentials: DeviceCredentials): void {
    setCredentials(nextCredentials);
    navigate(ROUTES.find((item) => item.name === "terminal") ?? ROUTES[0]!);
  }

  return (
    <main>
      <header>
        <h1>随行终端</h1>
        <p>远程 Claude Code 会话的前端壳层。</p>
        <p>Protocol client status: {connectionStatus}</p>
      </header>

      <nav aria-label="主导航">
        {ROUTES.map((item) => (
          <button
            aria-current={item.name === route.name ? "page" : undefined}
            key={item.name}
            onClick={() => navigate(item)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section aria-labelledby="route-title">
        <h2 id="route-title">{route.label}</h2>
        {renderRoute(route.name, protocolClient, credentials, handlePaired, createTerminalRouteModel(instances, teamSessions, activeInstanceId), handleSelectInstance)}
      </section>

      <footer>
        <small>
          Device: {credentials?.device_id ?? "未配对"} · Instance: {activeInstanceId}
        </small>
      </footer>
    </main>
  );
}

function renderRoute(
  routeName: RouteName,
  protocolClient: ProtocolClient,
  credentials: DeviceCredentials | null,
  onPaired: (credentials: DeviceCredentials) => void,
  terminalRoute: TerminalRouteModel,
  onSelectInstance: (instanceId: string) => void,
): ReactElement {
  switch (routeName) {
    case "pairing":
      return <PairingPage onPaired={onPaired} />;
    case "terminal":
      return (
        <>
          <TeamWorkspace
            activeInstanceId={terminalRoute.activeInstanceId}
            teammates={terminalRoute.teammates}
            onSelect={onSelectInstance}
          />
          <TerminalView client={protocolClient} credentials={credentials} instanceId={terminalRoute.activeInstanceId} />
        </>
      );
    case "home":
      return <p>应用壳层、配对入口和远程终端路由已就绪。</p>;
  }
}
