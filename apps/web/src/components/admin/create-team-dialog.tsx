"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createTeam } from "~/app/[locale]/dashboard/my-organization/city-team/actions";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { SearchableSelect } from "~/components/admin/searchable-select";
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

export interface TeamScopeOption {
  id: string;
  label: string;
}

export function CreateTeamDialog({
  locale,
  organizations,
  cities,
  defaultOrganizationId,
  defaultCityId,
  labels,
}: {
  locale: string;
  organizations: TeamScopeOption[];
  cities: TeamScopeOption[];
  defaultOrganizationId?: string;
  defaultCityId?: string;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState(
    defaultOrganizationId ?? organizations[0]?.id ?? "",
  );
  const [cityId, setCityId] = useState(defaultCityId ?? cities[0]?.id ?? "");
  const showActionError = useActionErrorToast();

  const submit = async (formData: FormData) => {
    try {
      await createTeam(formData);
      toast.success(labels.created);
      setOpen(false);
    } catch (error) {
      showActionError(error, labels.createError ?? "");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" aria-hidden />
        {labels.create}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.createTitle}</DialogTitle>
          <DialogDescription>{labels.createHint}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <input type="hidden" name="locale" value={locale} />
          {organizations.length > 1 ? (
            <Field>
              <FieldLabel>{labels.organization}</FieldLabel>
              <SearchableSelect
                name="organizationId"
                options={organizations.map((organization) => ({
                  value: organization.id,
                  label: organization.label,
                }))}
                value={organizationId}
                onValueChange={setOrganizationId}
                label={labels.organization}
                placeholder={labels.organization}
                emptyLabel={labels.noMatch}
                required
              />
            </Field>
          ) : (
            <input type="hidden" name="organizationId" value={organizationId} />
          )}
          <Field>
            <FieldLabel>{labels.city}</FieldLabel>
            <SearchableSelect
              name="cityId"
              options={cities.map((city) => ({
                value: city.id,
                label: city.label,
              }))}
              value={cityId}
              onValueChange={setCityId}
              label={labels.city}
              placeholder={labels.city}
              emptyLabel={labels.noMatch}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="create-team-name">{labels.name}</FieldLabel>
            <Input id="create-team-name" name="name" autoComplete="off" />
            <FieldDescription>{labels.nameHint}</FieldDescription>
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {labels.cancel}
            </DialogClose>
            <PendingButton>
              <Plus aria-hidden />
              {labels.createAction}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
