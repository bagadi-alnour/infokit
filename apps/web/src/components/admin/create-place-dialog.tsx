"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createPlace } from "~/app/[locale]/dashboard/places/actions";
import { PlaceAddressFields } from "~/components/address/place-address-fields";
import { useActionErrorToast } from "~/components/admin/admin-ui-provider";
import { StewardContactFields } from "~/components/admin/steward-contact";
import { Field, Select, TextInput } from "~/components/admin/workspace";
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
import { EMPTY_STEWARD_CONTACT } from "~/lib/steward-contact";

export interface PlaceOption {
  id: string;
  label: string;
}

/**
 * Creating a place, from the list's own toolbar.
 *
 * It used to be a form pinned open in a 320px column beside the list, which
 * spent a third of the page on a task nobody is doing most of the time. As a
 * dialog it gets the width its address lookup and steward fields actually want,
 * and the list gets the page back.
 *
 * Deliberately not a `/new` route, unlike articles: the address autocomplete
 * carries unsaved coordinates in client state, and a full page navigation to
 * reach it would be a heavier promise than "add a place" deserves.
 */
export function CreatePlaceDialog({
  locale,
  cityId,
  organizations,
  areas,
  labels,
  stewardLabels,
}: {
  locale: string;
  cityId: string;
  organizations: PlaceOption[];
  areas: PlaceOption[];
  labels: Record<string, string>;
  /** The shared console catalogue the steward fields read their wording from. */
  stewardLabels: Record<string, string>;
}) {
  // The catalogue is a plain record, so every lookup is `string | undefined`.
  // One accessor rather than a `?? ""` on each of twenty call sites.
  const text = (key: string) => labels[key] ?? "";
  const [open, setOpen] = useState(false);
  const showActionError = useActionErrorToast();

  const submit = async (formData: FormData) => {
    try {
      await createPlace(formData);
      toast.success(text("places.createSuccess"));
      setOpen(false);
    } catch (error) {
      showActionError(error, text("places.createError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus aria-hidden />
            {text("places.new")}
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form action={submit}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="cityId" value={cityId} />
          <DialogHeader>
            <DialogTitle>{text("places.new")}</DialogTitle>
            <DialogDescription>{text("places.newHint")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={text("places.nameFr")}>
                <TextInput name="nameFr" required minLength={2} />
              </Field>
              <Field
                label={text("places.nameEn")}
                hint={text("places.optional")}
              >
                <TextInput name="nameEn" />
              </Field>
              <Field
                label={text("places.nameAr")}
                hint={text("places.optional")}
              >
                <TextInput name="nameAr" dir="rtl" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={text("places.organization")}
                hint={text("places.organizationHint")}
              >
                <Select name="organizationId" defaultValue="">
                  <option value="">—</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={text("places.cityArea")}
                hint={text("places.cityAreaHint")}
              >
                <Select name="cityAreaId" defaultValue="">
                  <option value="">—</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <PlaceAddressFields
              labels={{
                label: text("places.address.label"),
                placeholder: text("places.address.placeholder"),
                help: text("places.address.help"),
                loading: text("places.address.loading"),
                empty: text("places.address.empty"),
                error: text("places.address.error"),
                attribution: text("places.address.attribution"),
              }}
              selectedLabel={text("places.address.selected")}
            />

            {/* Who to ask when this place turns out to be wrong — workspace
             * only, on every content type. */}
            <StewardContactFields
              values={EMPTY_STEWARD_CONTACT}
              labels={stewardLabels}
              columns={false}
            />

            {/* Last, and on its own line: it is the decision the page exists to
             * make, and it should not be skimmed past on the way to the
             * button. */}
            <Field
              label={text("places.precision")}
              hint={text("places.precisionHint")}
            >
              <Select name="precision" defaultValue="exact">
                <option value="exact">{text("places.precision.exact")}</option>
                <option value="area_only">
                  {text("places.precision.areaOnly")}
                </option>
                <option value="contact_to_learn">
                  {text("places.precision.contact")}
                </option>
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose
              render={<Button variant="ghost">{text("places.cancel")}</Button>}
            />
            <PendingButton>{text("places.create")}</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
