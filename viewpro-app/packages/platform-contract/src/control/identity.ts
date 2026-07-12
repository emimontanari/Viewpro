// Opaque brand: storage/validation semantics defined in P5.
export type IdempotencyKey = string & { readonly __brand: "IdempotencyKey" };

// Caller is a SERVICE (ViewPro), never a product user. Supplied by the
// authenticated service context in P5 — not carried in command bodies.
export type PlatformServiceIdentity = {
  readonly kind: "service";
  readonly callerId: string; // ViewPro service principal id
  readonly tokenId: string;  // id of the service token presented
};
