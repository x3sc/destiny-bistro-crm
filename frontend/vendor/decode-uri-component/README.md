# decode-uri-component CommonJS compatibility build

This directory vendors `decode-uri-component@0.5.0`, the first release patched
for GHSA-vcc3-ghjq-m6fr. Expo Router currently depends on CommonJS
`query-string@7.1.3`, while the patched upstream decoder is ESM-only.

The implementation and license are copied from upstream version 0.5.0. The
only compatibility change is replacing its default ESM export with
`module.exports`. Issue #91 tracks this bridge and its eventual removal after
Expo Router adopts a compatible patched dependency chain.
