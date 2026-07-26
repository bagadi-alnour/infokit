/**
 * The "reach me" option in the public-contacts picker.
 *
 * `activity_contacts` points at a real `contacts` row, and an organisation that
 * has never published one leaves the picker empty — the activity then goes out
 * with no way for a reader to ask about it. So the signed-in editor is always
 * offered under this id, and the create action turns it into a contact the
 * organisation owns the first time an editor keeps it.
 *
 * It is deliberately not a UUID: nothing can mistake it for a stored contact,
 * and the server has to decide what to do with it rather than link it blindly.
 */
export const EDITOR_CONTACT_OPTION_ID = "editor";
