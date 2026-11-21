export type DomainCustomerState =
  | "awaiting-payment"
  | "payment-verified"
  | "registration-pending"
  | "registration-processing"
  | "registration-failed"
  | "registered"
  | "configuring-dns"
  | "verifying-nameservers"
  | "provisioning-ssl"
  | "connected"
  | "renewal-due"
  | "expired"
  | "provisioning-failed";

export const DOMAIN_CUSTOMER_LABELS: Record<DomainCustomerState, string> = {
  "awaiting-payment": "Awaiting payment",
  "payment-verified": "Payment verified",
  "registration-pending": "Registration pending",
  "registration-processing": "Registration processing",
  "registration-failed": "Registration failed",
  registered: "Registered",
  "configuring-dns": "Configuring DNS",
  "verifying-nameservers": "Verifying nameservers",
  "provisioning-ssl": "Provisioning SSL",
  connected: "Connected",
  "renewal-due": "Renewal due",
  expired: "Expired",
  "provisioning-failed": "Provisioning failed",
};
