// Stub for the optional `@x402/*` payment packages that Reown AppKit's default
// Coinbase connector references via `@coinbase/cdp-sdk`. Those packages are not
// installed and this app never triggers x402 payments, so every specifier is
// aliased here (see next.config.ts). The named exports below only exist so the
// bundler can satisfy static imports; none of this code is ever executed.
const noop = function noop() {} as unknown as new (
  ...args: unknown[]
) => unknown;

export {
  noop as toClientEvmSigner,
  noop as BatchSettlementEvmScheme,
  noop as bazaarResourceServerExtension,
  noop as ExactEvmScheme,
  noop as ExactEvmSchemeV1,
  noop as ExactSvmScheme,
  noop as ExactSvmSchemeV1,
  noop as HTTPFacilitatorClient,
  noop as paymentMiddlewareFromConfig,
  noop as paymentMiddlewareFromHTTPServer,
  noop as registerExactEvmScheme,
  noop as UptoEvmScheme,
  noop as wrapFetchWithPayment,
  noop as x402Client,
  noop as x402ResourceServer,
  noop as x402HTTPResourceServer,
};

const emptyDefault = {};
export default emptyDefault;
