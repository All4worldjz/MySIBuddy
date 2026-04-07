# Troubleshooting: Docker Sandbox Permission Denied

## Issue Description
Agents with `sandbox.mode: "all"` fail to start, returning the error:
`Error: Failed to inspect sandbox image: permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock`

## Root Cause
This occurs when the user running the OpenClaw service (typically `admin`) is added to the `docker` group, but the active **systemd user session** has not refreshed its group IDs. 

Even if the `admin` user shows as being in the `docker` group via `groups` command in a new SSH shell, the long-running `systemd --user` manager (and all services it manages, like `openclaw-gateway`) still holds the old security context from when the session first started.

## Resolution Steps

### 1. Temporary Fix (Restore Service)
If immediate availability is required, temporarily disable sandboxing:
1. Create a candidate config where `.agents.list[].sandbox.mode = "off"`.
2. Apply using `scripts/safe_openclaw_apply.sh`.

### 2. Permanent Fix (Refresh Permissions)
The systemd user instance must be restarted to pick up the new group membership.

**Method A: Full Reboot (Recommended)**
```bash
sudo reboot
```

**Method B: Restart User Session**
1. Enable linger for the user: `loginctl enable-linger admin`
2. Restart the user's systemd manager:
   ```bash
   sudo systemctl restart user@1000.service
   ```
   *Note: This will stop all user-level services and disconnect active SSH sessions.*

## Prevention & Verification
After any change to user groups:
1. Verify the group exists: `getent group docker`
2. Verify the process's effective groups: `grep Groups /proc/<PID>/status`
3. Ensure the Docker GID (typically `111` or `999`) is present in the output.
