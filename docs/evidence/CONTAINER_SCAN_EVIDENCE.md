# Container Vulnerability Scan Evidence

## Scope

This evidence captures vulnerability scanning results for deployable container images.

## Images Scanned

- `project-backend:latest`
- `project-nginx:latest`

## Scanner

- Trivy (containerized execution)

## Output Artifacts

- `trivy_backend_table.txt`
- `trivy_backend.json`
- `trivy_nginx_table.txt`

## Current Scan Snapshot

- Backend image summary: `project-backend:latest (alpine 3.23.3)` reports 1 HIGH/CRITICAL finding at base image layer.
- Nginx image summary: `project-nginx:latest (alpine 3.21.3)` reports total 20 HIGH/CRITICAL findings (HIGH: 15, CRITICAL: 5).
- Findings are primarily base OS package CVEs and can be reduced by regular base image updates/rebuilds.

## Interpretation Guidance

- Review HIGH/CRITICAL counts first.
- Prioritize fixes by package and fix availability.
- Re-run scans after base image/package updates.

## Source References

- `backend/Dockerfile.prod`
- `nginx/Dockerfile.prod`
- `docker-compose.prod.yml`

## Conclusion

The generated scan artifacts provide repeatable, timestamped vulnerability evidence for submission and remediation tracking.
