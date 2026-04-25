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

function resolveRoute(pathname: string): AppRoute {
  return ROUTES.find((route) => route.path === pathname) ?? ROUTES[0]!;
}

export default function App(): ReactElement {
  const [route, setRoute] = useState<AppRoute>(() => resolveRoute(window.location.pathname));
  const [connectionStatus, setConnectionStatus] = useState<ProtocolClientStatus>("idle");
  const [credentials, setCredentials] = useState<DeviceCredentials | null>(() => loadDeviceCredentials());
  const protocolClient = useMemo(
    () => new ProtocolClient({ url: `${window.location.origin.replace(/^http/, "ws")}/ws` }),
    [],
  );

  useEffect(() => protocolClient.on("status", setConnectionStatus), [protocolClient]);

  useEffect(() => {
    function handlePopState(): void {
      setRoute(resolveRoute(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(nextRoute: AppRoute): void {
    window.history.pushState(null, "", nextRoute.path);
    setRoute(nextRoute);
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
        {renderRoute(route.name, protocolClient, credentials, handlePaired)}
      </section>

      <footer>
        <small>
          Device: {credentials?.device_id ?? "未配对"} · Instance: {DEFAULT_INSTANCE_ID}
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
): ReactElement {
  switch (routeName) {
    case "pairing":
      return <PairingPage onPaired={onPaired} />;
    case "terminal":
      return (
        <TerminalView client={protocolClient} credentials={credentials} instanceId={DEFAULT_INSTANCE_ID} />
      );
    case "home":
      return <p>应用壳层、配对入口和远程终端路由已就绪。</p>;
  }
}
