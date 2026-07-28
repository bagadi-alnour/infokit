/**
 * The "the platform itself" option in the activity owner picker.
 *
 * Almost every activity is coordinated by an association, and that association
 * is its custodian. Some are not: information the platform gathered from an
 * official public source, or an offering whose association is not onboarded
 * yet. Those belong to the platform, which is not an organisation — it owns no
 * `organizations` row — so the activity is stored with no custodian and with no
 * creator or provider relationship claiming to speak for one.
 *
 * Like `EDITOR_CONTACT_OPTION_ID`, it is deliberately not a UUID: nothing can
 * mistake it for a stored organisation, and the action has to decide what it
 * means rather than link it blindly.
 */
export const PLATFORM_OWNER_OPTION_ID = "platform";
