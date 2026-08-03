"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { inviteOrganizationRepresentative } from "~/app/[locale]/dashboard/organizations/actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { PendingButton } from "~/components/pending-button";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/admin/workspace";

export interface InvitableRoleOption {
  code: string;
  label: string;
}

/**
 * Inviting somebody, from the roster's own toolbar.
 *
 * The five identity fields are all required because accepting the invitation
 * does not create the person — reserving the membership row does, immediately,
 * and `core.organization_members` takes no half-filled rows. So the form asks
 * for a whole colleague or nothing, which is also why it is a dialog: a
 * six-field form sitting open under a list reads as part of the list.
 */
export function InviteMemberDialog({
  locale,
  organizationId,
  roles,
  labels,
}: {
  locale: string;
  organizationId: string;
  roles: InvitableRoleOption[];
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const showActionError = useActionErrorToast();

  const submit = async (formData: FormData) => {
    try {
      await inviteOrganizationRepresentative(formData);
      toast.success(labels.sent ?? "");
      setOpen(false);
    } catch (error) {
      showActionError(error, labels.error ?? "");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus aria-hidden />
            {labels.cta}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <form action={submit}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.hint}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="invite-first-name">
                {labels.firstName}
              </FieldLabel>
              <Input id="invite-first-name" name="firstName" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-last-name">
                {labels.lastName}
              </FieldLabel>
              <Input id="invite-last-name" name="lastName" required />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="invite-title">{labels.jobTitle}</FieldLabel>
              <Input id="invite-title" name="title" required />
              <FieldDescription>{labels.jobTitleHint}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-email">{labels.email}</FieldLabel>
              <Input id="invite-email" name="email" type="email" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-phone">{labels.phone}</FieldLabel>
              <Input
                id="invite-phone"
                name="phone"
                type="tel"
                dir="ltr"
                required
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="invite-role">{labels.role}</FieldLabel>
              <Select
                id="invite-role"
                name="roleCode"
                defaultValue={roles[0]?.code}
              >
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.label}
                  </option>
                ))}
              </Select>
              <FieldDescription>{labels.roleHint}</FieldDescription>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose
              render={<Button variant="ghost">{labels.cancel}</Button>}
            />
            <PendingButton>{labels.send}</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
