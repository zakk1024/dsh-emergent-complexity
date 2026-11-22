/**
 * `dsh-emergent-complexity` — package root row.
 *
 * This row exists for ONE reason: the DSH client-module loader discovers a
 * package's `dsh.client` declaration through the loader row mounted for the
 * package root (`resolveMeta` resolves the row's specifier to the package
 * manifest). Subpath rows alone (`/tools`, `/studio`) do not trigger client
 * discovery, so the overlay bundle would never ship.
 *
 * The row is deliberately inert: the skill is mounted by the
 * `skill-emergent-complexity` row (dsh-skill-filesystem), the studio routes by
 * the `studio-emergent-complexity` row. Keeping the root row free of services
 * means it activates in every profile (web, CLI) without side effects.
 */
export const name = 'dsh-emergent-complexity';

export function apply() {}
