const { evaluateAuditReport } = require('../audit-production.cjs');

const allowedAdvisories = [
  {
    name: 'image-size',
    severity: 'high',
    url: 'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
  },
  {
    name: 'image-size',
    severity: 'high',
    url: 'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
  },
];

describe('production dependency audit', () => {
  it('allows only transitive findings rooted in the tracked image-size advisories', () => {
    const report = {
      vulnerabilities: {
        'image-size': {
          severity: 'high',
          via: allowedAdvisories,
        },
        metro: {
          severity: 'high',
          via: ['image-size'],
        },
        expo: {
          severity: 'high',
          via: ['metro'],
        },
      },
    };

    const result = evaluateAuditReport(report);

    expect(result.blocking).toEqual([]);
    expect(result.allowed.map(({ name }) => name)).toEqual([
      'image-size',
      'metro',
      'expo',
    ]);
  });

  it('blocks every unapproved high-severity advisory', () => {
    const report = {
      vulnerabilities: {
        nanoid: {
          severity: 'high',
          via: [
            {
              name: 'nanoid',
              severity: 'high',
              url: 'https://github.com/advisories/GHSA-2v37-7h3g-55p8',
            },
          ],
        },
      },
    };

    const result = evaluateAuditReport(report);

    expect(result.allowed).toEqual([]);
    expect(result.blocking).toEqual([
      {
        name: 'nanoid',
        severity: 'high',
        advisoryIds: ['GHSA-2v37-7h3g-55p8'],
      },
    ]);
  });

  it('blocks unresolved transitive findings instead of silently allowing them', () => {
    const report = {
      vulnerabilities: {
        metro: {
          severity: 'high',
          via: ['missing-package'],
        },
      },
    };

    const result = evaluateAuditReport(report);

    expect(result.allowed).toEqual([]);
    expect(result.blocking).toHaveLength(1);
    expect(result.blocking[0].name).toBe('metro');
  });
});
