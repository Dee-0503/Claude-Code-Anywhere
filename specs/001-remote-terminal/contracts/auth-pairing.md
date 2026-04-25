# Auth and Pairing Contract

## Bootstrap Pairing

When no active admin device exists, the server prints a short-lived pairing code in the local terminal.

- The first successful pairing becomes the admin device.
- Bootstrap pairing expires automatically.
- Used pairing codes cannot be reused.

## Create Pairing Code

Admin-only operation.

Request:

```json
{
  "device_id": "admin-device-id",
  "access_token": "admin-token",
  "target_name_hint": "Cee iPhone"
}
```

Response:

```json
{
  "pairing_code": "123-456",
  "expires_at": "2026-04-25T12:10:00.000Z"
}
```

## Consume Pairing Code

Request:

```json
{
  "pairing_code": "123-456",
  "device_name": "Cee iPhone"
}
```

Response:

```json
{
  "device_id": "device-id",
  "access_token": "secret-token",
  "role": "member"
}
```

## Revoke Device

Admin-only operation.

Request:

```json
{
  "admin_device_id": "admin-device-id",
  "access_token": "admin-token",
  "target_device_id": "device-id"
}
```

Response:

```json
{
  "revoked": true
}
```

## Transfer Admin

Admin-only operation.

Request:

```json
{
  "admin_device_id": "admin-device-id",
  "access_token": "admin-token",
  "target_device_id": "device-id"
}
```

Response:

```json
{
  "new_admin_device_id": "device-id"
}
```

## Security Rules

- Store only hashed pairing-code verification material and hashed access tokens.
- Production remote access must use WSS/TLS.
- Revoked devices lose access on next request and next WebSocket heartbeat validation.
- Admin reset requires local terminal confirmation because it changes trust ownership.
