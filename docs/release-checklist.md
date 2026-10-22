# Release checklist

Do not launch because the screens exist. Check each item against the environment you will actually serve.

## Product

- [ ] Counsel has replaced the draft terms, privacy, refund, and data-deletion documents, and their `review_status` is `published`.
- [ ] Prices, tax treatment, and the Agency cap of six client profiles have been confirmed for the country of sale.
- [ ] Custom quotes arrive in the admin inbox and the acknowledgement path is the one you will use in production.
- [ ] A real user can register, verify email, sign in, and create a Business workspace and an Agency workspace.
- [ ] Server-side limits reject an extra client, account, member, and post target.
- [ ] An unapproved post cannot be enqueued. A material edit clears the previous approval.
- [ ] A schedule that passes while approval is pending does not publish.
- [ ] Each target shows its own status, including partial failure.
- [ ] A duplicate Razorpay webhook does not increment `charge_count`.
- [ ] A workspace cannot read another workspace’s client by id.

## Providers

- [ ] Only connectors with an authorized publish and reconnect test are marked verified.
- [ ] Sandbox mode is off in production.
- [ ] X usage cost is known before that connector is enabled.
- [ ] OAuth secrets are not in the frontend bundle or in API responses.

## Operations

- [ ] `prod` profile is set. Session and token keys are unique and not the development values.
- [ ] Cookies are Secure behind HTTPS.
- [ ] Super admin bootstrap variables have been removed.
- [ ] MFA is enrolled for every super admin.
- [ ] PostgreSQL backups restore onto a clean machine.
- [ ] Uptime checks hit `/actuator/health`.
- [ ] Logs were reviewed for tokens, passwords, and webhook payloads.
- [ ] Load and crash tests cover the worker: a crash during `publishing` ends in `needs_reconcile`, not a second post.
