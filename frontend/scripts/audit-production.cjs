const { spawnSync } = require('node:child_process');

const TRACKING_ISSUE = 'https://github.com/x3sc/destiny-bistro-crm/issues/64';
const ALLOWED_IMAGE_SIZE_ADVISORIES = new Set([
  'GHSA-w3rx-r6r6-pgpr',
  'GHSA-5p2g-fcmc-qvqq',
]);
const SEVERITY_RANK = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function getAdvisoryId(url = '') {
  return url.match(/GHSA-[a-z0-9-]+/i)?.[0] ?? null;
}

function collectAdvisories(name, vulnerabilities, ancestry = new Set()) {
  if (ancestry.has(name)) {
    return { advisories: [], unresolved: false };
  }

  const vulnerability = vulnerabilities[name];
  if (!vulnerability) {
    return { advisories: [], unresolved: true };
  }

  const nextAncestry = new Set(ancestry).add(name);
  const advisories = [];
  let unresolved = false;

  for (const via of vulnerability.via ?? []) {
    if (typeof via === 'string') {
      const nested = collectAdvisories(via, vulnerabilities, nextAncestry);
      advisories.push(...nested.advisories);
      unresolved ||= nested.unresolved;
      continue;
    }

    if (via && typeof via === 'object' && via.url) {
      advisories.push(via);
      continue;
    }

    unresolved = true;
  }

  return { advisories, unresolved };
}

function isAllowedImageSizeAdvisory(advisory) {
  const advisoryId = getAdvisoryId(advisory.url);
  const packageName = advisory.name ?? advisory.dependency;

  return (
    packageName === 'image-size' &&
    advisoryId !== null &&
    ALLOWED_IMAGE_SIZE_ADVISORIES.has(advisoryId)
  );
}

function evaluateAuditReport(report, auditLevel = 'high') {
  if (!report || typeof report !== 'object' || !report.vulnerabilities) {
    return {
      allowed: [],
      blocking: [
        {
          name: 'npm-audit',
          severity: 'critical',
          reason: 'npm did not return a valid vulnerability report',
        },
      ],
    };
  }

  const threshold = SEVERITY_RANK[auditLevel];
  const allowed = [];
  const blocking = [];

  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    if ((SEVERITY_RANK[vulnerability.severity] ?? 0) < threshold) {
      continue;
    }

    const result = collectAdvisories(name, report.vulnerabilities);
    const advisoryIds = [
      ...new Set(result.advisories.map((advisory) => getAdvisoryId(advisory.url))),
    ].filter(Boolean);
    const isAllowed =
      !result.unresolved &&
      result.advisories.length > 0 &&
      result.advisories.every(isAllowedImageSizeAdvisory);
    const finding = {
      name,
      severity: vulnerability.severity,
      advisoryIds,
    };

    if (isAllowed) {
      allowed.push(finding);
    } else {
      blocking.push(finding);
    }
  }

  return { allowed, blocking };
}

function runAudit() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(
    npmCommand,
    ['audit', '--omit=dev', '--audit-level=high', '--json'],
    {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  if (result.error) {
    console.error(`Unable to run npm audit: ${result.error.message}`);
    return 1;
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    console.error('npm audit did not return valid JSON.');
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    return 1;
  }

  const evaluation = evaluateAuditReport(report);
  if (evaluation.blocking.length > 0) {
    console.error('Blocking production dependency vulnerabilities found:');
    for (const finding of evaluation.blocking) {
      const advisoryList = finding.advisoryIds?.join(', ') || 'unresolved advisory';
      console.error(`- ${finding.name} (${finding.severity}): ${advisoryList}`);
    }
    return 1;
  }

  if (evaluation.allowed.length > 0) {
    const advisoryIds = [
      ...new Set(evaluation.allowed.flatMap((finding) => finding.advisoryIds)),
    ];
    console.warn(
      `Temporarily allowing ${advisoryIds.join(', ')} only for image-size; ` +
        `no patched release exists. Tracked by ${TRACKING_ISSUE}`,
    );
  } else {
    console.log('No high or critical production dependency vulnerabilities found.');
  }

  return 0;
}

if (require.main === module) {
  process.exitCode = runAudit();
}

module.exports = {
  evaluateAuditReport,
  getAdvisoryId,
  isAllowedImageSizeAdvisory,
};
