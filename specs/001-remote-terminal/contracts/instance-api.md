# Instance API Contract

## List Instances

Request:

```json
{
  "device_id": "device-id",
  "access_token": "token"
}
```

Response:

```json
{
  "instances": [
    {
      "id": "instance-id",
      "name": "main",
      "status": "running",
      "last_active_at": "2026-04-25T12:00:00.000Z",
      "team_metadata": {
        "team_id": "team-1",
        "teammate_id": "lead",
        "teammate_name": "Lead"
      }
    }
  ],
  "team_sessions": [
    {
      "team_id": "team-1",
      "teammates": [
        {
          "instance_id": "instance-id",
          "instance_name": "main",
          "teammate_id": "lead",
          "teammate_name": "Lead"
        }
      ]
    }
  ]
}
```

## Create Instance

Request:

```json
{
  "device_id": "device-id",
  "access_token": "token",
  "name": "main",
  "cwd": "/Users/ceemac/my_product/Claude Code Anywhere",
  "team_metadata": {
    "team_id": "team-1",
    "teammate_id": "lead",
    "teammate_name": "Lead"
  }
}
```

Response:

```json
{
  "id": "instance-id",
  "name": "main",
  "status": "running",
  "team_metadata": {
    "team_id": "team-1",
    "teammate_id": "lead",
    "teammate_name": "Lead"
  }
}
```

## Get Instance Status

Request:

```json
{
  "device_id": "device-id",
  "access_token": "token",
  "instance_id": "instance-id"
}
```

Response:

```json
{
  "id": "instance-id",
  "status": "running",
  "next_output_offset": 2048,
  "connected_devices": 2
}
```

## Stop Instance

Request:

```json
{
  "device_id": "device-id",
  "access_token": "token",
  "instance_id": "instance-id"
}
```

Response:

```json
{
  "stopped": true,
  "status": "exited"
}
```

## Rules

- Only authenticated non-revoked devices can list or attach to instances.
- Instance output is accessed through the WebSocket contract.
- Stopping an instance closes attached terminal connections with a terminal status message.
