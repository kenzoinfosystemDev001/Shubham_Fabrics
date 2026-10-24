# Final QC RBAC Matrix

Authorization is enforced by `getFinalQCActor` in the Next.js API route handlers. A valid existing MES token must resolve to an active database user. Read and mutation endpoints accept Final QC department membership, recognized Final QC inspector roles, or administrator access.

| Capability | Final QC department user | `FINAL_QC_INSPECTOR` / `FINAL_QC_INSPECTOR` | Admin / Super Admin | Other department / anonymous |
|---|---:|---:|---:|---:|
| Open Final QC pages (client route guard) | Yes | Yes | Yes | No |
| Read incoming, queue, job, dashboard, floor board, and reports | Yes | Yes | Yes | No |
| Receive/start/hold/resume/inspect a job | Yes | Yes | Yes | No |
| Issue accepted garments to configured next department | Yes | Yes | Yes | No |

The current guard authorizes all Final QC department users and the listed inspector roles for both read and write actions; it does not implement a distinct supervisor-only action policy. Refine the matrix and server checks if supervisor-only approvals become a business requirement.

## Identity and session limitations

- The actor ID is resolved server-side from the request token; caller-supplied actor IDs are not trusted for workflow audit writes.
- User active status, department/role, token timestamp, and a seven-day age limit are checked.
- The shared `mes_jwt_<userId>_<timestamp>` token format is not signed. Since a department-local guard cannot authenticate token integrity, migrate the shared platform to signed, revocable sessions before relying on this as a security boundary.
- The local quick-login station is a convenience for development; production deployments must use approved credentials and authentication configuration.
